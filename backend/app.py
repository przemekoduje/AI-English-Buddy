import os
import base64
from dotenv import load_dotenv # Upewnij się, że to jest na górze!
from flask import Flask, request, jsonify, Response, send_file
from flask_cors import CORS
import io
import queue
import threading
import asyncio
import edge_tts
import firebase_admin
from firebase_admin import credentials, firestore
import hashlib
import smtplib
from email.mime.text import MIMEText
import random
import json
import re

import requests
from openai import OpenAI

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Inicjalizacja Firebase Admin SDK
# Obsługa zmiennej środowiskowej na potrzeby wdrożenia chmurowego
try:
    firebase_creds_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
    if firebase_creds_json:
        import json
        firebase_creds = json.loads(firebase_creds_json)
        cred = credentials.Certificate(firebase_creds)
        print("Firebase: Używam poświadczeń ze zmiennej środowiskowej FIREBASE_CREDENTIALS_JSON.")
    else:
        cred = credentials.Certificate("firebase_service_account.json")
        print("Firebase: Używam pliku firebase_service_account.json.")
        
    firebase_admin.initialize_app(cred)
    db = firestore.client() # Klient Firestore
    print("Firebase zainicjalizowany pomyślnie.")
except Exception as e:
    print(f"Błąd inicjalizacji Firebase: {e}. Uruchamianie lokalnej bazy danych (mock).")
    import uuid
    from datetime import datetime

    class MockDocumentSnapshot:
        def __init__(self, doc_id, data):
            self.id = doc_id
            self._data = data
            self.exists = data is not None

        def to_dict(self):
            return self._data

    class MockDocumentReference:
        def __init__(self, collection_path, doc_id, mock_db):
            self.collection_path = collection_path
            self.id = doc_id
            self.mock_db = mock_db

        def get(self):
            data = self.mock_db.read_doc(self.collection_path, self.id)
            return MockDocumentSnapshot(self.id, data)

        def set(self, data):
            self.mock_db.write_doc(self.collection_path, self.id, data)

        def update(self, data):
            self.mock_db.update_doc(self.collection_path, self.id, data)

        def delete(self):
            self.mock_db.delete_doc(self.collection_path, self.id)

    class MockQuery:
        def __init__(self, collection_path, mock_db, filters=None, limit_val=None):
            self.collection_path = collection_path
            self.mock_db = mock_db
            self.filters = filters or []
            self.limit_val = limit_val

        def where(self, field, op, val):
            new_filters = list(self.filters)
            new_filters.append((field, op, val))
            return MockQuery(self.collection_path, self.mock_db, new_filters, self.limit_val)

        def limit(self, val):
            return MockQuery(self.collection_path, self.mock_db, self.filters, val)

        def stream(self):
            docs = self.mock_db.get_collection_docs(self.collection_path)
            matching = []
            for doc_id, data in docs.items():
                match = True
                for field, op, val in self.filters:
                    field_val = data.get(field)
                    if op == '==':
                        if field_val != val:
                            match = False
                            break
                    elif op == 'in':
                        if (val is None) or (field_val not in val):
                            match = False
                            break
                if match:
                    matching.append(MockDocumentSnapshot(doc_id, data))
            
            if self.limit_val is not None:
                matching = matching[:self.limit_val]
            return matching

        def get(self):
            return self.stream()

    class MockCollectionReference:
        def __init__(self, collection_path, mock_db):
            self.collection_path = collection_path
            self.mock_db = mock_db

        def document(self, doc_id):
            return MockDocumentReference(self.collection_path, doc_id, self.mock_db)

        def add(self, data):
            doc_id = str(uuid.uuid4())
            self.mock_db.write_doc(self.collection_path, doc_id, data)
            return None, MockDocumentReference(self.collection_path, doc_id, self.mock_db)

        def where(self, field, op, val):
            return MockQuery(self.collection_path, self.mock_db).where(field, op, val)

        def limit(self, val):
            return MockQuery(self.collection_path, self.mock_db).limit(val)

        def stream(self):
            return MockQuery(self.collection_path, self.mock_db).stream()

        def get(self):
            return self.stream()

    class MockFirestoreClient:
        def __init__(self, filepath="mock_db.json"):
            self.filepath = filepath
            self._data = {}
            self.load()

        def load(self):
            if os.path.exists(self.filepath):
                try:
                    with open(self.filepath, 'r', encoding='utf-8') as f:
                        self._data = json.load(f)
                except Exception:
                    self._data = {}
            else:
                self._data = {}

        def save(self):
            try:
                with open(self.filepath, 'w', encoding='utf-8') as f:
                    json.dump(self._data, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print("Failed to save mock database:", e)

        def collection(self, name):
            return MockCollectionReference(name, self)

        def get_collection_docs(self, collection):
            return self._data.get(collection, {})

        def read_doc(self, collection, doc_id):
            return self._data.get(collection, {}).get(doc_id)

        def write_doc(self, collection, doc_id, data):
            if collection not in self._data:
                self._data[collection] = {}
            serializable_data = {}
            for k, v in data.items():
                if v == firestore.SERVER_TIMESTAMP or str(v) == 'SentinelValues.SERVER_TIMESTAMP' or v is None or 'SERVER_TIMESTAMP' in str(v):
                    serializable_data[k] = datetime.utcnow().isoformat() + 'Z'
                elif hasattr(v, 'isoformat'):
                    serializable_data[k] = v.isoformat()
                else:
                    serializable_data[k] = v
            self._data[collection][doc_id] = serializable_data
            self.save()

        def update_doc(self, collection, doc_id, data):
            if collection in self._data and doc_id in self._data[collection]:
                for k, v in data.items():
                    if v == firestore.SERVER_TIMESTAMP or str(v) == 'SentinelValues.SERVER_TIMESTAMP' or v is None or 'SERVER_TIMESTAMP' in str(v):
                        self._data[collection][doc_id][k] = datetime.utcnow().isoformat() + 'Z'
                    elif hasattr(v, 'isoformat'):
                        self._data[collection][doc_id][k] = v.isoformat()
                    else:
                        self._data[collection][doc_id][k] = v
                self.save()

        def delete_doc(self, collection, doc_id):
            if collection in self._data and doc_id in self._data[collection]:
                del self._data[collection][doc_id]
                self.save()

    db = MockFirestoreClient()

# Definiowanie mocka AI
MOCK_TRANSLATIONS = {
    "technology": "technologia",
    "future": "przyszłość",
    "science": "nauka",
    "history": "historia",
    "fantasy": "fantastyka",
    "mystery": "tajemnica",
    "adventure": "przygoda",
    "discovery": "odkrycie",
    "innovation": "innowacja",
    "nature": "natura",
    "space": "kosmos",
    "ai": "sztuczna inteligencja",
    "biography": "biografia",
    "business": "biznes",
    "psychology": "psychologia",
    "art": "sztuka",
    "music": "muzyka",
    "travel": "podróże",
    "hello": "witaj",
    "world": "świat",
    "book": "książka",
    "school": "szkoła",
    "teacher": "nauczyciel",
    "student": "uczeń",
    "english": "angielski"
}

def generate_mock_ai_content(user_prompt, system_prompt=""):
    import re
    import json
    
    user_prompt_lower = user_prompt.lower()
    
    # Joke Explanation Mock
    if "stand-up" in user_prompt_lower or "explain-joke" in user_prompt_lower or "wyjaśnij poniższy fragment ze stand-upu" in user_prompt_lower:
        if "target" in user_prompt_lower or "hoarder" in user_prompt_lower or "boyfriend" in user_prompt_lower:
            return json.dumps({
                "literal_meaning": "Jestem w związku. Układa się dobrze, ale myślę, że mój chłopak po kryjomu chomikuje torby z Targetu...",
                "cultural_context": "Target to popularna w USA sieć wielobranżowych supermarketów. Charakterystyczne czerwono-białe plastikowe torby z Targetu często gromadzą się w amerykańskich domach i są symbolem impulsywnych, niepotrzebnych zakupów.",
                "wordplay": "Humor opiera się na kontraście: związek układa się dobrze, ale jedynym sekretem partnera jest komiczne 'chomikowanie' (hoarding) zwykłych toreb na zakupy, co jest drobnym, nieszkodliwym dziwactwem w porównaniu do prawdziwych problemów w związkach.",
                "sarcasm": "Ton jest lekki, anegdotyczny i lekko wyolbrzymiony. Taylor Tomlinson używa autoironii, opisując codzienne życie.",
                "explanation": "Taylor Tomlinson żartuje z powszechnego nawyku gromadzenia plastikowych reklamówek ze znanego sklepu. Słowo 'hoarder' (zbieracz/chomik) zazwyczaj kojarzy się z chorobliwym zbieractwem, ale tutaj odnosi się do niewinnego, codziennego zwyczaju jej chłopaka."
            }, ensure_ascii=False)
        elif "golf" in user_prompt_lower or "crooked" in user_prompt_lower or "stick" in user_prompt_lower:
            return json.dumps({
                "literal_meaning": "Oto gra, w której uderzasz piłkę do kieszeni stołu bilardowego, ale ta kieszeń jest oddalona o 400 jardów i robisz to za pomocą zakrzywionego kija!",
                "cultural_context": "Robin Williams parodiuje szkockie pochodzenie golfa. Przedstawia go z perspektywy rzekomego pijanego Szkota wymyślającego najbardziej absurdalne zasady sportowe na świecie.",
                "wordplay": "Williams nazywa dołek golfowy 'kieszenią stołu bilardowego' (pool table pocket), a kij golfowy 'zakrzywionym patykiem' (crooked stick), aby ośmieszyć elegancję i powagę przypisywaną dziś golfowi.",
                "sarcasm": "Maksymalna ekspresja, wysoka energia, gwałtowne przejścia tonalne i charakterystyczny szkocki akcent.",
                "explanation": "Klip w komiczny sposób odziera golf z aury elitarności i sportowej powagi, ukazując jego podstawowe mechaniki jako skrajnie nielogiczne i frustrujące."
            }, ensure_ascii=False)
        elif "america" in user_prompt_lower or "good" in user_prompt_lower or "bragging" in user_prompt_lower or "south africa" in user_prompt_lower:
            return json.dumps({
                "literal_meaning": "W Ameryce ludzie mówią 'I'm good' w znaczeniu 'Nie, dziękuję'. W Afryce Południowej, jeśli powiesz 'I'm good', myślą, że chwalisz się swoim życiem!",
                "cultural_context": "Trevor Noah, pochodzący z RPA, porównuje amerykańskie konwencje językowe z południowoafrykańskimi. Wskazuje na kulturowe różnice w interpretacji z pozoru prostych zwrotów.",
                "wordplay": "Gra słów opiera się na wieloznaczności zwrotu 'I'm good'. W USA to grzecznościowa odmowa, a dosłownie w innych krajach anglojęzycznych może brzmieć jak przechwałka: 'U mnie wszystko świetnie'.",
                "sarcasm": "Żartobliwy ton, imitacja zdziwienia amerykańskim stylem bycia.",
                "explanation": "Trevor Noah pokazuje, jak te same angielskie słowa mogą prowadzić do nieporozumień w zależności od kraju i kultury."
            }, ensure_ascii=False)
        elif "solomon" in user_prompt_lower or "gold" in user_prompt_lower or "spam" in user_prompt_lower or "james" in user_prompt_lower or "reply" in user_prompt_lower:
            return json.dumps({
                "literal_meaning": "Kilka lat temu otrzymałem e-mail od faceta o imieniu Solomon. I napisał: 'Mam dla Ciebie interesującą propozycję dotyczącą złota'.",
                "cultural_context": "Żart odnosi się do powszechnych w internecie tzw. 'nigeryjskich przekrętów' (419 scams), w których oszuści obiecują ogromne bogactwa (np. złoto lub spadki) w zamian za drobne opłaty. Zamiast zignorować spam, James Veitch postanawia podjąć grę.",
                "wordplay": "Humor opiera się na tym, jak dosłownie i poważnie komik traktuje oczywiste oszustwo internetowe, co doprowadza oszusta do frustracji.",
                "sarcasm": "Lekki, anegdotyczny ton z elementami absurdu i wesołej naiwności.",
                "explanation": "James Veitch w komiczny sposób opisuje swoją korespondencję ze spamerem, zamieniając irytujący element codziennego życia w zabawną, absurdalną historię."
            }, ensure_ascii=False)
        elif "argument" in user_prompt_lower or "room" in user_prompt_lower or "monty" in user_prompt_lower or "python" in user_prompt_lower:
            return json.dumps({
                "literal_meaning": "Czy to jest właściwy pokój na kłótnię? Powiedziałem ci już raz. Nie, nie powiedziałeś! Tak, powiedziałem.",
                "cultural_context": "Klinika Kłótni (Argument Clinic) to słynny skecz Monty Pythona z 1972 roku. Przedstawia absurdalny świat, w którym ludzie płacą za profesjonalne kłótnie, obelgi czy narzekanie.",
                "wordplay": "Skecz satyrycznie ukazuje definicję kłótni. Rozmówca twierdzi, że kłótnia to nie jest zwykłe zaprzeczanie ('Argument is a connected series of statements to establish a definite proposition. It isn't just saying no it isn't!').",
                "sarcasm": "Klasyczna brytyjska ironia, formalny i poważny ton zestawiony z kompletnie absurdalną sytuacją.",
                "explanation": "Monty Python wyśmiewa ludzką skłonność do sporów oraz biurokrację, pokazując kłótnię jako komercyjną usługę."
            }, ensure_ascii=False)
        elif "teenager" in user_prompt_lower or "grunt" in user_prompt_lower or "jeff" in user_prompt_lower or "allen" in user_prompt_lower:
            return json.dumps({
                "literal_meaning": "Mam dwóch synów, są teraz nastolatkami. Jeśli masz nastolatków, wiesz o czym mówię. Oni nie mówią, tylko chrząkają.",
                "cultural_context": "Jeff Allen odnosi się do uniwersalnego archetypu milczącego i zbuntowanego nastolatka, który komunikuje się z rodzicami wyłącznie monosylabami i chrząknięciami (grunts).",
                "wordplay": "Komik używa dźwiękonaśladowczego słowa 'grunt' (chrząknięcie/mruknięcie), aby opisać cały zasób słownictwa dorastającego chłopca.",
                "sarcasm": "Ton zmęczonego, acz kochającego rodzica, posługującego się humorem obserwacyjnym i życiową mądrością.",
                "explanation": "Żart wywołuje natychmiastowe porozumienie z widzami będącymi rodzicami, którzy rozpoznają to zachowanie u własnych dzieci."
            }, ensure_ascii=False)
        elif "unsubscribe" in user_prompt_lower or "duck" in user_prompt_lower or "agony" in user_prompt_lower:
            return json.dumps({
                "literal_meaning": "To jest agonia próby wypisania się z subskrypcji. Otrzymałem e-mail z supermarketu...",
                "cultural_context": "Żart opowiada o frustrującej i niemal niemożliwej procedurze wypisania się z listy mailingowej (unsubscribe). James Veitch przekształca nudny proces biurokratyczny w absurdalną grę z działem obsługi klienta.",
                "wordplay": "Humor opiera się na wyolbrzymianiu małych problemów dnia codziennego (spam marketingowy) do rangi wielkiej egzystencjalnej bitwy.",
                "sarcasm": "Sarkastyczny, zirytowany, ale jednocześnie bardzo wesoły ton.",
                "explanation": "Komik opisuje, jak frustracja związana ze spamem handlowym przerodziła się w tygodniową korespondencję na temat gumowej kaczki, obnażając bezduszność automatycznych systemów obsługi klienta."
            }, ensure_ascii=False)
        else:
            return json.dumps({
                "literal_meaning": "Dosłowne znaczenie analizowanego fragmentu stand-upu.",
                "cultural_context": "Kontekst kulturowy i odniesienia specyficzne dla krajów anglojęzycznych (np. popularne marki, zwyczaje lub postacie).",
                "wordplay": "Gra słów, dwuznaczność lub humorystyczne skojarzenia użyte w tym fragmencie.",
                "sarcasm": "Ocena stopnia sarkazmu, ironii i sposobu wypowiedzi komika.",
                "explanation": "Pełne objaśnienie dlaczego ta linijka jest zabawna i co mówi nam o języku oraz kulturze."
            }, ensure_ascii=False)

    # 0a. Generate Summary Report Mock
    if "activity_log" in user_prompt_lower or "student's learning session" in system_prompt.lower() or "generate-summary" in user_prompt_lower:
        return json.dumps({
            "listening_analysis": {
                "completed_entire_text": True,
                "sentences_listened": 12,
                "total_sentences": 12,
                "feedback_pl": "Świetna robota! Odsłuchałeś całe opowiadanie, dbając o przyswojenie pełnego kontekstu tekstu."
            },
            "engagement_analysis": {
                "level": "Wysokie",
                "dictionary_checks_count": 5,
                "saved_words_count": 2,
                "feedback_pl": "Bardzo wysoka aktywność. Sprawdzałeś definicje w podręcznym słowniku i dodawałeś nowe wyrażenia, co stymuluje pamięć długotrwałą."
            },
            "pronunciation_drills": [
                {
                    "word": "Curse of Knowledge",
                    "translation": "Przekleństwo wiedzy",
                    "example": "To communicate effectively, leaders must overcome the curse of knowledge.",
                    "times_listened": 3,
                    "was_mispronounced": true
                }
            ],
            "vocabulary_analysis": {
                "added_words": ["fluency", "biography"],
                "forgotten_words": [
                    {
                        "word": "curiosity",
                        "translation": "ciekawość",
                        "example": "Curiosity is the fuel for effective language acquisition.",
                        "reason_pl": "To słowo było sprawdzane lub odsłuchiwane w tej sesji kilkukrotnie, lecz nie zapisałeś go do notesu."
                    }
                ]
            }
        }, ensure_ascii=False)

    # 0. Explain Word / Phrase
    if "detailed dictionary entry" in user_prompt_lower or "explain-word" in user_prompt_lower:
        match = re.search(r"English word or phrase '([^']+)'", user_prompt, re.IGNORECASE)
        word = match.group(1) if match else "word"
        
        # Determine if it is a phrase
        is_phrase = len(word.split()) > 1
        
        if is_phrase:
            meanings = [
                {
                    "partOfSpeech": "phrase",
                    "definition_en": f"A common English phrase meaning: {word}.",
                    "definition_pl": f"Popularne angielskie wyrażenie oznaczające: {word} (tłumaczenie).",
                    "examples": [
                        {
                            "en": f"You should try to use '{word}' in a sentence.",
                            "pl": f"Powinieneś spróbować użyć '{word}' w zdaniu."
                        }
                    ]
                }
            ]
            phonetic = "N/A"
        else:
            meanings = [
                {
                    "partOfSpeech": "noun",
                    "definition_en": f"A single meaningful element of speech: {word}.",
                    "definition_pl": f"Odrębny i znaczący element mowy: {word}.",
                    "examples": [
                        {
                            "en": f"This is an example of the word '{word}'.",
                            "pl": f"To jest przykład słowa '{word}'."
                        }
                    ]
                },
                {
                    "partOfSpeech": "verb",
                    "definition_en": f"To perform an action related to: {word}.",
                    "definition_pl": f"Wykonywać czynność związaną z: {word}.",
                    "examples": [
                        {
                            "en": f"Can you '{word}' this for me?",
                            "pl": f"Czy możesz to '{word}' dla mnie?"
                        }
                    ]
                }
            ]
            phonetic = f"/{word} IPA/"
            
        return json.dumps({
            "word": word,
            "phonetic": phonetic,
            "direct_translations": [f"{word} (tłumaczenie)"],
            "meanings": meanings
        }, ensure_ascii=False)

    # 1. Translate
    elif "translate the english word" in user_prompt_lower:
        match = re.search(r"Translate the English word or phrase '([^']+)'", user_prompt, re.IGNORECASE)
        word = match.group(1) if match else "hello"
        translation = MOCK_TRANSLATIONS.get(word.lower().strip(), f"{word} (tłumaczenie)")
        return translation
        
    # 2. Grammar Analysis
    elif "wyszukaj trzy różne" in user_prompt_lower or "analyze-grammar" in user_prompt_lower:
        analysis = [
            {
                "title": "Past Simple",
                "example_sentence": "She walked to the school yesterday.",
                "explanation": "Czas Past Simple służy do opisywania zakończonych czynności w przeszłości."
            },
            {
                "title": "Present Continuous",
                "example_sentence": "He is learning English right now.",
                "explanation": "Czas Present Continuous wyraża czynności odbywające się w tym momencie."
            },
            {
                "title": "Modal Verbs",
                "example_sentence": "You must practice every day.",
                "explanation": "Czasownik modalny 'must' oznacza konieczność lub obowiązek."
            }
        ]
        return json.dumps(analysis, ensure_ascii=False)
        
    # 3. Mastery Prepare
    elif "split the following english text into logical" in user_prompt_lower or "mastery_prompt" in user_prompt_lower or "mastery-prepare" in user_prompt_lower:
        match = re.search(r'Text to analyze:\s*"(.*?)"', user_prompt, re.DOTALL)
        text = match.group(1) if match else "Welcome to AI English Buddy. Let's learn English together."
        
        sentences = [s.strip() for s in text.split('.') if s.strip()]
        results = []
        for s in sentences:
            words = s.split()
            segments = []
            for i in range(0, len(words), 4):
                segments.append(" ".join(words[i:i+4]))
            
            translation = s
            s_lower = s.lower()
            if "welcome" in s_lower:
                translation = "Witaj w AI English Buddy."
            elif "learn" in s_lower:
                translation = "Uczmy się angielskiego razem."
            else:
                translation = f"{s} (Tłumaczenie)"
                
            results.append({
                "en": s + ".",
                "pl": translation,
                "segments": segments
            })
        return json.dumps(results, ensure_ascii=False)
        
    # 4. Mastery Evaluate
    elif "evaluate the student's pronunciation" in user_prompt_lower or "evaluation_prompt" in user_prompt_lower:
        target_match = re.search(r'Target:\s*"(.*?)"', user_prompt)
        trans_match = re.search(r'Transcription:\s*"(.*?)"', user_prompt)
        original_text = target_match.group(1) if target_match else ""
        transcription = trans_match.group(1) if trans_match else ""
        
        target_words = re.findall(r'\b[a-zA-Z]{3,}\b', original_text.lower())
        trans_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', transcription.lower()))
        mispronounced = [w for w in target_words if w not in trans_words]
        
        if target_words:
            intersection = set(target_words).intersection(trans_words)
            score = int((len(intersection) / len(set(target_words))) * 100)
        else:
            score = 100
        score = max(50, min(100, score))
        
        corrections = "Brak błędów" if score > 85 else f"Zwróć uwagę na wymowę słów: {', '.join(mispronounced)}."
        tip = "Bardzo ładne tempo i intonacja." if score > 85 else "Spróbuj mówić wyraźniej i głośniej."
        
        return json.dumps({
            "score": score,
            "transcription": transcription,
            "corrections": corrections,
            "tip": tip,
            "mispronounced_words": mispronounced
        }, ensure_ascii=False)
        
    # 5. Generate Questions
    elif "comprehension questions in english" in user_prompt_lower:
        return json.dumps([
            {"question": "What is the main topic of the story?"},
            {"question": "Who is the protagonist of the story?"},
            {"question": "What did they learn at the end?"}
        ], ensure_ascii=False)
        
    # 6. Evaluate Answer
    elif "comprehension question about a story" in user_prompt_lower:
        return json.dumps({
            "is_correct": True,
            "score": 90,
            "feedback": "Twoja odpowiedź jest poprawna i odnosi się do pytania."
        }, ensure_ascii=False)
        
    # 7. Chat Next
    elif "holding a voice-based conversation" in system_prompt.lower() or "voice-based conversation" in user_prompt_lower:
        trans_match = re.search(r'Latest Student\'s Answer:\s*"(.*?)"', user_prompt)
        transcription = trans_match.group(1) if trans_match else ""
        return json.dumps({
            "user_evaluation": {
                "score": 95,
                "is_correct": True,
                "feedback": "Great job answering that question."
            } if transcription else None,
            "bot_response": "What did the main character do next in the story?"
        }, ensure_ascii=False)
        
    # 8a. Generate Story Continuation
    elif "write the next part" in user_prompt_lower or "story so far" in user_prompt_lower:
        part_match = re.search(r"write the next part \(part (\d+)\)", user_prompt_lower)
        part_num = part_match.group(1) if part_match else "2"
        
        protagonist = "Alex"
        prot_match = re.search(r"protagonist name: The main character MUST be named '([^']+)'", user_prompt, re.IGNORECASE)
        if prot_match:
            protagonist = prot_match.group(1)
            
        topics = []
        for t in PREDEFINED_TOPICS:
            if t.lower() in user_prompt_lower:
                topics.append(t)
                
        title = f"Chapter {part_num}: The Adventure Continues"
        story = f"In Part {part_num} of the story, {protagonist} continued the journey. " \
                f"Armed with new insights about {', '.join(topics) if topics else 'English'}, {protagonist} faced new challenges. " \
                f"Every challenge was a learning opportunity that highlighted interesting grammar and phrasal verbs. " \
                f"This is a mocked continuation of the story, generated locally for Part {part_num}."
                
        return json.dumps({
            "title": title,
            "story": story
        }, ensure_ascii=False)
        
    # 8b. Popular Science / Cognitive Bias Mock
    elif "popular science" in user_prompt_lower or "cognitive bias" in user_prompt_lower:
        title = "The Curse of Knowledge: The Paradox of Expertise"
        story = (
            "Yesterday, we discussed the Ostrich Effect and how pulling your head out of the sand "
            "allows you to transform uncomfortable feedback into a powerful roadmap for your fluency. "
            "Today, we turn our attention to a communication barrier that arises not from a lack of "
            "information, but from an abundance of it: The Curse of Knowledge. This cognitive bias "
            "occurs when an individual, having thoroughly mastered a specific topic, finds it genuinely "
            "impossible to judge a situation from the perspective of a less-informed person. Once you "
            "acquire a piece of information or develop a complex skill, your brain automatically alters "
            "its default settings, mistakenly assuming that what is obvious to you must be equally "
            "transparent and intuitive to everyone else.\n\n"
            "In the realm of language acquisition, the Curse of Knowledge creates a frustrating divide "
            "when advanced learners try to explain professional or technical concepts in English. When "
            "you reach a high level of vocabulary within your specific industry, you might completely "
            "forget how dense, abstract, and confusing that terminology sounds to a colleague from a "
            "different department or a client who is a non-native beginner. You assume they grasp the "
            "underlying context simply because it feels like second nature to you. To overcome this "
            "curse and achieve true executive presence, you must deliberately practice the art of "
            "translation and simplification. True fluency is not just about commanding a vast library "
            "of complex jargon; it is about having the agility to adjust your linguistic framework so "
            "that your message lands with absolute clarity, regardless of your listener's background."
        )
        return json.dumps({
            "title": title,
            "story": story
        }, ensure_ascii=False)
        
    # 8. Generate Story (default)
    else:
        topics = []
        for t in PREDEFINED_TOPICS:
            if t.lower() in user_prompt_lower:
                topics.append(t)
        
        protagonist = "Alex"
        prot_match = re.search(r"protagonist name: The main character MUST be named '([^']+)'", user_prompt, re.IGNORECASE)
        if prot_match:
            protagonist = prot_match.group(1)
            
        title = f"The Journey of {protagonist}"
        if topics:
            title += f" through {', '.join(topics)}"
            
        story = f"Once upon a time, {protagonist} was thinking about the wonders of {', '.join(topics) if topics else 'the world'}. " \
                f"With a curious mind, {protagonist} embarked on a lifetime adventure. " \
                f"Every step brought new lessons, phrasal verbs to use, and idioms to learn. " \
                f"At the end of the day, {protagonist} realized that learning English was the key to unlocking these mysteries. " \
                f"This is a mocked educational story generated locally because no API keys were configured in your .env file."
                
        return json.dumps({
            "title": title,
            "story": story
        }, ensure_ascii=False)

class MockChatCompletionMessage:
    def __init__(self, content):
        self.content = content

class MockChatCompletionChoice:
    def __init__(self, content):
        self.message = MockChatCompletionMessage(content)

class MockChatCompletionResponse:
    def __init__(self, content):
        self.choices = [MockChatCompletionChoice(content)]

class MockCompletions:
    def create(self, model, messages, response_format=None):
        user_prompt = messages[-1]["content"] if messages else ""
        system_prompt = messages[0]["content"] if len(messages) > 1 and messages[0]["role"] == "system" else ""
        mock_content = generate_mock_ai_content(user_prompt, system_prompt)
        return MockChatCompletionResponse(mock_content)

class MockChat:
    def __init__(self):
        self.completions = MockCompletions()

class MockOpenAIClient:
    def __init__(self):
        self.chat = MockChat()

# Klient OpenAI / DeepSeek
client = None
openai_client = None
deepseek_client = None
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")

if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    print("Klient OpenAI (wewnętrzny) zainicjalizowany.")

if DEEPSEEK_API_KEY:
    deepseek_client = OpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url="https://api.deepseek.com"
    )
    print("Klient DeepSeek (wewnętrzny) zainicjalizowany.")

if OPENAI_API_KEY:
    client = openai_client
    print("Klient OpenAI zainicjalizowany.")
    MODEL_NAME = "gpt-4o-mini"
    API_URL = "https://api.openai.com/v1/chat/completions"
    API_TOKEN = OPENAI_API_KEY
elif DEEPSEEK_API_KEY:
    client = deepseek_client
    print("Klient DeepSeek zainicjalizowany.")
    MODEL_NAME = "deepseek-chat"
    API_URL = "https://api.deepseek.com/chat/completions"
    API_TOKEN = DEEPSEEK_API_KEY
else:
    print("OSTRZEŻENIE: Brak klucza OPENAI_API_KEY lub DEEPSEEK_API_KEY w .env. Używam lokalnego mocka AI.")
    MODEL_NAME = "gpt-4o-mini"
    API_URL = "https://api.openai.com/v1/chat/completions"
    API_TOKEN = ""
    client = MockOpenAIClient()

import secrets

def hash_password(password):
    # Standard, secure salt and sha256
    salt = "ai_buddy_secret_salt_123!"
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

def get_audio_content_type(audio_file):
    filename = audio_file.filename.lower() if audio_file.filename else ""
    if filename.endswith(".m4a") or filename.endswith(".aac"):
        return "audio/x-m4a"
    elif filename.endswith(".mp3"):
        return "audio/mpeg"
    elif filename.endswith(".wav"):
        return "audio/wav"
    elif filename.endswith(".webm"):
        return "audio/webm"
    elif filename.endswith(".ogg"):
        return "audio/ogg"
    elif filename.endswith(".mp4"):
        return "audio/mp4"
    return audio_file.content_type or "audio/webm"

def get_user_from_request():
    if 'db' not in globals() or db is None:
        return None
    token = request.headers.get("X-Session-Token")
    if not token:
        return None
    try:
        session_ref = db.collection('sessions').document(token).get()
        if session_ref.exists:
            session_data = session_ref.to_dict()
            return session_data.get("email")
    except Exception as e:
        print(f"Błąd weryfikacji sesji: {e}")
    return None

@app.route("/api/register", methods=['POST'])
def register():
    if 'db' not in globals() or db is None:
        return jsonify({"error": "Baza danych nie jest dostępna"}), 500
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email i hasło są wymagane"}), 400

    try:
        # Sprawdź czy użytkownik istnieje
        user_ref = db.collection('users').document(email).get()
        if user_ref.exists:
            return jsonify({"error": "Użytkownik o tym adresie email już istnieje"}), 400

        # Zapisz użytkownika
        pw_hash = hash_password(password)
        db.collection('users').document(email).set({
            'email': email,
            'password_hash': pw_hash,
            'created_at': firestore.SERVER_TIMESTAMP
        })

        # Utwórz sesję
        token = secrets.token_hex(32)
        db.collection('sessions').document(token).set({
            'email': email,
            'created_at': firestore.SERVER_TIMESTAMP
        })

        return jsonify({"token": token, "email": email}), 201
    except Exception as e:
        print(f"Błąd rejestracji: {e}")
        return jsonify({"error": f"Błąd serwera podczas rejestracji: {e}"}), 500

@app.route("/api/login", methods=['POST'])
def login():
    if 'db' not in globals() or db is None:
        return jsonify({"error": "Baza danych nie jest dostępna"}), 500
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email i hasło są wymagane"}), 400

    try:
        user_ref = db.collection('users').document(email).get()
        if not user_ref.exists:
            return jsonify({"error": "Niepoprawny email lub hasło"}), 401

        user_data = user_ref.to_dict()
        pw_hash = hash_password(password)

        if user_data.get("password_hash") != pw_hash:
            return jsonify({"error": "Niepoprawny email lub hasło"}), 401

        # Utwórz sesję
        token = secrets.token_hex(32)
        db.collection('sessions').document(token).set({
            'email': email,
            'created_at': firestore.SERVER_TIMESTAMP
        })

        return jsonify({"token": token, "email": email}), 200
    except Exception as e:
        print(f"Błąd logowania: {e}")
        return jsonify({"error": f"Błąd serwera podczas logowania: {e}"}), 500

@app.route("/api/logout", methods=['POST'])
def logout():
    if 'db' not in globals() or db is None:
        return jsonify({"error": "Baza danych nie jest dostępna"}), 500
    token = request.headers.get("X-Session-Token")
    if token:
        try:
            db.collection('sessions').document(token).delete()
        except Exception as e:
            print(f"Błąd podczas wylogowywania: {e}")
    return jsonify({"message": "Wylogowano pomyślnie"}), 200

# --- KONFIGURACJA EMAIL (ZMIENNE ŚRODOWISKOWE) ---
EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USERNAME = os.getenv("EMAIL_USERNAME")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

# Sprawdzanie, czy zmienne email są załadowane
if not all([EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD]):
    print("OSTRZEŻENIE: Brak pełnej konfiguracji EMAIL w .env. Funkcja wysyłania e-maili może nie działać.")
    # Możesz tu np. wyłączyć endpoint wysyłania e-maili, jeśli wolisz.


API_TOKEN = API_TOKEN
API_URL = API_URL
headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

PREDEFINED_TOPICS = [
    "Technology", "Future", "Science", "History", "Fantasy", "Mystery",
    "Adventure", "Discovery", "Innovation", "Nature", "Space", "AI",
    "Biography", "Business", "Psychology", "Art", "Music", "Travel"
]

def query_deepseek(prompt_text):
    if not API_TOKEN:
        mock_content = generate_mock_ai_content(prompt_text)
        return {
            "choices": [
                {
                    "message": {
                        "content": mock_content
                    }
                }
            ]
        }
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "user", "content": prompt_text}
        ]
    }
    response = requests.post(API_URL, headers=headers, json=payload)
    response.raise_for_status()
    return response.json()


def query_deepseek_with_system(system_prompt, user_prompt):
    if not API_TOKEN:
        mock_content = generate_mock_ai_content(user_prompt, system_prompt)
        return {
            "choices": [
                {
                    "message": {
                        "content": mock_content
                    }
                }
            ]
        }
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    }
    response = requests.post(API_URL, headers=headers, json=payload)
    response.raise_for_status()
    return response.json()

@app.route("/api/get-topics", methods=['GET'])
def get_topics():
    sampled_topics = random.sample(PREDEFINED_TOPICS, 5)
    return jsonify(sampled_topics)

@app.route("/api/translate", methods=['POST'])
def translate_text():
    data = request.get_json()
    text_to_translate = data.get("text")
    context_sentence = data.get("context")
    if not text_to_translate:
        return jsonify({"error": "Brak tekstu do tłumaczenia"}), 400

    if context_sentence:
        translation_prompt = (
            f"You are a precise English-to-Polish translator and lexicographer.\n"
            f"Translate the English word or phrase '{text_to_translate}' into Polish, "
            f"ensuring it perfectly fits the grammatical form and meaning in the context of this sentence:\n"
            f"\"{context_sentence}\"\n\n"
            f"Provide the exact contextual translation first on the first line. Do not prefix it with any label.\n"
            f"If the word or phrase has other common, distinct meanings in Polish, list them on the second line separated only by commas, like:\n"
            f"meaning1, meaning2\n"
            f"Do not include any prefix like 'Inne znaczenia' or 'Other meanings'. Just the comma-separated meanings.\n"
            f"If there are no other common meanings, do not include the second line.\n"
            f"Respond ONLY with the translation text, without any markdown formatting, code blocks, or extra text."
        )
    else:
        translation_prompt = (
            f"Translate the English word or phrase '{text_to_translate}' into Polish.\n"
            f"Provide the most common translation first on the first line. Do not prefix it with any label.\n"
            f"If the word or phrase has other common, distinct meanings in Polish, list them on the second line separated only by commas, like:\n"
            f"meaning1, meaning2\n"
            f"Do not include any prefix like 'Inne znaczenia' or 'Other meanings'. Just the comma-separated meanings.\n"
            f"If there are no other common meanings, do not include the second line.\n"
            f"Respond ONLY with the translation text, without any markdown formatting, code blocks, or extra text."
        )
    
    try:
        output_data = query_deepseek(translation_prompt)
        translated_text = output_data['choices'][0]['message']['content']
        
        translated_text = translated_text.strip()
        lines = [line.strip() for line in translated_text.split('\n') if line.strip()]
        cleaned_lines = []
        for line in lines:
            if line.lower().startswith("translation:"):
                line = line[len("translation:"):].strip()
            if line.lower().startswith("polish:"):
                line = line[len("polish:"):].strip()
            line = line.strip('\'" \t\n\r.?!')
            if line:
                cleaned_lines.append(line)
        translated_text = "\n".join(cleaned_lines)

        return jsonify({"translation": translated_text})
    except (KeyError, IndexError) as e:
        return jsonify({"error": "Nie udało się przetłumaczyć tekstu", "details": str(e), "api_response": output_data}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Błąd połączenia z DeepSeek API: {str(e)}"}), 500

@app.route("/api/explain-word", methods=['POST'])
def explain_word():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    data = request.get_json() or {}
    text_to_explain = data.get("text")
    if not text_to_explain:
        return jsonify({"error": "Brak tekstu do wyjaśnienia"}), 400

    explain_prompt = (
        f"Provide a detailed dictionary entry for the English word or phrase '{text_to_explain}'.\n"
        f"You must respond ONLY with a JSON object. Do not include any markdown styling like ```json or any other text before or after the JSON structure. Respond ONLY with valid JSON.\n\n"
        f"The JSON structure must match this example EXACTLY:\n"
        f"{{\n"
        f"  \"word\": \"{text_to_explain}\",\n"
        f"  \"phonetic\": \"/IPA_pronunciation/\",\n"
        f"  \"direct_translations\": [\"tłumaczenie1\", \"tłumaczenie2\"],\n"
        f"  \"meanings\": [\n"
        f"    {{\n"
        f"      \"partOfSpeech\": \"noun\",\n"
        f"      \"definition_en\": \"English explanation\",\n"
        f"      \"definition_pl\": \"Polish explanation\",\n"
        f"      \"examples\": [\n"
        f"        {{\n"
        f"          \"en\": \"Example sentence in English.\",\n"
        f"          \"pl\": \"Tłumaczenie przykładowego zdania na polski.\"\n"
        f"        }}\n"
        f"      ]\n"
        f"    }}\n"
        f"  ]\n"
        f"}}\n\n"
        f"Ensure that direct_translations contains 2-4 direct, concise, single-word (or very short) translations in Polish.\n"
        f"If the text is a phrase (multiple words) and does not have a single partOfSpeech or phonetic transcription, you can set phonetic to \"\" or \"N/A\", and partOfSpeech to \"phrase\".\n"
        f"Make sure to provide at least 1-2 meanings, and at least 1-2 high-quality example sentences for each meaning."
    )

    try:
        output_data = query_deepseek(explain_prompt)
        content = output_data['choices'][0]['message']['content'].strip()

        # Clean markdown code blocks if present
        if content.startswith('```json'):
            content = content[7:]
        elif content.startswith('```'):
            content = content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()

        parsed_json = json.loads(content)
        return jsonify(parsed_json)
    except json.JSONDecodeError as e:
        print(f"Błąd parsowania JSON z DeepSeek w explain-word: {content}. Error: {e}")
        return jsonify({"error": "AI zwróciło nieprawidłowy format słownika.", "raw_content": content}), 500
    except (KeyError, IndexError) as e:
        return jsonify({"error": "Nie udało się wyjaśnić tekstu", "details": str(e)}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Błąd połączenia z DeepSeek API: {str(e)}"}), 500

@app.route("/api/media/explain-joke", methods=['POST'])
def explain_joke():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    data = request.get_json() or {}
    text_to_explain = data.get("text")
    if not text_to_explain:
        return jsonify({"error": "Brak tekstu do wyjaśnienia"}), 400

    context_before = data.get("context_before", "")
    context_after = data.get("context_after", "")
    video_title = data.get("video_title", "")

    explain_prompt = (
        f"Analizujesz fragment z występu stand-upowego zatytułowanego: '{video_title}'.\n"
    )
    if context_before:
        explain_prompt += f"Poprzedzający kontekst wypowiedzi: '{context_before}'.\n"
    
    explain_prompt += f"Bieżący fragment do szczegółowego objaśnienia: '{text_to_explain}'.\n"
    
    if context_after:
        explain_prompt += f"Następujący kontekst wypowiedzi: '{context_after}'.\n"

    explain_prompt += (
        f"\nPrzeanalizuj i wyjaśnij bieżący fragment po polsku, biorąc pod uwagę podany kontekst i temat występu.\n"
        f"Musisz odpowiedzieć WYŁĄCZNIE obiektem JSON. Nie dołączaj żadnych znaczników markdown typu ```json ani żadnego innego tekstu przed lub po JSON. Odpowiedz TYLKO poprawnym JSON.\n\n"
        f"Struktura JSON musi dokładnie odpowiadać temu wzorowi:\n"
        f"{{\n"
        f"  \"literal_meaning\": \"Dosłowne znaczenie po polsku\",\n"
        f"  \"cultural_context\": \"Kontekst kulturowy, odniesienia społeczne lub popkulturowe w USA/UK po polsku (jeśli brak, wpisz 'Brak szczególnych odniesień kulturowych')\",\n"
        f"  \"wordplay\": \"Analiza gier słownych, dwuznaczności lub humoru po polsku (jeśli brak, wpisz 'Brak gry słów')\",\n"
        f"  \"sarcasm\": \"Informacja o tonie, stopniu sarkazmu, intonacji po polsku\",\n"
        f"  \"explanation\": \"Pełne wyjaśnienie humoru i sensu żartu w szerszym kontekście całej wypowiedzi po polsku\"\n"
        f"}}\n"
    )

    try:
        system_prompt = "Jesteś ekspertem od języka angielskiego, amerykańskiego humoru, slangu oraz popkultury. Twoim celem jest edukacyjne i zabawne wyjaśnienie fragmentów stand-upu."
        output_data = query_deepseek_with_system(system_prompt, explain_prompt)
        content = output_data['choices'][0]['message']['content'].strip()

        # Clean markdown code blocks if present
        if content.startswith('```json'):
            content = content[7:]
        elif content.startswith('```'):
            content = content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()

        parsed_json = json.loads(content)
        return jsonify(parsed_json)
    except json.JSONDecodeError as e:
        print(f"Błąd parsowania JSON z DeepSeek w explain-joke: {content}. Error: {e}")
        return jsonify({"error": "AI zwróciło nieprawidłowy format wyjaśnienia.", "raw_content": content}), 500
    except (KeyError, IndexError) as e:
        print(f"Błąd w explain-joke: {e}")
        return jsonify({"error": "Nie udało się wyjaśnić tekstu", "details": str(e)}), 500
    except requests.exceptions.RequestException as e:
        print(f"Błąd połączenia w explain-joke: {e}")
        return jsonify({"error": f"Błąd połączenia z DeepSeek API: {str(e)}"}), 500

def aggregate_transcript(entries):
    if not entries:
        return []
        
    aggregated = []
    current_entry = None
    
    # Common conjunctions and relative pronouns in English to avoid splitting clauses
    CONJUNCTIONS = {
        "and", "but", "or", "so", "because", "although", "though", "even", 
        "if", "when", "while", "since", "until", "unless", "before", "after",
        "that", "which", "who", "whom", "whose", "where", "as", "than", 
        "yet", "for", "nor"
    }

    for entry in entries:
        text = entry['text'].strip()
        start = entry['start']
        end = entry['end']
        
        if not text:
            continue
            
        # Check if the segment is just a sound effect / laughter / applause
        is_sound_effect = (
            (text.startswith('(') and text.endswith(')')) or 
            (text.startswith('[') and text.endswith(']'))
        )
        
        if is_sound_effect:
            if current_entry:
                aggregated.append(current_entry)
                current_entry = None
            aggregated.append({
                "start": start,
                "end": end,
                "text": text
            })
            continue

        if current_entry is None:
            current_entry = {
                "start": start,
                "end": end,
                "text": text
            }
        else:
            prev_text = current_entry['text']
            gap = start - current_entry['end']
            
            # 1. Terminal punctuation check (accounting for trailing quotes/parentheses)
            trimmed_prev = prev_text.strip().rstrip(')"\'')
            ends_with_punc = trimmed_prev[-1] in ('.', '?', '!') if trimmed_prev else False
            
            # 2. Conjunctions check to avoid splitting clauses
            # Extract words
            prev_words = re.findall(r'\b\w+\b', prev_text.lower())
            next_words = re.findall(r'\b\w+\b', text.lower())
            
            prev_ends_with_conjunction = prev_words[-1] in CONJUNCTIONS if prev_words else False
            next_starts_with_conjunction = next_words[0] in CONJUNCTIONS if next_words else False
            
            # 3. Capitalization check
            starts_with_cap = text[0].isupper() if text else False
            is_just_I = text == 'I' or text.startswith('I ')
            
            # 4. Comma check
            ends_with_comma = trimmed_prev[-1] in (',', ';', ':', '-') if trimmed_prev else False
            
            # Word counts
            prev_word_count = len(prev_text.split())
            
            # Decision rules:
            # - If previous ends with punctuation: split.
            # - If gap is huge (> 1.5 seconds): split.
            # - If previous ends in comma/conjunction or next starts with conjunction: do NOT split.
            # - If it's a huge sentence (> 20 words): split to keep readability.
            # - If starts with cap (not 'I'), and there's a decent pause (> 0.5s): split.
            # - Otherwise: do NOT split (merge).
            
            should_split = False
            if ends_with_punc:
                should_split = True
            elif gap > 1.5:
                should_split = True
            elif prev_ends_with_conjunction or next_starts_with_conjunction:
                should_split = False
            elif ends_with_comma:
                should_split = False
            elif prev_word_count > 20:
                should_split = True
            elif starts_with_cap and not is_just_I and gap > 0.5:
                should_split = True
            elif prev_word_count > 12 and gap > 0.8:
                should_split = True
                
            if should_split:
                aggregated.append(current_entry)
                current_entry = {
                    "start": start,
                    "end": end,
                    "text": text
                }
            else:
                current_entry['end'] = end
                # Check for hyphenated end or apostrophes
                if prev_text.endswith('-') or text.startswith('\''):
                    current_entry['text'] = prev_text + text
                else:
                    current_entry['text'] = prev_text + " " + text

    if current_entry:
        aggregated.append(current_entry)
        
    return aggregated

def semantic_group_transcript(entries):
    if not entries:
        return []
    
    if not API_TOKEN:
        print("Brak API_TOKEN. Używam domyślnej agregacji regułowej.")
        return aggregate_transcript(entries)

    # Przygotuj wpisy z indeksami
    indexed_entries = [{"id": i, "text": entry["text"], "start": entry["start"], "end": entry["end"]} for i, entry in enumerate(entries)]
    
    chunk_size = 60
    chunks = [indexed_entries[i:i+chunk_size] for i in range(0, len(indexed_entries), chunk_size)]
    
    system_prompt = (
        "You are an expert audio transcription editor. Your job is to take a list of sequential transcript segments "
        "(each with an 'id' and 'text') and group them strictly into single, complete sentences (from period to period).\n"
        "CRITICAL RULES:\n"
        "1. Each merged group MUST represent exactly ONE complete sentence. Every group MUST end with a final sentence punctuation mark ('.', '?', or '!').\n"
        "2. NEVER combine multiple complete sentences into a single group. Each sentence must have its own separate card.\n"
        "3. NEVER split a single sentence in half or into smaller parts. A sentence must always be kept 100% whole on a single card (from its beginning capital letter to its ending period/question/exclamation mark).\n"
        "4. Ensure proper punctuation and capitalization are added to the merged text.\n"
        "5. The IDs in each group must be consecutive and include all segments.\n"
        "Respond ONLY with a JSON array of objects, each containing:\n"
        "- 'ids': a list of integers representing the consecutive segment IDs merged to form this single sentence.\n"
        "- 'text': the punctuated and capitalized text for the sentence.\n"
        "Example:\n"
        "[\n"
        "  {\"ids\": [0, 1], \"text\": \"Hello, my name is John.\"},\n"
        "  {\"ids\": [2, 3], \"text\": \"How are you doing today?\"},\n"
        "  {\"ids\": [4], \"text\": \"I am doing great!\"}\n"
        "]\n"
        "Do not include any explanation or markdown formatting other than raw JSON."
    )

    def process_chunk(chunk, chunk_index):
        user_prompt = json.dumps([{"id": e["id"], "text": e["text"]} for e in chunk], ensure_ascii=False)
        try:
            response_data = query_deepseek_with_system(system_prompt, user_prompt)
            content = response_data["choices"][0]["message"]["content"].strip()
            
            # Oczyszczenie z markdown ```json ... ```
            if "```" in content:
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            content = content.strip()
            
            # Znalezienie granic tablicy JSON
            start_idx = content.find('[')
            end_idx = content.rfind(']')
            if start_idx != -1 and end_idx != -1:
                content = content[start_idx:end_idx+1]
            
            chunk_groups = json.loads(content)
            
            chunk_results = []
            for group in chunk_groups:
                g_ids = group.get("ids", [])
                g_text = group.get("text", "")
                if not g_ids:
                    continue
                    
                group_entries = [indexed_entries[idx] for idx in g_ids if 0 <= idx < len(indexed_entries)]
                if not group_entries:
                    continue
                    
                group_entries.sort(key=lambda x: x["start"])
                
                chunk_results.append({
                    "start": group_entries[0]["start"],
                    "end": group_entries[-1]["end"],
                    "text": g_text
                })
            return chunk_results
        except Exception as e:
            print(f"Błąd podczas semantycznego grupowania chunk {chunk_index}: {e}. Używam domyślnej agregacji dla tego fragmentu.")
            chunk_raw_entries = [{"text": e["text"], "start": e["start"], "end": e["end"]} for e in chunk]
            return aggregate_transcript(chunk_raw_entries)

    from concurrent.futures import ThreadPoolExecutor
    grouped_results = []
    
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(process_chunk, chunk, idx) for idx, chunk in enumerate(chunks)]
        for idx, future in enumerate(futures):
            try:
                chunk_results = future.result()
                grouped_results.extend(chunk_results)
            except Exception as fut_err:
                print(f"Błąd krytyczny wątku w chunk {idx}: {fut_err}")
                
    return grouped_results


def parse_srt(srt_text):
    import re
    entries = []
    srt_text = srt_text.replace('\r\n', '\n').replace('\r', '\n')
    blocks = re.split(r'\n\s*\n', srt_text.strip())
    for block in blocks:
        lines = [l.strip() for l in block.split('\n') if l.strip()]
        if len(lines) >= 3:
            # Pierwsza linia to indeks, druga to czas, kolejne to tekst
            time_line = lines[1]
            text_lines = lines[2:]
            match = re.match(r'(\d+):(\d+):(\d+)[,\.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,\.](\d+)', time_line)
            if match:
                sh, sm, ss, sms, eh, em, es, ems = map(int, match.groups())
                start = sh * 3600 + sm * 60 + ss + sms / 1000.0
                end = eh * 3600 + em * 60 + es + ems / 1000.0
                text = " ".join(text_lines).strip()
                entries.append({
                    "start": round(start, 2),
                    "end": round(end, 2),
                    "text": text
                })
    return entries

def parse_manual_transcript(raw_text):
    import re
    lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
    temp_entries = []
    
    def ts_to_secs(ts_str):
        try:
            parts = list(map(int, ts_str.split(':')))
            if len(parts) == 2:
                return parts[0] * 60 + parts[1]
            elif len(parts) == 3:
                return parts[0] * 3600 + parts[1] * 60 + parts[2]
        except Exception:
            pass
        return 0

    i = 0
    # Dopasowanie ciągów jak "0:03", "00:03", "1:02:03"
    ts_regex = r'^(\d{1,2}:)?\d{1,2}:\d{2}$'
    
    while i < len(lines):
        line = lines[i]
        if re.match(ts_regex, line):
            ts = ts_to_secs(line)
            text_parts = []
            i += 1
            while i < len(lines) and not re.match(ts_regex, lines[i]):
                text_parts.append(lines[i])
                i += 1
            text = " ".join(text_parts).strip()
            if text:
                temp_entries.append((ts, text))
        else:
            # Sprawdzenie znacznika w linii np. "0:03 Hello there"
            match = re.match(r'^([0-9\:]+)\s+(.*)$', line)
            first_word = line.split()[0] if line.split() else ""
            if match and re.match(ts_regex, first_word):
                ts = ts_to_secs(first_word)
                text = match.group(2).strip()
                temp_entries.append((ts, text))
                i += 1
            else:
                if temp_entries:
                    prev_ts, prev_text = temp_entries[-1]
                    temp_entries[-1] = (prev_ts, prev_text + " " + line)
                i += 1
                
    temp_entries.sort(key=lambda x: x[0])
    parsed = []
    for idx, (ts, text) in enumerate(temp_entries):
        start = float(ts)
        if idx < len(temp_entries) - 1:
            end = float(temp_entries[idx+1][0])
        else:
            end = start + 4.0
            
        if end <= start:
            end = start + 2.0
            
        parsed.append({
            "start": round(start, 2),
            "end": round(end, 2),
            "text": text
        })
        
    return parsed

@app.route("/api/media/transcript", methods=['GET'])
def get_youtube_transcript():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    video_id = request.args.get("video_id")
    if not video_id:
        return jsonify({"error": "Brak identyfikatora wideo"}), 400

    # Fetch title using oembed API
    video_title = f"Wideo YouTube ({video_id})"
    try:
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        response = requests.get(oembed_url, timeout=5)
        if response.ok:
            video_title = response.json().get("title", video_title)
    except Exception as e:
        print(f"Error fetching title for {video_id}: {e}")

    formatted = []
    
    # Try pytubefix first as it is less blocked by YouTube on cloud datacenter IPs (like Render)
    try:
        print(f"Attempting to fetch transcript using pytubefix for video {video_id}...", flush=True)
        from pytubefix import YouTube
        url = f"https://youtube.com/watch?v={video_id}"
        yt = YouTube(url, client='WEB')
        
        if video_title == f"Wideo YouTube ({video_id})":
            try:
                video_title = yt.title
            except Exception as title_err:
                print(f"Could not fetch title from pytubefix: {title_err}")
        
        # Try to find English captions
        caption = yt.captions.get('en') or yt.captions.get('a.en')
        if not caption:
            # Fallback: search for any caption that starts or ends with 'en'
            for c_code in yt.captions:
                if c_code.startswith('en') or c_code.endswith('.en'):
                    caption = yt.captions[c_code]
                    break
                    
        if caption:
            srt_data = caption.generate_srt_captions()
            formatted = parse_srt(srt_data)
            print(f"Successfully fetched {len(formatted)} segments using pytubefix.", flush=True)
        else:
            print(f"No English captions track found in pytubefix for {video_id}.", flush=True)
            
    except Exception as py_err:
        print(f"Pytubefix failed for {video_id}: {py_err}. Falling back to youtube-transcript-api...", flush=True)

    # Fallback to youtube-transcript-api if pytubefix failed or returned nothing
    if not formatted:
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            api = YouTubeTranscriptApi()
            transcript = api.fetch(video_id, languages=['en'])
            
            for entry in transcript:
                start = round(entry.start, 2)
                duration = round(entry.duration, 2)
                end = round(start + duration, 2)
                text = entry.text.replace('\n', ' ').strip()
                if text:
                    formatted.append({
                        "start": start,
                        "end": end,
                        "text": text
                    })
            print(f"Successfully fetched {len(formatted)} segments using youtube-transcript-api fallback.", flush=True)
        except Exception as e:
            print(f"Both methods failed for {video_id}: {e}", flush=True)
            return jsonify({
                "error": "Nie udało się pobrać transkrypcji dla tego filmu. Upewnij się, że film posiada angielskie napisy."
            }), 500

    try:
        aggregated = semantic_group_transcript(formatted)
        return jsonify({
            "video_id": video_id,
            "title": video_title,
            "transcript": aggregated
        })
    except Exception as group_err:
        print(f"Error semantic grouping transcript: {group_err}")
        return jsonify({
            "video_id": video_id,
            "title": video_title,
            "transcript": formatted
        })

@app.route("/api/media/transcript/debug", methods=['GET'])
def debug_youtube_transcript():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    video_id = request.args.get("video_id", "iJOb9xHggS4")
    
    debug_info = {}
    
    # Check if node is available in the environment
    import shutil
    debug_info["has_node"] = shutil.which("node") is not None
    debug_info["has_nodejs"] = shutil.which("nodejs") is not None
    
    # Test different pytubefix clients
    from pytubefix import YouTube
    clients_to_test = ['WEB', 'MWEB', 'ANDROID', 'ANDROID_MOBILE', 'ANDROID_MUSIC', 'IOS', 'TV', 'WEB_EMBED']
    client_results = {}
    
    for cl in clients_to_test:
        try:
            url = f"https://youtube.com/watch?v={video_id}"
            yt = YouTube(url, client=cl)
            title = yt.title
            captions_list = list(yt.captions.keys())
            client_results[cl] = {
                "success": True,
                "title": title,
                "captions": [str(k) for k in captions_list]
            }
        except Exception as e:
            client_results[cl] = {
                "success": False,
                "error": str(e)
            }
    debug_info["client_results"] = client_results
    
    return jsonify(debug_info)

@app.route("/api/media/transcript/manual", methods=['POST'])
def parse_manual_transcript_endpoint():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    data = request.get_json() or {}
    video_id = data.get("video_id")
    raw_text = data.get("raw_text", "").strip()
    video_title = data.get("title", "").strip()

    if not video_id or not raw_text:
        return jsonify({"error": "Brak identyfikatora wideo lub tekstu transkrypcji"}), 400

    if not video_title:
        video_title = f"Wideo YouTube ({video_id})"
        try:
            oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            response = requests.get(oembed_url, timeout=5)
            if response.ok:
                video_title = response.json().get("title", video_title)
        except Exception as e:
            print(f"Error fetching title for manual {video_id}: {e}")

    try:
        formatted = parse_manual_transcript(raw_text)
        if not formatted:
            return jsonify({"error": "Nie znaleziono poprawnych napisów w przesłanym tekście. Upewnij się, że tekst zawiera znaczniki czasu (np. 0:03)."}), 400

        aggregated = semantic_group_transcript(formatted)
        
        return jsonify({
            "video_id": video_id,
            "title": video_title,
            "transcript": aggregated
        })
    except Exception as e:
        print(f"Error parsing manual transcript: {e}")
        return jsonify({"error": f"Błąd przetwarzania napisów: {str(e)}"}), 500

def parse_story_response(generated_content):
    content = generated_content.strip()
    # Remove markdown code blocks if present
    if content.startswith('```json'):
        content = content[7:]
    elif content.startswith('```'):
        content = content[3:]
    if content.endswith('```'):
        content = content[:-3]
    content = content.strip()

    # 1. Try standard JSON parsing
    try:
        parsed = json.loads(content)
        title = parsed.get("title", "My AI Story").strip()
        story = parsed.get("story", "").strip()
        if title and story:
            return title, story
    except Exception:
        pass

    # 2. Try aggressive Regex parsing (handles truncated JSON from API and unescaped newlines)
    title = "My AI Story"
    title_match = re.search(r'"title"\s*:\s*"((?:[^"\\]|\\.)*)"', content)
    if title_match:
        # Evaluate escaped characters
        try:
            title = json.loads('"' + title_match.group(1) + '"')
        except Exception:
            title = title_match.group(1).replace('\\"', '"').strip()

    # Match from "story": " until the end
    story_match = re.search(r'"story"\s*:\s*"(.*)', content, re.DOTALL)
    if story_match:
        story_raw = story_match.group(1)
        # Remove trailing JSON structures if it wasn't cut off
        story_raw = re.sub(r'"\s*\}?\s*$', '', story_raw)
        
        # Unescape common sequences including the literal \n seen in screenshots
        story_escaped = story_raw.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
        return title, story_escaped.strip()

    # 3. Ultimate Fallback: Just treat it as plain text
    lines = generated_content.split('\n')
    first_line = lines[0].strip()
    if (first_line.startswith("#") or first_line.lower().startswith("title:")) and len(first_line) < 100:
        title = first_line.replace("#", "").replace("title:", "").replace("Title:", "").strip()
        story = "\n".join(lines[1:]).strip()
    else:
        title = "My AI Story"
        story = generated_content.strip()
        
    return title, story


@app.route("/api/generate", methods=['POST'])
def generate_text():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    data = request.get_json() or {}
    
    # Backwards compatibility check
    if "prompt" in data and "topics" not in data:
        prompt = data.get("prompt")
        if not prompt:
            return jsonify({"error": "Brak promptu w zapytaniu"}), 400
        try:
            output_data = query_deepseek(prompt)
            generated_content = output_data['choices'][0]['message']['content']
            return jsonify([{"generated_text": generated_content}])
        except (KeyError, IndexError) as e:
            return jsonify({"error": "Nie udało się sparsować odpowiedzi z DeepSeek", "details": str(e)}), 500
        except requests.exceptions.RequestException as e:
            return jsonify({"error": f"Błąd połączenia z DeepSeek API: {str(e)}"}), 500

    topics = data.get("topics", [])
    custom_details = data.get("customDetails", "")
    settings = data.get("settings", {})
    parent_id = data.get("parent_id")

    parts = []
    root_id = parent_id
    next_part_num = 1
    if parent_id:
        try:
            root_doc = db.collection('stories').document(parent_id).get()
            if root_doc.exists:
                root_data = root_doc.to_dict()
                if root_data.get('parent_id'):
                    root_id = root_data['parent_id']
                    root_doc = db.collection('stories').document(root_id).get()
                    if root_doc.exists:
                        root_data = root_doc.to_dict()
                
                parts.append({
                    'id': root_id,
                    'title': root_data.get('title', 'Part 1'),
                    'text': root_data.get('text', ''),
                    'part_number': root_data.get('part_number', 1)
                })

                other_docs = db.collection('stories').where('parent_id', '==', root_id).get()
                for doc in other_docs:
                    doc_data = doc.to_dict()
                    parts.append({
                        'id': doc.id,
                        'title': doc_data.get('title', f"Part {doc_data.get('part_number', 2)}"),
                        'text': doc_data.get('text', ''),
                        'part_number': doc_data.get('part_number', 2)
                    })
                
                parts.sort(key=lambda x: x.get('part_number', 1))
                next_part_num = len(parts) + 1
            else:
                return jsonify({"error": "Nie znaleziono historii nadrzędnej"}), 404
        except Exception as e:
            print("Błąd podczas pobierania części historii:", e)
            return jsonify({"error": f"Błąd bazy danych podczas pobierania części historii: {e}"}), 500

    if not topics and not custom_details.strip() and not parent_id:
        return jsonify({"error": "Brak wybranych tematów lub opisu szczegółów w zapytaniu"}), 400

    # Dynamic prompt construction
    if parent_id and parts:
        system_prompt = (
            "You are an expert English teacher writing custom educational stories for learners of English. "
            "You are writing a continuation (the next part/chapter) of an existing story. "
            "Your response MUST be in JSON format with exactly two keys: 'title' and 'story'. "
            "Do NOT write any text before or after the JSON structure. Respond ONLY with valid JSON.\n\n"
            "Example format:\n"
            "{\n"
            "  \"title\": \"Chapter 2: The Mysterious Forest\",\n"
            "  \"story\": \"Alex entered the forest slowly...\"\n"
            "}"
        )
        history_context = ""
        for p in parts:
            history_context += f"\n--- PART {p['part_number']}: {p['title']} ---\n{p['text']}\n"
            
        user_prompt = f"Here is the story so far:\n{history_context}\n\n"
        user_prompt += f"Write the next part (Part {next_part_num}) of this story.\n"
        if topics:
            user_prompt += f"Steer the continuation to incorporate these new topics: {', '.join(topics)}.\n"
        if custom_details.strip():
            user_prompt += f"Additionally, incorporate these plot details: \"{custom_details}\"\n"
    else:
        system_prompt = (
            "You are an expert English teacher writing custom educational stories for learners of English. "
            "Your response MUST be in JSON format with exactly two keys: 'title' and 'story'. "
            "Do NOT write any text before or after the JSON structure. Respond ONLY with valid JSON.\n\n"
            "Example format:\n"
            "{\n"
            "  \"title\": \"The Secret of the Clockwork Owl\",\n"
            "  \"story\": \"Professor Albert was an old scientist...\"\n"
            "}"
        )
        user_prompt = ""
        if topics:
            user_prompt += f"Write an educational English story combining these topics: {', '.join(topics)}.\n"
        else:
            user_prompt += "Write an educational English story.\n"
        if custom_details.strip():
            user_prompt += f"Additionally, incorporate these details: \"{custom_details}\"\n"

    # Scoping Level
    level = settings.get("language_level", "medium")
    if level == "simple":
        user_prompt += "Language level: Simple. Use very basic vocabulary (A1-A2 level), short sentences, and simple grammar. Avoid complex structures.\n"
    elif level == "advanced":
        user_prompt += "Language level: Advanced. Use rich vocabulary, idioms, complex sentence structures (C1-C2 level), and advanced expressions.\n"
    else:
        user_prompt += "Language level: Intermediate. Use standard everyday vocabulary, phrasal verbs, and moderate sentence structures (B1-B2 level).\n"

    # Scoping Length
    length = settings.get("length", "medium")
    if length == "short":
        user_prompt += "Length: Short (about 120-150 words).\n"
    elif length == "long":
        user_prompt += "Length: Long (about 400-500 words).\n"
    else:
        user_prompt += "Length: Medium (about 250-300 words).\n"

    # Factuality
    if settings.get("is_factual"):
        user_prompt += "Factuality: The story must be educational and based entirely on real-world history, science, geography, or real facts. Avoid fictional elements.\n"
    else:
        user_prompt += "Factuality: The story should be a fictional, creative story.\n"

    # Protagonist Name
    protagonist = settings.get("protagonist", "").strip()
    if protagonist:
        user_prompt += f"Protagonist name: The main character MUST be named '{protagonist}'.\n"

    # Genre
    genre = settings.get("genre", "adventure")
    user_prompt += f"Genre/Tone: Write in a {genre} style.\n"

    # Grammar focus
    focus = settings.get("focus_area", "none")
    if focus == "phrasal_verbs":
        user_prompt += "Focus: Incorporate and highlight at least 5 common English phrasal verbs.\n"
    elif focus == "idioms":
        user_prompt += "Focus: Incorporate and highlight at least 3 useful English idioms.\n"
    elif focus == "past_tenses":
        user_prompt += "Focus: Focus heavily on past tenses (Past Simple, Past Continuous, Past Perfect).\n"
    elif focus == "business":
        user_prompt += "Focus: Use business and professional terminology.\n"

    # Popular Science Settings
    if settings.get("is_popular_science"):
        user_prompt += "Style/Genre: Write in the style of an engaging popular science article or educational essay, similar to cognitive psychology or communication science stories (e.g. Curse of Knowledge, Ostrich Effect).\n"
        user_prompt += "Format & Structure:\n"
        user_prompt += "- Provide a catchy, double-barreled title (e.g., 'The Curse of Knowledge: The Paradox of Expertise').\n"
        user_prompt += "- Use an intellectual, sophisticated, yet accessible and highly engaging tone.\n"
        user_prompt += "- Integrate B2-C1 level professional and scientific terms (like cognitive bias, executive presence, default settings, linguistic framework, agility).\n"
        
        bias_enabled = settings.get("scientific_bias")
        comm_enabled = settings.get("scientific_communication")
        lang_enabled = settings.get("scientific_language_link")
        
        if not (bias_enabled or comm_enabled or lang_enabled):
            bias_enabled = True
            comm_enabled = True
            lang_enabled = True

        if bias_enabled:
            user_prompt += "- Incorporate and explain a specific cognitive bias or psychological phenomenon (e.g. Curse of Knowledge, Ostrich Effect, Dunning-Kruger, confirmation bias).\n"
        if comm_enabled:
            user_prompt += "- Focus the text on professional communication barriers, the paradox of expertise, or explaining complex technical terms to different audiences.\n"
        if lang_enabled:
            user_prompt += "- Connect the scientific concept directly to language acquisition challenges, fluency development, and the adaptability/agility needed to translate and simplify concepts.\n"

    try:
        output_data = query_deepseek_with_system(system_prompt, user_prompt)
        generated_content = output_data['choices'][0]['message']['content'].strip()

        title, story_text = parse_story_response(generated_content)

        # Zapisz wygenerowaną historię do Firestore
        text_hash = hashlib.sha256(story_text.encode('utf-8')).hexdigest()
        stories_ref = db.collection('stories')
        
        # Sprawdź czy identyczna historia już istnieje
        existing_stories = stories_ref.where('user_email', '==', user_email).where('text_hash', '==', text_hash).limit(1).get()
        story_id = None
        for doc in existing_stories:
            story_id = doc.id
            
        if not story_id:
            new_story_data = {
                'user_email': user_email,
                'title': title,
                'text': story_text,
                'text_hash': text_hash,
                'timestamp': firestore.SERVER_TIMESTAMP
            }
            if parent_id:
                new_story_data['parent_id'] = root_id
                new_story_data['part_number'] = next_part_num
            else:
                new_story_data['part_number'] = 1

            doc_ref = stories_ref.add(new_story_data)
            story_id = doc_ref[1].id

        return jsonify([{"generated_text": story_text, "title": title, "story_id": story_id}])
    except (KeyError, IndexError) as e:
        return jsonify({"error": "Nie udało się sparsować odpowiedzi z DeepSeek", "details": str(e)}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Błąd połączenia z DeepSeek API: {str(e)}"}), 500


@app.route("/api/generate-default", methods=['POST'])
def generate_default_text():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    system_prompt = (
        "You are an expert English teacher writing custom educational texts for learners of English. "
        "Your response MUST be in JSON format with exactly two keys: 'title' and 'story'. "
        "Do NOT write any text before or after the JSON structure. Respond ONLY with valid JSON.\n\n"
        "Example format:\n"
        "{\n"
        "  \"title\": \"The Art of Focus: Deep Work in a Distracted World\",\n"
        "  \"story\": \"Section 1\\nFirst paragraph of English text...\\n\\nSecond paragraph of English text...\\n\\nPolish Translation\\nFirst paragraph of Polish translation...\\n\\nSecond paragraph of Polish translation...\\n\\nSection 2\\nParagraph 1\\nPolish phrase with English equivalent in parentheses, next Polish phrase with English equivalent in parentheses...\\n\\nParagraph 2\\nPolish phrase with English equivalent in parentheses, next Polish phrase with English equivalent in parentheses...\"\n"
        "}"
    )

    user_prompt = (
        "Pick a random interesting topic related to productivity, career development, personal growth, psychology, cognitive science, technology, communication, or healthy workspace habits. "
        "Write a high-quality educational bilingual reading lesson on this topic. "
        "Follow these formatting rules strictly in the 'story' string:\n"
        "1. Start with the header 'Section 1' followed by exactly 2 engaging, professional, rich paragraphs in English (B2-C1 level) explaining the topic and its importance.\n"
        "2. Next, write the header 'Polish Translation' followed by the full Polish translation of those 2 paragraphs, matching them paragraph-for-paragraph.\n"
        "3. Next, write the header 'Section 2' followed by details for Paragraph 1 and Paragraph 2:\n"
        "   - Write 'Paragraph 1' on its own line.\n"
        "   - Immediately follow with a clause-by-clause or phrase-by-phrase bilingual breakdown of Paragraph 1, translating longer and meaningful phrases/clauses (do NOT translate word-by-word). Each Polish phrase/clause must be followed by its exact English translation in parentheses, like: Polish phrase (English translation), next Polish phrase (English translation).\n"
        "   - Write 'Paragraph 2' on its own line.\n"
        "   - Immediately follow with a clause-by-clause or phrase-by-phrase bilingual breakdown of Paragraph 2, using the same format with longer and meaningful phrases/clauses: Polish phrase (English translation), next Polish phrase (English translation).\n"
        "4. Do NOT include any repeated sections like 'English Version (For Listening Reinforcement)' at the end.\n"
        "Ensure all section headers ('Section 1', 'Polish Translation', 'Section 2', 'Paragraph 1', 'Paragraph 2') are clearly separated by double newlines (\\n\\n) and are on their own lines without any other text. Do NOT use markdown bold/italic formatting or bullet points in the headers."
    )

    try:
        output_data = query_deepseek_with_system(system_prompt, user_prompt)
        generated_content = output_data['choices'][0]['message']['content'].strip()

        title, story_text = parse_story_response(generated_content)

        # Zapisz wygenerowaną historię do Firestore
        text_hash = hashlib.sha256(story_text.encode('utf-8')).hexdigest()
        stories_ref = db.collection('stories')
        
        # Sprawdź czy identyczna historia już istnieje
        existing_stories = stories_ref.where('user_email', '==', user_email).where('text_hash', '==', text_hash).limit(1).get()
        story_id = None
        for doc in existing_stories:
            story_id = doc.id
            
        if not story_id:
            new_story_data = {
                'user_email': user_email,
                'title': title,
                'text': story_text,
                'text_hash': text_hash,
                'timestamp': firestore.SERVER_TIMESTAMP,
                'part_number': 1
            }

            doc_ref = stories_ref.add(new_story_data)
            story_id = doc_ref[1].id

        return jsonify([{"generated_text": story_text, "title": title, "story_id": story_id}])
    except (KeyError, IndexError) as e:
        return jsonify({"error": "Nie udało się sparsować odpowiedzi z DeepSeek", "details": str(e)}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Błąd połączenia z DeepSeek API: {str(e)}"}), 500


@app.route("/api/user-settings", methods=['GET'])
def get_user_settings():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    try:
        doc = db.collection('user_settings').document(user_email).get()
        if doc.exists:
            return jsonify(doc.to_dict()), 200
        else:
            default_settings = {
                "language_level": "medium",
                "length": "medium",
                "is_factual": False,
                "protagonist": "",
                "genre": "adventure",
                "focus_area": "none",
                "is_popular_science": False,
                "scientific_bias": False,
                "scientific_communication": False,
                "scientific_language_link": False
            }
            return jsonify(default_settings), 200
    except Exception as e:
        return jsonify({"error": f"Błąd pobierania ustawień: {e}"}), 500


@app.route("/api/user-settings", methods=['POST'])
def save_user_settings():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    data = request.get_json() or {}
    
    settings_data = {
        "language_level": data.get("language_level", "medium"),
        "length": data.get("length", "medium"),
        "is_factual": data.get("is_factual", False),
        "protagonist": data.get("protagonist", "").strip(),
        "genre": data.get("genre", "adventure"),
        "focus_area": data.get("focus_area", "none"),
        "is_popular_science": data.get("is_popular_science", False),
        "scientific_bias": data.get("scientific_bias", False),
        "scientific_communication": data.get("scientific_communication", False),
        "scientific_language_link": data.get("scientific_language_link", False)
    }

    try:
        db.collection('user_settings').document(user_email).set(settings_data)
        return jsonify({"message": "Ustawienia zapisane pomyślnie", "settings": settings_data}), 200
    except Exception as e:
        return jsonify({"error": f"Błąd zapisu ustawień: {e}"}), 500


# ### NOWE/ZMODYFIKOWANE ENDPOINTY DLA ZARZĄDZANIA HISTORIAMI PRZEZ FIRESTORE ###

@app.route("/api/stories", methods=['GET'])
def get_all_stories_firestore():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    try:
        stories_ref = db.collection('stories')
        docs = stories_ref.where('user_email', '==', user_email).stream()
        
        stories_list = []
        for doc in docs:
            story_data = doc.to_dict()
            story_data['id'] = doc.id
            if 'timestamp' in story_data and story_data['timestamp']:
                if hasattr(story_data['timestamp'], 'isoformat'):
                    story_data['timestamp'] = story_data['timestamp'].isoformat()
                else:
                    story_data['timestamp'] = str(story_data['timestamp'])
            stories_list.append(story_data)
        
        # Sortowanie w Pythonie, aby uniknąć konieczności tworzenia indeksów złożonych w Firebase
        stories_list.sort(key=lambda x: x.get('timestamp') or '', reverse=True)
        
        return jsonify(stories_list)
    except Exception as e:
        return jsonify({"error": f"Błąd podczas pobierania historii z Firestore: {e}"}), 500


@app.route("/api/stories", methods=['POST'])
def add_story_firestore():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    data = request.get_json() or {}
    title = data.get('title')
    text = data.get('text')

    if not title or not text:
        return jsonify({"error": "Tytuł i tekst są wymagane"}), 400
    
    try:
        text_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()

        stories_ref = db.collection('stories')
        existing_stories = stories_ref.where('user_email', '==', user_email).where('text_hash', '==', text_hash).limit(1).get()
        for doc in existing_stories:
            return jsonify({"message": "Historia o tej treści już istnieje", "id": doc.id}), 200

        # Dodaj nową historię dla konkretnego użytkownika
        new_story_data = {
            'user_email': user_email,
            'title': title,
            'text': text,
            'text_hash': text_hash,
            'timestamp': firestore.SERVER_TIMESTAMP
        }
        doc_ref = stories_ref.add(new_story_data)
        
        added_doc = doc_ref[1].get() 
        added_story = added_doc.to_dict()
        added_story['id'] = added_doc.id
        if 'timestamp' in added_story and added_story['timestamp']:
            if hasattr(added_story['timestamp'], 'isoformat'):
                added_story['timestamp'] = added_story['timestamp'].isoformat()
            else:
                added_story['timestamp'] = str(added_story['timestamp'])
        
        return jsonify(added_story), 201
    except Exception as e:
        return jsonify({"error": f"Błąd podczas dodawania historii do Firestore: {e}"}), 500


@app.route("/api/stories/<string:story_id>", methods=['DELETE'])
def delete_story_firestore(story_id):
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    try:
        doc_ref = db.collection('stories').document(story_id)
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify({"error": "Historia nie istnieje"}), 404
        
        if doc.to_dict().get('user_email') != user_email:
            return jsonify({"error": "Brak uprawnień do usunięcia tej historii"}), 403

        doc_ref.delete()
        return jsonify({"message": "Historia usunięta pomyślnie"}), 200
    except Exception as e:
        return jsonify({"error": f"Błąd podczas usuwania historii z Firestore: {e}"}), 500


@app.route("/api/stories/<string:story_id>", methods=['PUT'])
def update_story_title_firestore(story_id):
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    data = request.get_json() or {}
    new_title = data.get('title')
    if not new_title or not new_title.strip():
        return jsonify({"error": "Tytuł nie może być pusty"}), 400

    try:
        doc_ref = db.collection('stories').document(story_id)
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify({"error": "Historia nie istnieje"}), 404
        
        if doc.to_dict().get('user_email') != user_email:
            return jsonify({"error": "Brak uprawnień do edycji tej historii"}), 403

        doc_ref.update({'title': new_title.strip()})
        return jsonify({"message": "Tytuł zaktualizowany pomyślnie"}), 200
    except Exception as e:
        return jsonify({"error": f"Błąd podczas aktualizowania tytułu historii w Firestore: {e}"}), 500



@app.route("/api/stories/<string:story_id>", methods=['GET'])
def get_story_by_id_firestore(story_id):
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    try:
        doc = db.collection('stories').document(story_id).get()
        if doc.exists:
            story_data = doc.to_dict()
            if story_data.get('user_email') != user_email:
                return jsonify({"error": "Brak uprawnień do wyświetlenia tej historii"}), 403
            
            story_data['id'] = doc.id
            if 'timestamp' in story_data and story_data['timestamp']:
                if hasattr(story_data['timestamp'], 'isoformat'):
                    story_data['timestamp'] = story_data['timestamp'].isoformat()
                else:
                    story_data['timestamp'] = str(story_data['timestamp'])
            return jsonify(story_data)
        else:
            return jsonify({"error": "Historia nie znaleziona"}), 404
    except Exception as e:
        return jsonify({"error": f"Błąd podczas pobierania historii z Firestore: {e}"}), 500


@app.route("/api/stories/<string:story_id>/parts", methods=['GET'])
def get_story_parts_firestore(story_id):
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    try:
        root_doc = db.collection('stories').document(story_id).get()
        if not root_doc.exists:
            return jsonify({"error": "Historia nie istnieje"}), 404
            
        root_data = root_doc.to_dict()
        if root_data.get('user_email') != user_email:
            return jsonify({"error": "Brak uprawnień"}), 403
            
        root_id = root_data.get('parent_id') or story_id
        
        if root_data.get('parent_id'):
            root_doc = db.collection('stories').document(root_id).get()
            if root_doc.exists:
                root_data = root_doc.to_dict()
        
        parts_list = []
        root_part = root_data.copy()
        root_part['id'] = root_id
        root_part['part_number'] = root_part.get('part_number', 1)
        if 'timestamp' in root_part and root_part['timestamp']:
            if hasattr(root_part['timestamp'], 'isoformat'):
                root_part['timestamp'] = root_part['timestamp'].isoformat()
            else:
                root_part['timestamp'] = str(root_part['timestamp'])
        parts_list.append(root_part)
        
        child_docs = db.collection('stories').where('parent_id', '==', root_id).get()
        for doc in child_docs:
            doc_data = doc.to_dict()
            doc_data['id'] = doc.id
            doc_data['part_number'] = doc_data.get('part_number', 2)
            if 'timestamp' in doc_data and doc_data['timestamp']:
                if hasattr(doc_data['timestamp'], 'isoformat'):
                    doc_data['timestamp'] = doc_data['timestamp'].isoformat()
                else:
                    doc_data['timestamp'] = str(doc_data['timestamp'])
            parts_list.append(doc_data)
            
        parts_list.sort(key=lambda x: x.get('part_number', 1))
        
        return jsonify(parts_list), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Błąd pobierania części historii: {e}"}), 500


# ### NOWE ENDPOINTY DLA SŁOWNIKA (VOCABULARY) DLA UŻYTKOWNIKA ###

@app.route("/api/vocabulary", methods=['GET'])
def get_vocabulary():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    story_id = request.args.get('story_id')

    try:
        query = db.collection('vocabulary').where('user_email', '==', user_email)
        if story_id:
            query = query.where('story_id', '==', story_id)
        docs = query.stream()
        vocab_list = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            if 'timestamp' in data and data['timestamp']:
                if hasattr(data['timestamp'], 'isoformat'):
                    data['timestamp'] = data['timestamp'].isoformat()
                else:
                    data['timestamp'] = str(data['timestamp'])
            vocab_list.append(data)
        
        # Sortowanie w Pythonie chronologicznie (od najnowszych)
        vocab_list.sort(key=lambda x: x.get('timestamp') or '', reverse=True)
        return jsonify(vocab_list)
    except Exception as e:
        return jsonify({"error": f"Błąd podczas pobierania słownika: {e}"}), 500


@app.route("/api/vocabulary", methods=['POST'])
def add_vocabulary():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    data = request.get_json() or {}
    original = data.get('original', '').strip()
    translated = data.get('translated', '').strip()
    story_id = data.get('story_id')

    if not original or not translated:
        return jsonify({"error": "Wyrażenie oryginalne i tłumaczenie są wymagane"}), 400

    try:
        # Sprawdź duplikaty w ramach tej samej historii
        query = db.collection('vocabulary').where('user_email', '==', user_email).where('original', '==', original)
        if story_id:
            query = query.where('story_id', '==', story_id)
        existing = query.limit(1).get()
        
        for doc in existing:
            doc_data = doc.to_dict()
            if doc_data.get('translated') != translated:
                db.collection('vocabulary').document(doc.id).update({'translated': translated})
                doc_data['translated'] = translated
            doc_data['id'] = doc.id
            return jsonify(doc_data), 200

        new_entry = {
            'user_email': user_email,
            'original': original,
            'translated': translated,
            'story_id': story_id,
            'timestamp': firestore.SERVER_TIMESTAMP
        }
        doc_ref = db.collection('vocabulary').add(new_entry)
        added_doc = doc_ref[1].get()
        added_data = added_doc.to_dict()
        added_data['id'] = added_doc.id
        return jsonify(added_data), 201
    except Exception as e:
        return jsonify({"error": f"Błąd podczas dodawania do słownika: {e}"}), 500


@app.route("/api/vocabulary/<string:original_word>", methods=['DELETE'])
def delete_vocabulary(original_word):
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    story_id = request.args.get('story_id')

    try:
        query = db.collection('vocabulary').where('user_email', '==', user_email).where('original', '==', original_word)
        if story_id:
            query = query.where('story_id', '==', story_id)
        docs = query.stream()
        deleted_count = 0
        for doc in docs:
            db.collection('vocabulary').document(doc.id).delete()
            deleted_count += 1
        return jsonify({"message": f"Usunięto {deleted_count} wyrażeń ze słownika"}), 200
    except Exception as e:
        return jsonify({"error": f"Błąd podczas usuwania ze słownika: {e}"}), 500


@app.route("/api/vocabulary/<string:word_id>/mnemonic", methods=['POST'])
def generate_mnemonic(word_id):
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    try:
        doc_ref = db.collection('vocabulary').document(word_id)
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify({"error": "Słowo nie istnieje"}), 404
        
        word_data = doc.to_dict()
        if word_data.get('user_email') != user_email:
            return jsonify({"error": "Brak dostępu do tego słowa"}), 403

        # Sprawdź cache
        if 'mnemonic' in word_data and word_data['mnemonic']:
            return jsonify(word_data['mnemonic']), 200

        original = word_data.get('original', '')
        translated = word_data.get('translated', '')
        pronunciation = word_data.get('pronunciation_hint', '')

        system_prompt = (
            "Jesteś zaawansowanym silnikiem mnemotechnicznym (Metoda Słów Haczyków / Fonetyczna).\n"
            "Twoim zadaniem jest stworzyć absurdalne skojarzenie łączące angielskie słowo z językiem polskim wyłącznie na podstawie jego rzeczywistego BRZMIENIA (wymowy fonetycznej).\n\n"
            "CRITICAL RULES (Strict Enforcement):\n"
            "1. Określ rzeczywistą wymowę angielskiego słowa (np. 'bury' brzmi jak [beri], 'pork' brzmi jak [pok], 'chicken' brzmi jak [czikin]).\n"
            "2. KATEGORYCZNIE ZABRANIA SIĘ używania angielskiego słowa jako skojarzenia dźwiękowego ('audio_anchor').\n"
            "3. 'audio_anchor' MUSI być PRAWDZIWYM, istniejącym w języku polskim słowem lub powszechnie znaną frazą o jasnym znaczeniu. \n"
            "   BEZWARUNKOWY ZAKAZ wymyślania sztucznych słów (np. 'czikin', 'bif') lub tworzenia bezsensownych rymów bazujących na pisowni (np. bury -> 'buracz').\n"
            "4. Skojarzenie dźwiękowe ('audio_anchor') musi brzmieć jak najdokładniejszy odpowiednik wymowy angielskiej słyszanej przez ucho.\n"
            "5. Dynamiczna scena ('dynamic_scene') musi być zabawną, absurdalną historią, w której występują:\n"
            "   - Skojarzenie dźwiękowe ('audio_anchor')\n"
            "   - Polskie znaczenie tego słowa ('translation')\n"
            "   Oba te słowa kluczowe (oraz ich odmiany gramatyczne) MUSZĄ być zapisane WIELKIMI LITERAMI (ALL CAPS) w opisie sceny.\n"
            "6. WARUNEK AWARYJNY (FALLBACK): Jeśli kategorycznie nie potrafisz znaleźć żadnego prawdziwego, istniejącego w języku polskim słowa lub zwrotu zbliżonego fonetycznie do wymowy angielskiego słowa, pod żadnym pozorem nie wymyślaj sztucznego słowa. Zamiast tego zwróć dokładnie:\n"
            "   {\n"
            "     \"audio_anchor\": \"Brak dopasowania\",\n"
            "     \"abstract_image\": \"\",\n"
            "     \"dynamic_scene\": \"Nie udało się odnaleźć poprawnego polskiego słowa-klucza o podobnym brzmieniu.\"\n"
            "   }\n\n"
            "PRZYKŁADY POPRAWNEGO PROCESU MYŚLENIA:\n"
            "--- Przykład 1 ---\n"
            "Słowo: 'chicken' -> Wymowa: [czikin]\n"
            "Szukam prawdziwych polskich słów brzmiących jak [czikin] -> np. 'CZYŻYK W KINIE' (czy-żyk w ki-nie) lub 'CZYJ KIN'.\n"
            "Znaczenie: 'kurczak'\n"
            "Wyjście JSON:\n"
            "{\n"
            "  \"audio_anchor\": \"CZYŻYK W KINIE\",\n"
            "  \"abstract_image\": \"Mały ptaszek czyżyk siedzi w ciemnej sali kinowej z ogromnym kubełkiem popcornu.\",\n"
            "  \"dynamic_scene\": \"Nagle na ekranie zamiast filmu pojawia się wielki, pieczony KURCZAK. Wściekły CZYŻYK W KINIE rzuca popcornem w ekran i krzyczy: Kto włączył ten film z KURCZAKIEM?!\"\n"
            "}\n\n"
            "--- Przykład 2 ---\n"
            "Słowo: 'bury' -> Wymowa: [beri]\n"
            "Szukam prawdziwych polskich słów brzmiących jak [beri] -> np. 'BERET'. (NIGDY 'bury' czy 'buracz'!).\n"
            "Znaczenie: 'zakopoć'\n"
            "Wyjście JSON:\n"
            "{\n"
            "  \"audio_anchor\": \"BERET\",\n"
            "  \"abstract_image\": \"Ogromny, czerwony beret z antenką leży porzucony na środku trawnika.\",\n"
            "  \"dynamic_scene\": \"Podbiegasz do trawnika z łopatą i zaczynasz gorączkowo ZAKOPYWAĆ ten wielki BERET w ziemi, bo prezes zabronił nosić BERETÓW. Kiedy kończysz go ZAKOPYWAĆ, z ziemi wyrasta flaga.\"\n"
            "}\n\n"
            "--- Przykład 3 ---\n"
            "Słowo: 'pork' -> Wymowa: [pok]\n"
            "Szukam prawdziwych polskich słów brzmiących jak [pok] -> np. 'PORT' lub 'PORY' (warzywo).\n"
            "Znaczenie: 'wieprzowina'\n"
            "Wyjście JSON:\n"
            "{\n"
            "  \"audio_anchor\": \"PORT\",\n"
            "  \"abstract_image\": \"Wielki port morski z gigantycznymi statkami kontenerowymi cumującymi przy nabrzeżu.\",\n"
            "  \"dynamic_scene\": \"Wchodzisz do wielkiego PORTU, a zamiast wody w basenach portowych pływa płynny tłuszcz, w którym unoszą się gigantyczne kotlety schabowe. Kapitan krzyczy: Cała WIEPRZOWINA musi natychmiast opuścić PORT!\"\n"
            "}\n\n"
            "Zwróć strukturę w formacie JSON z kluczami: 'audio_anchor', 'abstract_image', 'dynamic_scene'.\n"
            "Odpowiedz wyłącznie poprawnym kodem JSON bez dodatkowych komentarzy czy formatowania markdown."
        )

        input_data = {
            "word": original,
            "translation": translated,
            "pronunciation": pronunciation
        }

        user_prompt = json.dumps(input_data, ensure_ascii=False)
        print(f"=== OPENAI INPUT FOR {word_id} ===")
        print(f"Word: {original} | Trans: {translated}")
        print(f"User Prompt: {user_prompt}")

        ai_response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )

        content = ai_response.choices[0].message.content.strip()
        print(f"=== OPENAI OUTPUT FOR {word_id} ===")
        print(content)
        
        if content.startswith("```"):
            lines = content.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            content = "\n".join(lines).strip()

        mnemonic_json = json.loads(content)
        
        # Zapisz w cache
        doc_ref.update({'mnemonic': mnemonic_json})

        return jsonify(mnemonic_json), 200
    except Exception as e:
        print(f"Error generating mnemonic: {e}")
        return jsonify({"error": f"Błąd generowania mnemotechniki: {str(e)}"}), 500


# ### NOWY ENDPOINT: WYSYŁANIE SŁÓW Z NOTATNIKA NA E-MAIL ###
@app.route("/api/send-notebook-email", methods=['POST'])
def send_notebook_email():
    data = request.get_json(silent=True) or {}
    recipient_email = data.get('recipient_email')
    notebook_words = data.get('notebook_words') # To będzie lista obiektów {original, translated}

    if not recipient_email or not notebook_words:
        return jsonify({"error": "Adres e-mail odbiorcy i słowa z notatnika są wymagane."}), 400
    
    if not all([EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD]):
        return jsonify({"error": "Brak konfiguracji poczty na serwerze (EMAIL_USERNAME/EMAIL_PASSWORD). Dodaj zmienne w panelu Render."}), 400

    email_body = "Oto Twoje słowa z notatnika AI English Buddy:\n\n"
    for entry in notebook_words:
        email_body += f"- {entry['original']} - {entry['translated']}\n"
    email_body += "\nPowodzenia w nauce!"

    msg = MIMEText(email_body, 'plain', 'utf-8')
    msg['Subject'] = "Twoje słówka z notatnika AI English Buddy"
    msg['From'] = EMAIL_USERNAME
    msg['To'] = recipient_email

    try:
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=15) as server:
            server.starttls() # Użyj TLS
            server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
            server.send_message(msg)
        return jsonify({"message": "Słówka wysłane pomyślnie na e-mail."}), 200
    except smtplib.SMTPAuthenticationError as e:
        print(f"Błąd uwierzytelniania SMTP: {e}")
        return jsonify({"error": "Błąd logowania do poczty. Dla konta Gmail musisz użyć Hasła Aplikacji (App Password) zamiast zwykłego hasła."}), 400
    except Exception as e:
        print(f"Błąd podczas wysyłania e-maila: {e}")
        return jsonify({"error": f"Nie udało się wysłać e-maila: {str(e)}"}), 500


@app.route("/api/generate-summary", methods=['POST'])
def generate_summary():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401
        
    data = request.get_json() or {}
    activity_log = data.get("activity_log", [])
    notebook_words = data.get("notebook_words", [])

    if not activity_log:
        return jsonify({"error": "Brak logów aktywności."}), 400

    system_prompt = (
        "You are an expert AI English tutor. Analyze the student's activity log "
        "and their saved notebook words from this session to generate a detailed learning analytics report in JSON format.\n\n"
        "Analyze the following points:\n"
        "1. Listening completeness: Look at 'listen_sentence' events. Check if all sentences in the text (from index 0 to total_sentences - 1) were played. "
        "Calculate the count of unique sentences listened to vs total_sentences, determine if the entire text was listened to, and write a brief Polish feedback.\n"
        "2. Engagement: Assess how actively they reviewed the text, translated words, asked for definitions, and added words. Count these events and write a short Polish evaluation.\n"
        "3. Pronunciation & Listening: Identify which specific words or phrases they listened to for correct pronunciation (look at 'listen_word_pronunciation' and 'practice' events). "
        "Also, analyze 'pronunciation_error' events where the user struggled to read the word correctly during reading practice. Combine these into 'pronunciation_drills'. Set 'was_mispronounced': true for items that had a pronunciation error, otherwise false. For each item in pronunciation_drills, include a Polish translation, a contextual example sentence, and the times_listened (or times_practiced) count.\n"
        "4. Vocabulary additions & gaps: List the words that were added to the notebook (events 'add_to_notebook'). "
        "Also, find words they translated or listened to multiple times but FORGOT to add to the notebook. List these in 'forgotten_words' with their translation, a professional example sentence, and a Polish reason why they should save it.\n\n"
        "Generate a JSON object with these EXACT keys:\n"
        "{\n"
        "  \"listening_analysis\": {\n"
        "    \"completed_entire_text\": true/false,\n"
        "    \"sentences_listened\": number,\n"
        "    \"total_sentences\": number,\n"
        "    \"feedback_pl\": \"...\"\n"
        "  },\n"
        "  \"engagement_analysis\": {\n"
        "    \"level\": \"Wysokie\"/\"Średnie\"/\"Niskie\",\n"
        "    \"dictionary_checks_count\": number,\n"
        "    \"saved_words_count\": number,\n"
        "    \"feedback_pl\": \"...\"\n"
        "  },\n"
        "  \"pronunciation_drills\": [\n"
        "    {\n"
        "      \"word\": \"...\",\n"
        "      \"translation\": \"...\",\n"
        "      \"example\": \"...\",\n"
        "      \"times_listened\": number,\n"
        "      \"was_mispronounced\": true/false\n"
        "    }\n"
        "  ],\n"
        "  \"vocabulary_analysis\": {\n"
        "    \"added_words\": [\"word1\", \"word2\"],\n"
        "    \"forgotten_words\": [\n"
        "      {\n"
        "        \"word\": \"...\",\n"
        "        \"translation\": \"...\",\n"
        "        \"example\": \"...\",\n"
        "        \"reason_pl\": \"Tłumaczyłeś to słowo 3 razy, ale nie zapisałeś w słowniku.\"\n"
        "      }\n"
        "    ]\n"
        "  }\n"
        "}\n\n"
        "Ensure your response is valid JSON and contains only the JSON structure. Do NOT add any preamble or markdown blocks."
    )

    user_prompt = f"Activity Log:\n{json.dumps(activity_log, indent=2)}\n\nNotebook Words:\n{json.dumps(notebook_words, indent=2)}"

    try:
        output_data = query_deepseek_with_system(system_prompt, user_prompt)
        content = output_data['choices'][0]['message']['content'].strip()
        
        # simple cleanup of markdown JSON wrapping
        if content.startswith("```json"):
            content = content.split("```json", 1)[1]
        if content.endswith("```"):
            content = content.rsplit("```", 1)[0]
        content = content.strip()
        
        summary_json = json.loads(content)
        return jsonify(summary_json), 200
    except json.JSONDecodeError as e:
        return jsonify({"error": "Nie udało się sparsować podsumowania w formacie JSON", "details": str(e), "raw": content}), 500
    except Exception as e:
        return jsonify({"error": f"Błąd generowania podsumowania: {e}"}), 500


@app.route("/api/send-summary-email", methods=['POST'])
def send_summary_email():
    data = request.get_json(silent=True) or {}
    recipient_email = data.get('recipient_email')
    summary = data.get('summary')

    if not recipient_email or not summary:
        return jsonify({"error": "Adres e-mail odbiorcy i podsumowanie są wymagane."}), 400
    
    if not all([EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD]):
        return jsonify({"error": "Brak konfiguracji poczty na serwerze (EMAIL_USERNAME/EMAIL_PASSWORD). Dodaj zmienne w panelu Render."}), 400

    listening_data = summary.get("listening_analysis", {})
    engagement_data = summary.get("engagement_analysis", {})
    pronunciation_list = summary.get("pronunciation_drills", [])
    vocab_data = summary.get("vocabulary_analysis", {})
    added_words = vocab_data.get("added_words", [])
    forgotten_words = vocab_data.get("forgotten_words", [])

    email_html = f"""
    <html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 30px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <h2 style="color: #1a73e8; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Podsumowanie Aktywności AI English Buddy</h2>
          
          <h3 style="color: #334155;">1. Analiza Przesłuchania Tekstu:</h3>
          <div style="background-color: #f1f5f9; border-left: 4px solid #1a73e8; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0; font-weight: 500;">
              Odsłuchano: <strong>{listening_data.get('sentences_listened', 0)}</strong> z <strong>{listening_data.get('total_sentences', 0)}</strong> zdań.<br/>
              {listening_data.get('feedback_pl', '')}
            </p>
          </div>
          
          <h3 style="color: #334155;">2. Ocena Zaangażowania (Praca z Tekstem):</h3>
          <div style="background-color: #f1f5f9; border-left: 4px solid #15803d; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0; font-weight: 500;">
              Poziom zaangażowania: <strong>{engagement_data.get('level', 'Średnie')}</strong><br/>
              Sprawdzenia w słowniku: <strong>{engagement_data.get('dictionary_checks_count', 0)}</strong><br/>
              Zapisane słówka: <strong>{engagement_data.get('saved_words_count', 0)}</strong><br/>
              {engagement_data.get('feedback_pl', '')}
            </p>
          </div>
    """

    if pronunciation_list:
        email_html += f"""
          <h3 style="color: #334155; margin-bottom: 15px;">3. Ćwiczona Wymowa i Odsłuch:</h3>
        """
        for item in pronunciation_list:
            was_mis = item.get('was_mispronounced', False)
            badge_html = ' <span style="background-color: #fee2e2; color: #b91c1c; font-size: 0.8rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px; border: 1px solid #fca5a5; margin-left: 10px;">Słaba wymowa ⚠️</span>' if was_mis else ''
            email_html += f"""
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; background-color: #fafafa;">
                <p style="margin: 2px 0; font-size: 1.1rem; font-weight: 700; color: #0f172a;">{item.get('word')}{badge_html}</p>
                <p style="margin: 2px 0; color: #1a73e8; font-weight: 600;">Tłumaczenie: {item.get('translation')}</p>
                <p style="margin: 6px 0; font-size: 0.95rem; color: #334155; background-color: #f1f5f9; padding: 8px; border-radius: 4px;">
                  <strong>Przykład użycia:</strong> <i>{item.get('example')}</i>
                </p>
                <p style="margin: 2px 0; font-size: 0.85rem; color: #64748b;">Krotność odsłuchu/ćwiczeń: {item.get('times_listened', 1)}</p>
              </div>
            """

    email_html += f"""
          <h3 style="color: #334155; margin-bottom: 15px;">4. Słownictwo i Luki w Nauce:</h3>
          <p style="margin: 6px 0;"><strong>Dodane do słownika:</strong> {', '.join(added_words) if added_words else 'Brak'}</p>
    """

    if forgotten_words:
        email_html += f"""
          <p style="margin: 12px 0 6px 0; font-weight: 700; color: #b91c1c;">Słówka, które warto zapisać (często sprawdzane, lecz pominięte):</p>
        """
        for item in forgotten_words:
            email_html += f"""
              <div style="border: 1px solid #fca5a5; border-radius: 8px; padding: 15px; margin-bottom: 15px; background-color: #fff5f5;">
                <p style="margin: 2px 0; font-size: 1.1rem; font-weight: 700; color: #991b1b;">{item.get('word')}</p>
                <p style="margin: 2px 0; color: #b91c1c; font-weight: 600;">Tłumaczenie: {item.get('translation')}</p>
                <p style="margin: 6px 0; font-size: 0.95rem; color: #334155; background-color: #ffffff; padding: 8px; border-radius: 4px; border: 1px solid #fee2e2;">
                  <strong>Przykład użycia:</strong> <i>{item.get('example')}</i>
                </p>
                <p style="margin: 6px 0 0 0; font-size: 0.9rem; color: #991b1b;">💡 <strong>Rekomendacja:</strong> {item.get('reason_pl')}</p>
              </div>
            """

    email_html += """
          <p style="text-align: center; font-size: 0.85rem; color: #94a3b8; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            Wiadomość wygenerowana automatycznie przez AI English Buddy. Powodzenia w dalszej nauce!
          </p>
        </div>
      </body>
    </html>
    """

    msg = MIMEText(email_html, 'html', 'utf-8')
    msg['Subject'] = "Podsumowanie Aktywności i Luki w Nauce - AI English Buddy"
    msg['From'] = EMAIL_USERNAME
    msg['To'] = recipient_email

    try:
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=15) as server:
            server.starttls()
            server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
            server.send_message(msg)
        return jsonify({"message": "Podsumowanie wysłane pomyślnie na e-mail."}), 200
    except smtplib.SMTPAuthenticationError as e:
        print(f"Błąd uwierzytelniania SMTP: {e}")
        return jsonify({"error": "Błąd logowania do poczty. Dla konta Gmail musisz użyć Hasła Aplikacji (App Password) zamiast zwykłego hasła."}), 400
    except Exception as e:
        print(f"Błąd wysyłania e-maila: {e}")
        return jsonify({"error": f"Nie udało się wysłać e-maila: {str(e)}"}), 500


@app.route("/api/analyze-grammar", methods=['POST'])
def analyze_grammar():
    data = request.get_json()
    text = data.get('text')

    if not text:
        return jsonify({"error": "Tekst do analizy gramatycznej jest wymagany."}), 400

    try:
        grammar_prompt = f"""
        Jesteś ekspertem od gramatyki języka angielskiego i nauczycielem. Twoim zadaniem jest przeanalizowanie poniższego tekstu.
        Wyszukaj trzy różne, interesujące struktury gramatyczne lub czasy, które są użyte w tym tekście.
        Dla każdej struktury:
        1. Podaj jej nazwę (np. "Present Continuous", "Passive Voice", "Conditional Type 2").
        2. Wybierz *jedno* reprezentatywne zdanie z tekstu, które ją zawiera.
        3. Opisz krótko i jasno, czym jest ta struktura/czas i w jakich sytuacjach się jej używa, jakbyś tłumaczył to uczącej się osobie.

        Formatuj odpowiedź jako listę JSON, gdzie każdy element to obiekt z kluczami 'title', 'example_sentence', 'explanation'.

        Tekst do analizy:
        "{text}"

        Przykład formatu JSON (tylko dla jednego elementu, ma być ich 3):
        [
          {{
            "title": "Przykład Tytułu Gramatycznego",
            "example_sentence": "Przykład zdania z tekstu.",
            "explanation": "To jest wyjaśnienie danej struktury gramatycznej..."
          }}
        ]
        """
        
        # 1. Wywołaj DeepSeek i uzyskaj odpowiedź jako słownik Pythona
        deepseek_response = query_deepseek(grammar_prompt)
        
        # 2. Wyodrębnij faktyczną zawartość tekstową z odpowiedzi DeepSeek
        #    To jest string, który powinien zawierać JSON.
        raw_analysis_content = deepseek_response['choices'][0]['message']['content'].strip()
        
        # Możesz tu dodać logowanie, aby zobaczyć, co DeepSeek zwróciło jako string
        print("Raw AI analysis content:", raw_analysis_content)

        # 3. Teraz, gdy mamy string, możemy próbować parsować go jako JSON
        try:
            # Próbujemy znaleźć pierwszy i ostatni nawias kwadratowy, aby wyodrębnić czysty JSON
            start_index = raw_analysis_content.find('[')
            end_index = raw_analysis_content.rfind(']')
            if start_index != -1 and end_index != -1:
                json_string = raw_analysis_content[start_index : end_index + 1]
                grammar_analysis = json.loads(json_string)
            else:
                # Jeśli nie ma nawiasów kwadratowych, spróbuj parsować całość (mniej bezpieczne)
                grammar_analysis = json.loads(raw_analysis_content)
        except json.JSONDecodeError as e:
            print(f"Błąd parsowania JSON z DeepSeek: {raw_analysis_content}. Error: {e}")
            return jsonify({"error": "AI zwróciło nieprawidłowy format analizy gramatycznej.", "details": str(e), "raw_content": raw_analysis_content}), 500

        # Możesz tu dodać logowanie, aby zobaczyć sparsowany obiekt Pythona
        print("Parsed grammar analysis:", grammar_analysis)

        # Upewnij się, że grammar_analysis jest listą, tak jak oczekuje frontend
        if not isinstance(grammar_analysis, list):
             print(f"Oczekiwano listy, otrzymano: {type(grammar_analysis)}. Content: {grammar_analysis}")
             return jsonify({"error": "AI zwróciło analizę gramatyczną w nieoczekiwanym formacie (nie jest listą).", "content": grammar_analysis}), 500


        return jsonify(grammar_analysis), 200

    except requests.exceptions.RequestException as e:
        print(f"Błąd połączenia z DeepSeek API: {e}")
        return jsonify({"error": f"Błąd połączenia z serwerem AI: {e}"}), 500
    except Exception as e:
        print(f"Nieoczekiwany błąd podczas analizy gramatycznej: {e}")
        return jsonify({"error": f"Wystąpił nieoczekiwany błąd: {e}"}), 500
@app.route("/api/mastery-prepare", methods=['POST'])
def prepare_mastery_content():
    data = request.get_json()
    text = data.get('text')

    if not text:
        return jsonify({"error": "Tekst jest wymagany."}), 400

    try:
        # Prompt prosi AI o podział tekstu na zdania i tłumaczenie każdego z nich.
        mastery_prompt = f"""
        Objective: Split the following English text into logical, natural sentences and provide its HIGH-QUALITY Polish translation. Additionally, split each sentence into smaller phrasal segments (3-5 words) for pronunciation practice.
        
        Rules:
        1. Split the text into a JSON list of objects.
        2. Each object MUST have "en" (original English sentence), "pl" (natural Polish translation), and "segments" (a list of short, logical English phrases from that sentence).
        3. The Polish text must be encoded in UTF-8.
        4. Focus segments on natural breathing points or grammatical boundaries.
        5. Do NOT split sentences on periods belonging to common abbreviations (such as Mr., Mrs., Ms., Dr., Prof., Sr., Jr., St., e.g., i.e., vs., a.m., p.m.). These must remain within their parent sentence.

        Text to analyze:
        "{text}"

        Output format:
        [
          {{
            "en": "Sentence 1", 
            "pl": "Zdanie 1", 
            "segments": ["Phrase 1", "Phrase 2"]
          }},
          ...
        ]
        
        Respond only with the JSON list.
        """
        
        deepseek_response = query_deepseek(mastery_prompt)
        raw_content = deepseek_response['choices'][0]['message']['content'].strip()
        
        # Oczyszczanie odpowiedzi
        start_index = raw_content.find('[')
        end_index = raw_content.rfind(']')
        if start_index != -1 and end_index != -1:
            json_string = raw_content[start_index : end_index + 1]
            mastery_data = json.loads(json_string)
        else:
            mastery_data = json.loads(raw_content)

        # Scalanie zdań, które zostały błędnie podzielone na skrótach (np. Mr., Dr.)
        if isinstance(mastery_data, list):
            abbreviations = ("mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "co", "corp", "inc", "ltd", "e.g", "i.e", "vs", "a.m", "p.m")
            
            def ends_with_abbrev_check(text):
                text_lower = text.lower().strip().rstrip(".")
                for abbrev in abbreviations:
                    if text_lower.endswith(abbrev):
                        start_idx = len(text_lower) - len(abbrev)
                        if start_idx == 0:
                            return True
                        char_before = text_lower[start_idx - 1]
                        if not char_before.isalnum():
                            return True
                return False

            merged_data = []
            i = 0
            while i < len(mastery_data):
                item = mastery_data[i]
                en_text = item.get("en", "").strip()
                
                ends_with_abbrev = ends_with_abbrev_check(en_text)
                while ends_with_abbrev and i + 1 < len(mastery_data):
                    i += 1
                    next_item = mastery_data[i]
                    en_text = en_text + " " + next_item.get("en", "").strip()
                    item["en"] = en_text
                    item["pl"] = item.get("pl", "").strip() + " " + next_item.get("pl", "").strip()
                    item["segments"] = item.get("segments", []) + next_item.get("segments", [])
                    ends_with_abbrev = ends_with_abbrev_check(en_text)
                
                merged_data.append(item)
                i += 1
            mastery_data = merged_data

        return jsonify(mastery_data), 200

    except Exception as e:
        print(f"Błąd przygotowania Mastery Path: {e}")
        return jsonify({"error": f"Błąd serwera AI: {e}"}), 500

@app.route('/api/mastery-evaluate', methods=['POST'])
def evaluate_mastery():
    transcription = request.form.get('transcription', '').strip()
    original_text = request.form.get('target_text', '')
    
    # Jeśli nie otrzymaliśmy gotowej transkrypcji z frontendu, próbujemy Whisper API
    if not transcription:
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file or transcription text provided."}), 400
        
        audio_file = request.files['audio']
        
        # HF Inference API for Whisper (new router domain for 2026)
        HF_TOKEN = os.getenv("HF_API_TOKEN")
        API_URL = "https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo"
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}

        try:
            # 1. Transkrypcja
            audio_data = audio_file.read()
            print(f"Sending audio to Whisper Turbo... Size: {len(audio_data)} bytes")
            
            # Jawna specyfikacja formatu
            asr_headers = headers.copy()
            asr_headers["Content-Type"] = get_audio_content_type(audio_file)
            
            response = requests.post(API_URL, headers=asr_headers, data=audio_data, timeout=30)
            
            if response.status_code != 200:
                print(f"Whisper API error: {response.status_code} - {response.text}")
                try:
                    error_info = response.json()
                except:
                    error_info = {"error": response.text[:500]}
                    
                if isinstance(error_info, dict) and "estimated_time" in error_info:
                     return jsonify({"error": "AI model is warming up. Please try again in 20-30 seconds.", "details": error_info}), 503
                return jsonify({"error": "Transcription failed", "details": error_info}), 500
                
            transcription_result = response.json()
            transcription = transcription_result.get("text", "")
            
            if not transcription:
                 print("Whisper returned empty transcription.")
                 return jsonify({"error": "No speech detected. Please speak louder or closer to the mic."}), 400
                 
            print(f"Transcription success: '{transcription}'")
        except Exception as e:
            print(f"Whisper connection/processing error: {e}")
            return jsonify({"error": "Transcription service communication failure.", "details": str(e)}), 500
    else:
        print(f"Using client-side transcription: '{transcription}'")

    try:
        # 2. Ewaluacja przez AI
        evaluation_prompt = f"""
        Objective: Briefly evaluate the student's pronunciation of the target sentence.
        Target: "{original_text}"
        Transcription: "{transcription}"

        Instructions:
        1. Keep the feedback concise and to the point. No long paragraphs.
        2. Provide a score from 0 to 100 based on the match.
        3. Be lenient and ignore punctuation, capitalization, or spacing differences (e.g., "Hubert," matches "hubert").
        4. Be highly forgiving of minor Speech-to-Text (STT) transcriber mistakes, similar-sounding words, names, or homophones (e.g. if the user says "Hubert" but it is transcribed as "Schubert", or "heard" as "her", do not penalize them or list them as errors if they are phonetically close).
        5. Under "tip": Write a brief general opinion and characterization of the reading (in Polish, 1-2 short sentences max).
        6. Under "corrections": Point out only significant, actual pronunciation errors or words that were completely omitted. Do not mention minor STT quirks or punctuation. If perfect or has only minor STT quirks, write "Brak błędów".
        7. Under "mispronounced_words": Provide a JSON array of strings containing the exact English words from the Target sentence that were mispronounced or omitted by the user. If none, return [].

        Respond in JSON format:
        {{
          "score": 85,
          "transcription": "...",
          "corrections": "...",
          "tip": "...",
          "mispronounced_words": ["word1", "word2"]
        }}
        """
        
        if not client:
             print("OpenAI/DeepSeek client is not initialized.")
             return jsonify({"error": "AI Evaluation service is currently unavailable (missing API key)."}), 500

        print(f"Starting AI evaluation for: {original_text[:20]}...")
        ai_response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": evaluation_prompt}],
            response_format={"type": "json_object"}
        )
        
        print("DeepSeek responded. Parsing JSON...")
        raw_json = ai_response.choices[0].message.content.strip()
        
        # Clean markdown code blocks if any
        if raw_json.startswith("```"):
            lines = raw_json.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw_json = "\n".join(lines).strip()
            
        result = json.loads(raw_json)
        
        # Zapewnij obecność oryginalnej transkrypcji
        if "transcription" not in result or not result["transcription"]:
            result["transcription"] = transcription
            
        print("Mastery evaluation complete.")
        return jsonify(result)

    except Exception as e:
        print(f"CRITICAL ERROR in evaluate_mastery: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

def is_polish(text):
    # If it contains Polish specific characters, it's almost certainly Polish:
    if re.search(r'[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]', text):
        return True
    
    # Check words
    common_pl = {'jest', 'na', 'to', 'się', 'w', 'z', 'o', 'i', 'po', 'jak', 'tak', 'nie', 'dla', 'do', 'od', 'za', 'ze', 'co', 'tym', 'też', 'proszę', 'przetłumacz', 'napisz', 'powtórz', 'zdanie', 'słowo', 'dobrze', 'źle', 'poprawnie', 'polsku', 'angielsku', 'języku'}
    common_en = {'is', 'the', 'a', 'an', 'and', 'to', 'in', 'on', 'of', 'for', 'with', 'you', 'your', 'i', 'me', 'my', 'that', 'this', 'it', 'was', 'were', 'have', 'has', 'had', 'english', 'translate', 'sentence', 'word', 'say', 'how'}
    
    words = re.findall(r'\b\w+\b', text.lower())
    if not words:
        return False
        
    pl_count = sum(1 for w in words if w in common_pl)
    en_count = sum(1 for w in words if w in common_en)
    
    if en_count > pl_count:
        return False
    if pl_count > en_count:
        return True
        
    return False

def convert_quotes_to_asterisks(text):
    pattern = r'(\s|^)\'([^\'\n]+)\'(?=\s|$|[,.:;?!])'
    return re.sub(pattern, r'\1*\2*', text)

def detect_primary_language(text):
    # Check if the text is predominantly English or Polish based on common word list
    common_pl = {'jest', 'na', 'to', 'się', 'w', 'z', 'o', 'i', 'po', 'jak', 'tak', 'nie', 'dla', 'do', 'od', 'za', 'ze', 'co', 'tym', 'też', 'proszę', 'przetłumacz', 'napisz', 'powtórz', 'zdanie', 'słowo', 'dobrze', 'źle', 'poprawnie', 'polsku', 'angielsku', 'języku'}
    common_en = {'is', 'the', 'a', 'an', 'and', 'to', 'in', 'on', 'of', 'for', 'with', 'you', 'your', 'i', 'me', 'my', 'that', 'this', 'it', 'was', 'were', 'have', 'has', 'had', 'english', 'translate', 'sentence', 'word', 'say', 'how'}
    
    words = re.findall(r'\b\w+\b', text.lower())
    if not words:
        if re.search(r'[ęćłńóśźżĄĆĘŁŃÓŚŹŻ]', text):
            return "pl"
        return "en"
        
    pl_count = sum(1 for w in words if w in common_pl)
    en_count = sum(1 for w in words if w in common_en)
    
    pl_chars = len(re.findall(r'[ęćłńóśźżĄĆĘŁŃÓŚŹŻ]', text))
    
    if en_count > pl_count:
        return "en"
    elif pl_count > en_count:
        return "pl"
    else:
        # Tie-breaker: presence of Polish diacritics
        if pl_chars > 0:
            return "pl"
        return "en"

def split_text_by_language(text):
    text_converted = convert_quotes_to_asterisks(text)
    
    # A sentence boundary is a punctuation mark (. ! ?) not preceded by a common abbreviation,
    # followed by space or newline or end of string.
    abbreviations = r'\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Co|Corp|Inc|Ltd|e\.g|i\.e|vs|a\.m|p\.m)\.'
    
    marked_text = text_converted
    def replace_boundary(match):
        before = match.group(1)
        punct = match.group(2)
        after = match.group(3)
        if re.search(abbreviations, before):
            return match.group(0)
        return before + punct + "\u0000" + after

    marked_text = re.sub(r'(\S+)([\.\?\!])(\s+|$)', replace_boundary, marked_text)
    sentences = [s.strip() for s in marked_text.split("\u0000") if s.strip()]
    
    segments = []
    
    def add_segment(text_val, lang_val):
        text_stripped = text_val.strip()
        if not text_stripped:
            return
        if segments and segments[-1][1] == lang_val:
            segments[-1] = (segments[-1][0] + " " + text_stripped, lang_val)
        else:
            segments.append((text_stripped, lang_val))

    for sentence in sentences:
        sentence_lang = detect_primary_language(sentence)
        
        # Split by quotes, asterisks, underscores, and parentheses
        pattern = r'("[^"]+"|\*[^*]+\*|\_[^_]+\_|\([^)]+\)|[^\(\)"\*\_]+)'
        chunks = re.findall(pattern, sentence)
        
        for chunk in chunks:
            chunk_stripped = chunk.strip()
            if not chunk_stripped:
                continue
                
            is_parentheses = chunk_stripped.startswith('(') and chunk_stripped.endswith(')')
            is_quotes = chunk_stripped.startswith('"') and chunk_stripped.endswith('"')
            is_asterisks = chunk_stripped.startswith('*') and chunk_stripped.endswith('*')
            is_underscores = chunk_stripped.startswith('_') and chunk_stripped.endswith('_')
            
            if is_parentheses or is_quotes or is_asterisks or is_underscores:
                inner_content = chunk_stripped[1:-1].strip()
                if not inner_content:
                    continue
                is_pl = is_polish(inner_content)
                insert_lang = "pl" if is_pl else "en"
                add_segment(inner_content, insert_lang)
            else:
                add_segment(chunk_stripped, sentence_lang)
                
    return segments

def split_text_by_tags(text):
    if "[PL]" not in text and "[EN]" not in text:
        # Fallback split
        return split_text_by_language(text)
        
    parts = re.split(r'(\[PL\]|\[EN\])', text)
    segments = []
    current_lang = "en"
    
    for part in parts:
        if part == "[PL]":
            current_lang = "pl"
        elif part == "[EN]":
            current_lang = "en"
        else:
            part_stripped = part.strip()
            if part_stripped:
                segments.append((part_stripped, current_lang))
                
    return segments

def get_voice_pair(selected_voice):
    en_voice = "en-US-BrianNeural"
    pl_voice = "pl-PL-MarekNeural"
    
    if "pl-PL" in selected_voice:
        pl_voice = selected_voice
        if "Zofia" in selected_voice:
            en_voice = "en-US-AriaNeural"
        else:
            en_voice = "en-US-BrianNeural"
    else:
        en_voice = selected_voice
        is_female = any(x in selected_voice.lower() for x in ["aria", "emma", "sonia", "zofia", "female"])
        if is_female:
            pl_voice = "pl-PL-ZofiaNeural"
        else:
            pl_voice = "pl-PL-MarekNeural"
            
    return en_voice, pl_voice

def generate_tts_base64(text, voice="en-US-BrianNeural", ai_mode="free"):
    if "Neural" not in voice:
        voice = "en-US-BrianNeural"
        
    # Use OpenAI TTS API if available
    if ai_mode == "openai_full" and openai_client:
        # If the text is purely English (no [PL] tags and no Polish specific characters), synthesize in a single request.
        if "[PL]" not in text and not re.search(r'[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]', text):
            print(f"DEBUG TTS: Synthesizing entire text as English using OpenAI TTS with voice '{voice}'", flush=True)
            try:
                openai_voice = "alloy"
                if "Brian" in voice or "Marek" in voice:
                    openai_voice = "onyx"
                elif "Jenny" in voice or "Emma" in voice or "Aria" in voice:
                    openai_voice = "nova"
                    
                response = openai_client.audio.speech.create(
                    model="tts-1",
                    voice=openai_voice,
                    input=text
                )
                audio_data = response.read()
                return base64.b64encode(audio_data).decode('utf-8')
            except Exception as e:
                print(f"OpenAI TTS error, falling back to Edge TTS: {e}", flush=True)
    
    # If the text is purely English (no [PL] tags and no Polish specific characters), synthesize in a single request.
    if "[PL]" not in text and not re.search(r'[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]', text):
        print(f"DEBUG TTS: Synthesizing entire text as English with voice '{voice}'", flush=True)
        async def get_audio():
            communicate = edge_tts.Communicate(text, voice)
            audio_data = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data += chunk["data"]
            return audio_data
        try:
            data = asyncio.run(get_audio())
            return base64.b64encode(data).decode('utf-8')
        except Exception as e:
            print(f"Error generating TTS in helper: {e}", flush=True)
            return ""

    en_voice, pl_voice = get_voice_pair(voice)
    segments = split_text_by_tags(text)
    
    print(f"DEBUG TTS: Input text = '{text}'", flush=True)
    print(f"DEBUG TTS: Selected voice = '{voice}' -> English: '{en_voice}', Polish: '{pl_voice}'", flush=True)
    print(f"DEBUG TTS: Segments = {segments}", flush=True)
    
    if not segments:
        return ""
        
    async def get_segment_audio(segment_text, segment_voice):
        print(f"DEBUG TTS: Synthesizing '{segment_text}' with voice '{segment_voice}'", flush=True)
        if ai_mode == "openai_full" and openai_client:
            try:
                openai_voice = "alloy"
                if "Brian" in segment_voice or "Marek" in segment_voice:
                    openai_voice = "onyx"
                elif "Jenny" in segment_voice or "Emma" in segment_voice or "Aria" in segment_voice:
                    openai_voice = "nova"
                
                response = openai_client.audio.speech.create(
                    model="tts-1",
                    voice=openai_voice,
                    input=segment_text
                )
                return response.read()
            except Exception as e:
                print(f"OpenAI TTS segment error: {e}, falling back to Edge TTS...", flush=True)
                
        communicate = edge_tts.Communicate(segment_text, segment_voice)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        return audio_data
        
    async def get_all_audio():
        tasks = []
        for segment_text, lang in segments:
            v = pl_voice if lang == "pl" else en_voice
            tasks.append(get_segment_audio(segment_text, v))
        results = await asyncio.gather(*tasks)
        return b"".join(results)

    try:
        data = asyncio.run(get_all_audio())
        return base64.b64encode(data).decode('utf-8')
    except Exception as e:
        print(f"Error generating TTS in helper: {e}", flush=True)
        return ""

@app.route("/api/tts", methods=['GET', 'POST'])
def get_tts_audio():
    if request.method == 'POST':
        data = request.get_json() or {}
        text = data.get("text", "")
        voice = data.get("voice", "en-US-BrianNeural")
    else:
        text = request.args.get("text", "")
        voice = request.args.get("voice", "en-US-BrianNeural")

    if not text:
        return jsonify({"error": "Brak parametru text"}), 400

    base64_data = generate_tts_base64(text, voice)
    if not base64_data:
        return jsonify({"error": "Błąd generowania mowy"}), 500
    return jsonify({"audio_base64": base64_data})

@app.route("/api/stories/generate-questions", methods=['POST'])
def generate_story_questions():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    data = request.get_json() or {}
    story_text = data.get("text", "").strip()
    if not story_text:
        return jsonify({"error": "Brak tekstu opowiadania"}), 400

    prompt = f"""
    Based on the following story, write exactly 3 simple comprehension questions in English.
    The questions should test if the user understood the main events or details of the story.
    
    Story:
    "{story_text}"
    
    Respond ONLY with a JSON array containing the questions, using the exact key "question". No markdown formatting or extra text.
    Example:
    [
      {{"question": "Who was the main character?"}},
      {{"question": "What did they find in the forest?"}},
      {{"question": "Why were they happy at the end?"}}
    ]
    """

    if not client:
        return jsonify({"error": "Serwis AI nie jest dostępny (brak klucza API)."}), 500

    try:
        ai_response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}]
        )
        raw_content = ai_response.choices[0].message.content.strip()
        if raw_content.startswith("```"):
            lines = raw_content.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw_content = "\n".join(lines).strip()

        questions = json.loads(raw_content)
        if isinstance(questions, dict) and "questions" in questions:
            questions = questions["questions"]
        elif isinstance(questions, dict):
            for val in questions.values():
                if isinstance(val, list):
                    questions = val
                    break
        
        if not isinstance(questions, list):
             questions = [{"question": questions.get("question", "What is the story about?")}]
             
        formatted_questions = []
        for i, q in enumerate(questions):
            q_text = q.get("question", "") if isinstance(q, dict) else str(q)
            formatted_questions.append({"id": i + 1, "question": q_text})

        return jsonify(formatted_questions)
    except Exception as e:
        print(f"Error generating questions: {e}")
        return jsonify({"error": f"Błąd generowania pytań: {str(e)}"}), 500

@app.route("/api/stories/evaluate-answer", methods=['POST'])
def evaluate_story_answer():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    question = request.form.get('question', '').strip()
    story_text = request.form.get('story_text', '').strip()
    transcription = request.form.get('transcription', '').strip()

    if not question or not story_text:
        return jsonify({"error": "Pytanie i tekst opowiadania są wymagane."}), 400

    if not transcription:
        if 'audio' not in request.files:
            return jsonify({"error": "Brak pliku audio lub gotowej transkrypcji."}), 400

        audio_file = request.files['audio']
        
        HF_TOKEN = os.getenv("HF_API_TOKEN")
        API_URL = "https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo"
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}

        try:
            audio_data = audio_file.read()
            asr_headers = headers.copy()
            asr_headers["Content-Type"] = get_audio_content_type(audio_file)
            
            response = requests.post(API_URL, headers=asr_headers, data=audio_data, timeout=30)
            if response.status_code != 200:
                print(f"Whisper error: {response.status_code} - {response.text}")
                return jsonify({"error": "Nie udało się przeprowadzić transkrypcji mowy."}), 500
                
            transcription_result = response.json()
            transcription = transcription_result.get("text", "")
            if not transcription:
                return jsonify({"error": "Nie wykryto mowy. Spróbuj mówić głośniej."}), 400
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Whisper processing error: {e}")
            return jsonify({"error": f"Błąd komunikacji z serwisem transkrypcji mowy: {str(e)}"}), 500

    prompt = f"""
    You are an English teacher evaluating a student's answer to a comprehension question about a story.
    
    Story:
    "{story_text}"
    
    Question:
    "{question}"
    
    Student's Answer (Speech-to-Text Transcription):
    "{transcription}"
    
    Instructions:
    1. Decide if the answer is factually correct and makes sense based on the story.
    2. Provide a score from 0 to 100 representing how correct and well-expressed the answer is.
    3. Write a brief feedback/explanation in Polish (1-2 sentences) under the key "feedback".
       - If the student used Polish words/expressions (because they didn't know the English equivalent), present the correct English translation in this feedback (e.g. "Zauważyłem, że użyłeś słowa 'samochód', po angielsku to 'car'.").
    4. Check the Student's Answer for any Polish words or expressions:
       - If you detect any Polish words/phrases, identify them and translate them to the correct English words/expressions.
       - List all such insertions in the 'polish_insertions' JSON field.
    5. Respond ONLY with a valid JSON object. Do NOT include markdown code blocks or extra characters.
    
    Example format:
    {{
      "is_correct": true,
      "score": 90,
      "feedback": "Twoja odpowiedź jest poprawna i dobrze sformułowana. Świetna robota!",
      "polish_insertions": [
        {{
          "polish": "Polish word/phrase",
          "english": "English translation"
        }}
      ]
    }}
    
    If there are no Polish words detected in the student's answer, set "polish_insertions" to an empty list [].
    """

    if not client:
        return jsonify({"error": "AI Evaluation service is currently unavailable."}), 500

    try:
        ai_response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}]
        )
        raw_json = ai_response.choices[0].message.content.strip()
        if raw_json.startswith("```"):
            lines = raw_json.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw_json = "\n".join(lines).strip()

        result = json.loads(raw_json)
        result["transcription"] = transcription

        # Automatically save detected Polish insertions into user's Vocabulary database
        insertions = result.get("polish_insertions", [])
        if insertions and isinstance(insertions, list) and db is not None:
            try:
                for item in insertions:
                    polish_word = item.get("polish", "").strip()
                    english_word = item.get("english", "").strip()
                    if polish_word and english_word:
                        # Check if duplicate exists for this user
                        query = db.collection('vocabulary').where('user_email', '==', user_email).where('original', '==', english_word)
                        existing = query.limit(1).get()
                        
                        duplicate_found = False
                        for doc in existing:
                            duplicate_found = True
                            # If translation changed, update it
                            if doc.to_dict().get('translated') != polish_word:
                                db.collection('vocabulary').document(doc.id).update({'translated': polish_word})
                            break
                        
                        if not duplicate_found:
                            new_entry = {
                                'user_email': user_email,
                                'original': english_word,
                                'translated': polish_word,
                                'story_id': 'evaluate-answer',
                                'timestamp': firestore.SERVER_TIMESTAMP
                            }
                            db.collection('vocabulary').add(new_entry)
                            print(f"Automatically saved vocabulary insertion from evaluate-answer: {english_word} -> {polish_word}")
            except Exception as vocab_err:
                print(f"Error automatically saving vocabulary insertion from evaluate-answer: {vocab_err}")

        return jsonify(result)
    except Exception as e:
        print(f"Error evaluating answer: {e}")
        return jsonify({"error": f"Błąd oceny odpowiedzi przez AI: {str(e)}"}), 500

@app.route("/api/stories/chat-next", methods=['POST'])
def chat_next():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    story_text = request.form.get('story_text', '').strip()
    history_str = request.form.get('history', '[]').strip()
    transcription = request.form.get('transcription', '').strip()

    try:
        history = json.loads(history_str)
    except Exception as e:
        return jsonify({"error": "Błędny format historii czatu."}), 400

    if not story_text:
        return jsonify({"error": "Tekst opowiadania jest wymagany."}), 400

    if not transcription and 'audio' in request.files:
        audio_file = request.files['audio']
        HF_TOKEN = os.getenv("HF_API_TOKEN")
        API_URL = "https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo"
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}

        try:
            audio_data = audio_file.read()
            asr_headers = headers.copy()
            asr_headers["Content-Type"] = get_audio_content_type(audio_file)
            
            response = requests.post(API_URL, headers=asr_headers, data=audio_data, timeout=30)
            if response.status_code == 200:
                transcription_result = response.json()
                transcription = transcription_result.get("text", "").strip()
            else:
                print(f"Whisper error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"Whisper error in chat: {e}")

    if 'audio' in request.files and not transcription:
        bot_response = "I didn't quite catch that, but don't worry! I'm here and ready to help you practice your English about this story whenever you're ready."
        return jsonify({
            "user_evaluation": None,
            "bot_response": bot_response,
            "transcription": ""
        })

    system_prompt = f"""
    You are an encouraging and professional English tutor. You are holding a voice-based conversation with a student about the following story:
    
    Story context:
    "{story_text}"
    
    Instructions:
    1. If this is the start of the conversation (student has not answered anything yet), greet them briefly and ask a simple, engaging question about the story.
    2. If the student has answered a question (provided in 'Student\'s Answer'), evaluate their answer:
       - Grade their answer from 0 to 100 based on correctness and grammar.
       - Provide a short feedback/explanation (in English, 1-2 sentences) about their answer.
    3. Formulate your verbal response ('bot_response') in English. Keep it concise, warm, and natural (1-3 sentences max).
       - First, give brief encouragement/correction on their previous answer (e.g. "Excellent! That's correct.", "Not quite, actually...").
       - Second, ask the next comprehension question about the story.
    4. POLISH WORDS / INSERTIONS (VERY IMPORTANT):
       - Check the 'Student\'s Answer' for any Polish words or expressions (which means the student didn't know the English word and inserted Polish instead).
       - If you detect any Polish words or phrases:
         - Identify them and translate them to the correct English words/expressions.
         - In your 'bot_response', make sure to politely present the correct English translation (e.g., "I noticed you used 'chleb', which is 'bread' in English.").
         - List all such insertions in the 'polish_insertions' JSON field.
    5. Respond ONLY with a valid JSON object. Do NOT include markdown code blocks or extra characters.
    
    JSON format structure:
    {{
      "user_evaluation": {{
        "score": 85,
        "is_correct": true,
        "feedback": "..."
      }},
      "bot_response": "...",
      "polish_insertions": [
        {{
          "polish": "Polish word/phrase",
          "english": "English translation"
        }}
      ]
    }}
    
    If it's the start (no user answer), set "user_evaluation" to null and "polish_insertions" to an empty list [].
    If there are no Polish words detected in the student's answer, set "polish_insertions" to an empty list [].
    """

    user_prompt = f"Chat History:\n"
    for msg in history:
        role = "Student" if msg.get("sender") == "user" else "Tutor"
        user_prompt += f"{role}: {msg.get('text')}\n"

    if transcription:
        user_prompt += f"Latest Student's Answer: \"{transcription}\"\n"
    else:
        user_prompt += "Latest Student's Answer: (None, this is the start)\n"

    if not client:
        return jsonify({"error": "AI client is currently unavailable."}), 500

    try:
        ai_response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        raw_json = ai_response.choices[0].message.content.strip()
        if raw_json.startswith("```"):
            lines = raw_json.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw_json = "\n".join(lines).strip()

        result = json.loads(raw_json)
        result["transcription"] = transcription
        result["user_transcription"] = transcription

        # Automatically save detected Polish insertions into user's Vocabulary database
        insertions = result.get("polish_insertions", [])
        if insertions and isinstance(insertions, list) and db is not None:
            try:
                for item in insertions:
                    polish_word = item.get("polish", "").strip()
                    english_word = item.get("english", "").strip()
                    if polish_word and english_word:
                        # Check if duplicate exists for this user
                        query = db.collection('vocabulary').where('user_email', '==', user_email).where('original', '==', english_word)
                        existing = query.limit(1).get()
                        
                        duplicate_found = False
                        for doc in existing:
                            duplicate_found = True
                            # If translation changed, update it
                            if doc.to_dict().get('translated') != polish_word:
                                db.collection('vocabulary').document(doc.id).update({'translated': polish_word})
                            break
                        
                        if not duplicate_found:
                            new_entry = {
                                'user_email': user_email,
                                'original': english_word,
                                'translated': polish_word,
                                'story_id': 'chat-story',
                                'timestamp': firestore.SERVER_TIMESTAMP
                            }
                            db.collection('vocabulary').add(new_entry)
                            print(f"Automatically saved vocabulary insertion from chat-story: {english_word} -> {polish_word}")
            except Exception as vocab_err:
                print(f"Error automatically saving vocabulary insertion from chat-story: {vocab_err}")

        return jsonify(result)
    except Exception as e:
        print(f"Error in chat-next: {e}")
        return jsonify({"error": f"Błąd komunikacji z serwisem AI: {str(e)}"}), 500

@app.route("/api/chat-free", methods=['POST'])
def chat_free():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    history_str = request.form.get('history', '[]').strip()
    transcription = request.form.get('transcription', '').strip()
    voice = request.form.get('voice', 'en-US-BrianNeural').strip()
    ai_mode = request.form.get('ai_mode', 'free').strip()

    try:
        history = json.loads(history_str)
    except Exception as e:
        return jsonify({"error": "Błędny format historii czatu."}), 400

    print(f"DEBUG chat-free: files={list(request.files.keys())}, form={list(request.form.keys())}, transcription='{transcription}', voice='{voice}', ai_mode='{ai_mode}'", flush=True)

    if not transcription and 'audio' in request.files:
        audio_file = request.files['audio']
        print("DEBUG chat-free: Found 'audio' in request.files", flush=True)
        
        # Use OpenAI Whisper API if available and requested
        if ai_mode in ['openai_full', 'hybrid']:
            if openai_client:
                print("DEBUG chat-free: Using OpenAI Whisper API for transcription...", flush=True)
                try:
                    audio_file.seek(0)
                    transcription_response = openai_client.audio.transcriptions.create(
                        model="whisper-1",
                        file=(audio_file.filename or "user_speech.m4a", audio_file.stream, audio_file.content_type or "audio/m4a"),
                        language="en"
                    )
                    transcription = transcription_response.text.strip()
                    print(f"DEBUG chat-free: OpenAI Transcription = '{transcription}'", flush=True)
                except Exception as e:
                    print(f"OpenAI Whisper error in chat-free: {e}", flush=True)
            else:
                print("DEBUG chat-free: OpenAI Whisper requested but openai_client is not configured.", flush=True)
                
        # Fallback to Hugging Face
        if not transcription:
            print("DEBUG chat-free: Using Hugging Face Whisper API for transcription...", flush=True)
            HF_TOKEN = os.getenv("HF_API_TOKEN")
            API_URL = "https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo"
            headers = {"Authorization": f"Bearer {HF_TOKEN}"}

            try:
                audio_file.seek(0)
                audio_data = audio_file.read()
                print(f"DEBUG chat-free: Read {len(audio_data)} bytes of audio data", flush=True)
                asr_headers = headers.copy()
                asr_headers["Content-Type"] = get_audio_content_type(audio_file)
                
                response = requests.post(API_URL, headers=asr_headers, data=audio_data, timeout=30)
                print(f"DEBUG chat-free: Whisper API response code = {response.status_code}", flush=True)
                if response.status_code == 200:
                    transcription_result = response.json()
                    transcription = transcription_result.get("text", "").strip()
                    print(f"DEBUG chat-free: Transcription = '{transcription}'", flush=True)
                else:
                    print(f"Whisper error in chat-free: {response.status_code} - {response.text}", flush=True)
            except Exception as e:
                print(f"Whisper error in chat-free: {e}", flush=True)

    if 'audio' in request.files and not transcription:
        bot_response = "I didn't quite catch that, but don't worry! I'm here and ready to help you practice your English whenever you're ready. Feel free to speak when you are ready."
        print(f"DEBUG chat-free: Pre-generating TTS base64 for fallback voice '{voice}'...", flush=True)
        audio_base64 = generate_tts_base64(bot_response, voice=voice, ai_mode=ai_mode)
        return jsonify({
            "user_evaluation": None,
            "bot_response": bot_response,
            "transcription": "",
            "audio_base64": audio_base64
        })

    system_prompt = """
    You are an encouraging and professional English tutor. You are holding a voice-based conversation with a student on any topic they choose (free conversation).
    
    Instructions:
    1. REACT DIRECTLY & MAINTAIN CONTINUITY:
       - You MUST directly react and respond to what the student says in 'Student's Answer'.
       - Treat the conversation as a single, continuous thread. Keep logical flow and refer back to previous things said when appropriate. Do NOT make generic or disconnected remarks.
       - If the student is trying to translate a sentence or answer a question, evaluate their response and react to it directly.
    2. SPEAK ONLY IN ENGLISH:
       - Your 'bot_response' and 'feedback' MUST be written entirely in English. Do NOT include Polish sentences, words, explanations, or translations in 'bot_response' (except when politely explaining a correction, e.g. "Instead of X, you should say Y").
       - Never use Polish text segments, and never use language tags like [PL] or [EN].
    3. MANAGE TOPICS & AVOID GETTING STUCK:
       - Balance deep diving into a topic with conversation progression. Do NOT drill down or stay on a single topic/question for too long.
       - If the exchange on the current topic has gone on for 2-3 turns (check 'Chat History'), or if the conversation is stalling, smoothly suggest a transition to a new related topic or ask a new interesting question in English to keep the conversation fresh.
    4. REAL-TIME CORRECTIONS & feedback:
       - Actively analyze the quality of the student's answer for correctness, grammar, naturalness, and vocabulary usage.
       - Politely provide feedback and corrections directly in your 'bot_response' in English (e.g., "Instead of X, you should say Y to sound more natural.", "You might also say Z to express this beautifully."). Give them practical tips to enrich their speech.
       - Keep your 'bot_response' to 2-4 sentences max so it remains appropriate for a voice conversation.
       - Grade their answer from 0 to 100 based on correctness and grammar.
       - Provide a short, structured feedback/explanation (in English, 1-2 sentences) under 'feedback' detailing the grammar correction or suggestions.
    5. POLISH WORDS / INSERTIONS:
       - If the student used any Polish words or expressions in 'Student's Answer' (inserted when they didn't know the English word), translate them to English. List all such insertions in the 'polish_insertions' JSON field.
    6. AUTOMATIC VOCABULARY SAVING:
       - Identify any language troubles, grammatical errors (e.g., if user said 'goed', correct to 'went'), or newly suggested English words/expressions you introduced.
       - List ALL these items in the 'vocabulary_additions' JSON field. These will be automatically saved to the student's notebook.
       - Each entry in 'vocabulary_additions' must have:
         - 'original': the correct English word, phrase, or corrected expression (e.g. 'went' or 'sustainable development').
         - 'translated': the Polish translation/explanation of the correction or word (e.g. 'poszedł/poszłam (poprawka z goed)' or 'zrównoważony rozwój').
    7. Respond ONLY with a valid JSON object. Do NOT include markdown code blocks or extra characters.
    
    JSON format structure:
    {
      "user_evaluation": {
        "score": 85,
        "is_correct": true,
        "feedback": "..."
      },
      "bot_response": "...",
      "polish_insertions": [
        {
          "polish": "Polish word/phrase",
          "english": "English translation"
        }
      ],
      "vocabulary_additions": [
        {
          "original": "English corrected word/phrase",
          "translated": "Polish translation/explanation"
        }
      ]
    }
    
    If it's the start (no user answer), set "user_evaluation" to null, "polish_insertions" to [], and "vocabulary_additions" to [].
    If there are no errors, insertions, or new vocabulary suggestions, set their respective lists to [].
    """

    user_prompt = "Chat History:\n"
    for msg in history:
        role = "Student" if msg.get("sender") == "user" else "Tutor"
        user_prompt += f"{role}: {msg.get('text')}\n"

    if transcription:
        user_prompt += f"Latest Student's Answer: \"{transcription}\"\n"
    else:
        user_prompt += "Latest Student's Answer: (None, this is the start)\n"

    # Determine client and model based on ai_mode
    active_client = client
    active_model = MODEL_NAME
    
    if ai_mode in ['openai_full', 'hybrid']:
        if not openai_client:
            return jsonify({"error": "Wybrany tryb płatny wymaga klucza OPENAI_API_KEY w pliku .env"}), 400
        active_client = openai_client
        active_model = "gpt-4o-mini"
    else: # free
        if deepseek_client:
            active_client = deepseek_client
            active_model = "deepseek-chat"
        else:
            active_client = client
            active_model = MODEL_NAME

    if not active_client:
        return jsonify({"error": "AI client is currently unavailable."}), 500

    try:
        ai_response = active_client.chat.completions.create(
            model=active_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        raw_json = ai_response.choices[0].message.content.strip()
        if raw_json.startswith("```"):
            lines = raw_json.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw_json = "\n".join(lines).strip()

        result = json.loads(raw_json)
        result["transcription"] = transcription

        # Automatically save detected Polish insertions into user's Vocabulary database
        insertions = result.get("polish_insertions", [])
        if insertions and isinstance(insertions, list) and db is not None:
            try:
                for item in insertions:
                    polish_word = item.get("polish", "").strip()
                    english_word = item.get("english", "").strip()
                    if polish_word and english_word:
                        # Check if duplicate exists for this user
                        query = db.collection('vocabulary').where('user_email', '==', user_email).where('original', '==', english_word)
                        existing = query.limit(1).get()
                        
                        duplicate_found = False
                        for doc in existing:
                            duplicate_found = True
                            # If translation changed, update it
                            if doc.to_dict().get('translated') != polish_word:
                                db.collection('vocabulary').document(doc.id).update({'translated': polish_word})
                            break
                        
                        if not duplicate_found:
                            new_entry = {
                                'user_email': user_email,
                                'original': english_word,
                                'translated': polish_word,
                                'story_id': 'chat-free',
                                'timestamp': firestore.SERVER_TIMESTAMP
                            }
                            db.collection('vocabulary').add(new_entry)
                            print(f"Automatically saved vocabulary insertion: {english_word} -> {polish_word}", flush=True)
            except Exception as vocab_err:
                print(f"Error automatically saving vocabulary insertion: {vocab_err}", flush=True)

        # Automatically save general vocabulary additions and corrections
        vocab_additions = result.get("vocabulary_additions", [])
        if vocab_additions and isinstance(vocab_additions, list) and db is not None:
            try:
                for item in vocab_additions:
                    english_word = item.get("original", "").strip()
                    polish_explanation = item.get("translated", "").strip()
                    if english_word and polish_explanation:
                        # Check if duplicate exists for this user
                        query = db.collection('vocabulary').where('user_email', '==', user_email).where('original', '==', english_word)
                        existing = query.limit(1).get()
                        
                        duplicate_found = False
                        for doc in existing:
                            duplicate_found = True
                            # If translation changed, update it
                            if doc.to_dict().get('translated') != polish_explanation:
                                db.collection('vocabulary').document(doc.id).update({'translated': polish_explanation})
                            break
                        
                        if not duplicate_found:
                            new_entry = {
                                'user_email': user_email,
                                'original': english_word,
                                'translated': polish_explanation,
                                'story_id': 'chat-free',
                                'timestamp': firestore.SERVER_TIMESTAMP
                            }
                            db.collection('vocabulary').add(new_entry)
                            print(f"Automatically saved vocabulary addition/correction: {english_word} -> {polish_explanation}", flush=True)
            except Exception as vocab_err:
                print(f"Error automatically saving vocabulary addition: {vocab_err}", flush=True)

        # Generate TTS audio on the backend to reduce latency
        bot_reply_text = result.get("bot_response", "")
        if bot_reply_text:
            print(f"DEBUG chat-free: Pre-generating TTS base64 for voice '{voice}' and mode '{ai_mode}'...", flush=True)
            result["audio_base64"] = generate_tts_base64(bot_reply_text, voice=voice, ai_mode=ai_mode)
            # Clean up the tags for the UI display
            cleaned_reply_text = bot_reply_text.replace("[PL]", "").replace("[EN]", "")
            # Merge any double spaces resulting from tag removal
            cleaned_reply_text = re.sub(r'\s+', ' ', cleaned_reply_text).strip()
            result["bot_response"] = cleaned_reply_text
        else:
            result["audio_base64"] = ""

        return jsonify(result)
    except Exception as e:
        print(f"Error in chat-free: {e}")
        return jsonify({"error": f"Błąd komunikacji z serwisem AI: {str(e)}"}), 500

@app.route("/api/chat-free/summary", methods=['POST'])
def generate_chat_summary():
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401
        
    data = request.get_json() or {}
    history = data.get("history", [])

    if not history:
        return jsonify({"error": "Brak historii rozmowy do podsumowania."}), 400

    system_prompt = """
    You are an expert AI English tutor. Analyze the student's voice chat conversation history to generate a detailed learning summary in JSON format.
    
    Tasks:
    1. Overall Score: calculate an average score (0-100) based on their evaluated answers. If no scores are available, estimate one.
    2. Issues to reinforce (Zagadnienia do utrwalenia): identify expressions, grammar, or phrasings where the student struggled, made mistakes, or used Polish wtrącenia.
       For each issue, provide:
       - "original": the student's original sentence (with the mistake or awkward phrasing).
       - "corrected": the correct or improved/enriched alternative.
       - "explanation_pl": a brief explanation in Polish explaining the issue and how to improve.
    3. Session Vocabulary: list the key English vocabulary words or Polish insertions that were translated/corrected during this session.
       For each item, include:
       - "word": the English word/phrase.
       - "translation": the Polish translation.
    4. General feedback: write a warm, encouraging general feedback in Polish (feedback_pl).
    
    JSON format structure:
    {
      "average_score": 85,
      "feedback_pl": "...",
      "issues": [
        {
          "original": "...",
          "corrected": "...",
          "explanation_pl": "..."
        }
      ],
      "vocabulary": [
        {
          "word": "...",
          "translation": "..."
        }
      ]
    }
    
    Ensure your response is valid JSON and contains only the JSON structure. Do NOT add markdown blocks or extra characters.
    """

    user_prompt = f"Chat History:\n{json.dumps(history, indent=2, ensure_ascii=False)}"

    try:
        ai_response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        content = ai_response.choices[0].message.content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            content = "\n".join(lines).strip()

        summary_json = json.loads(content)
        return jsonify(summary_json), 200
    except Exception as e:
        print(f"Error generating chat summary: {e}")
        return jsonify({"error": f"Błąd generowania podsumowania czatu: {str(e)}"}), 500

@app.route("/api/send-chat-summary-email", methods=['POST'])
def send_chat_summary_email():
    data = request.get_json(silent=True) or {}
    recipient_email = data.get('recipient_email')
    summary = data.get('summary', {})

    if not recipient_email or not summary:
        return jsonify({"error": "Adres e-mail odbiorcy i podsumowanie są wymagane."}), 400
    
    if not all([EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD]):
        return jsonify({"error": "Brak konfiguracji poczty na serwerze (EMAIL_USERNAME/EMAIL_PASSWORD). Dodaj zmienne w panelu Render."}), 400

    issues = summary.get("issues", [])
    vocabulary = summary.get("vocabulary", [])
    feedback_pl = summary.get("feedback_pl", "")
    avg_score = summary.get("average_score", 0)

    email_html = f"""
    <html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 30px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <h2 style="color: #1a73e8; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Podsumowanie Lekcji Głosowej AI</h2>
          
          <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 1.1rem; font-weight: bold; color: #1e293b;">
              Średni wynik sesji: <span style="color: #1a73e8; font-size: 1.3rem;">{avg_score}/100</span>
            </p>
            <p style="margin: 10px 0 0 0; color: #475569;">
              {feedback_pl}
            </p>
          </div>
    """

    if issues:
        email_html += """
          <h3 style="color: #334155; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">🗣️ Zagadnienia do utrwalenia:</h3>
        """
        for item in issues:
            email_html += f"""
              <div style="border: 1px solid #fee2e2; border-radius: 8px; padding: 15px; margin-bottom: 15px; background-color: #fff5f5;">
                <p style="margin: 0 0 5px 0; color: #b91c1c; font-weight: bold;">❌ Twoja wersja: <span style="font-weight: normal; font-style: italic;">"{item.get('original')}"</span></p>
                <p style="margin: 0 0 10px 0; color: #15803d; font-weight: bold;">👉 Sugerowana wersja: <span style="font-weight: normal; font-style: italic;">"{item.get('corrected')}"</span></p>
                <p style="margin: 0; font-size: 0.95rem; color: #475569;">💡 <strong>Wyjaśnienie:</strong> {item.get('explanation_pl')}</p>
              </div>
            """

    if vocabulary:
        email_html += """
          <h3 style="color: #334155; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">📓 Słownictwo z lekcji:</h3>
        """
        for item in vocabulary:
            email_html += f"""
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px; background-color: #fafafa; display: flex; justify-content: space-between;">
                <strong style="color: #0f172a;">{item.get('word')}</strong>
                <span style="color: #475569;">— {item.get('translation')}</span>
              </div>
            """

    email_html += """
          <div style="margin-top: 30px; border-top: 2px solid #e2e8f0; padding-top: 15px; font-size: 0.85rem; color: #94a3b8; text-align: center;">
            Wiadomość wygenerowana automatycznie przez Twój projekt AI English Buddy.
          </div>
        </div>
      </body>
    </html>
    """

    try:
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=15) as server:
            server.starttls()
            server.login(EMAIL_USERNAME, EMAIL_PASSWORD)

            msg = MIMEText(email_html, 'html', 'utf-8')
            msg['Subject'] = f"Podsumowanie Lekcji Głosowej AI - {avg_score}/100"
            msg['From'] = EMAIL_USERNAME
            msg['To'] = recipient_email

            server.sendmail(EMAIL_USERNAME, [recipient_email], msg.as_string())
        return jsonify({"message": "Wiadomość e-mail została wysłana."}), 200
    except smtplib.SMTPAuthenticationError as e:
        print(f"Błąd uwierzytelniania SMTP: {e}")
        return jsonify({"error": "Błąd logowania do poczty. Dla konta Gmail musisz użyć Hasła Aplikacji (App Password) zamiast zwykłego hasła."}), 400
    except Exception as e:
        print(f"Error sending chat summary email: {e}")
        return jsonify({"error": f"Nie udało się wysłać e-maila: {str(e)}"}), 500

if __name__ == "__main__":
    # db.create_all() # Nie potrzebne dla Firestore, Firebase zarządza strukturą dokumentów
    # print("Baza danych zainicjalizowana.")
    app.run(debug=True, host='0.0.0.0', port=5001)