import os
from dotenv import load_dotenv # Upewnij się, że to jest na górze!
from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
import hashlib
import smtplib
from email.mime.text import MIMEText
import random
import json

import requests
from openai import OpenAI

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Inicjalizacja Firebase Admin SDK
# Upewnij się, że plik firebase_service_account.json jest w katalogu backend
try:
    cred = credentials.Certificate("firebase_service_account.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client() # Klient Firestore
    print("Firebase zainicjalizowany pomyślnie.")
except Exception as e:
    print(f"Błąd inicjalizacji Firebase: {e}")
    # Możesz tutaj zdecydować, czy aplikacja powinna działać bez Firebase,
    # czy zatrzymać się. Na potrzeby tego przykładu, pozwalamy jej działać,
    # ale operacje na Firestorze będą zgłaszać błędy.


    # Klient OpenAI (DeepSeek)
client = None
if os.getenv("DEEPSEEK_API_KEY"):
    client = OpenAI(
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        base_url="https://api.deepseek.com"
    )
    print("Klient DeepSeek zainicjalizowany.")
else:
    print("OSTRZEŻENIE: Brak DEEPSEEK_API_KEY w .env.")

# --- KONFIGURACJA EMAIL (ZMIENNE ŚRODOWISKOWE) ---
EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USERNAME = os.getenv("EMAIL_USERNAME")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

# Sprawdzanie, czy zmienne email są załadowane
if not all([EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD]):
    print("OSTRZEŻENIE: Brak pełnej konfiguracji EMAIL w .env. Funkcja wysyłania e-maili może nie działać.")
    # Możesz tu np. wyłączyć endpoint wysyłania e-maili, jeśli wolisz.


API_TOKEN = os.getenv("DEEPSEEK_API_KEY")
API_URL = "https://api.deepseek.com/chat/completions"
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
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "user", "content": prompt_text}
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
    if not text_to_translate:
        return jsonify({"error": "Brak tekstu do tłumaczenia"}), 400

    translation_prompt = (
        f"Translate the English word or phrase '{text_to_translate}' into Polish. "
        f"Provide only the most common, direct, and concise translation, "
        f"without any additional explanations, examples, synonyms, or context. "
        f"Respond ONLY with the translated word or phrase."
    )
    
    try:
        output_data = query_deepseek(translation_prompt)
        translated_text = output_data['choices'][0]['message']['content']
        
        translated_text = translated_text.strip()
        if translated_text.lower().startswith("translation:"):
            translated_text = translated_text[len("translation:"):].strip()
        if translated_text.lower().startswith("polish:"):
            translated_text = translated_text[len("polish:"):].strip()
        
        translated_text = translated_text.split('\n')[0].strip()
        translated_text = translated_text.split('.')[0].strip()

        return jsonify({"translation": translated_text})
    except (KeyError, IndexError) as e:
        return jsonify({"error": "Nie udało się przetłumaczyć tekstu", "details": str(e), "api_response": output_data}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Błąd połączenia z DeepSeek API: {str(e)}"}), 500


@app.route("/api/generate", methods=['POST'])
def generate_text():
    data = request.get_json()
    prompt = data.get("prompt")
    if not prompt:
        return jsonify({"error": "Brak promptu w zapytaniu"}), 400
    
    try:
        output_data = query_deepseek(prompt)
        generated_content = output_data['choices'][0]['message']['content']
        return jsonify([{"generated_text": generated_content}])
    except (KeyError, IndexError) as e:
        return jsonify({"error": "Nie udało się sparsować odpowiedzi z DeepSeek", "details": str(e), "api_response": output_data}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Błąd połączenia z DeepSeek API: {str(e)}"}), 500


# ### NOWE/ZMODYFIKOWANE ENDPOINTY DLA ZARZĄDZANIA HISTORIAMI PRZEZ FIRESTORE ###

@app.route("/api/stories", methods=['GET'])
def get_all_stories_firestore():
    try:
        stories_ref = db.collection('stories')
        docs = stories_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).stream()
        
        stories_list = []
        for doc in docs:
            story_data = doc.to_dict()
            story_data['id'] = doc.id
            if 'timestamp' in story_data and hasattr(story_data['timestamp'], 'isoformat'):
                story_data['timestamp'] = story_data['timestamp'].isoformat()
            stories_list.append(story_data)
        
        return jsonify(stories_list)
    except Exception as e:
        return jsonify({"error": f"Błąd podczas pobierania historii z Firestore: {e}"}), 500


@app.route("/api/stories", methods=['POST'])
def add_story_firestore():
    data = request.get_json()
    title = data.get('title')
    text = data.get('text')

    if not title or not text:
        return jsonify({"error": "Tytuł i tekst są wymagane"}), 400
    
    try:
        # Generuj hash SHA256 z tekstu historii
        # Użyjemy go do sprawdzania duplikatów, aby uniknąć limitów rozmiaru pola w zapytaniach Firestore
        text_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()

        stories_ref = db.collection('stories')
        # Sprawdź duplikaty po hashu, nie po całym tekście
        existing_stories = stories_ref.where('text_hash', '==', text_hash).limit(1).get()
        for doc in existing_stories:
            return jsonify({"message": "Historia o tej treści już istnieje", "id": doc.id}), 200

        # Dodaj nową historię
        new_story_data = {
            'title': title,
            'text': text,
            'text_hash': text_hash, # Zapisz hash razem z historią
            'timestamp': firestore.SERVER_TIMESTAMP
        }
        doc_ref = stories_ref.add(new_story_data)
        
        added_doc = doc_ref[1].get() 
        added_story = added_doc.to_dict()
        added_story['id'] = added_doc.id
        if 'timestamp' in added_story and added_story['timestamp']:
            added_story['timestamp'] = added_story['timestamp'].isoformat()
        
        return jsonify(added_story), 201
    except Exception as e:
        return jsonify({"error": f"Błąd podczas dodawania historii do Firestore: {e}"}),


@app.route("/api/stories/<string:story_id>", methods=['DELETE']) # Zmieniamy <int:story_id> na <string:story_id>
def delete_story_firestore(story_id):
    try:
        db.collection('stories').document(story_id).delete()
        return jsonify({"message": "Historia usunięta pomyślnie"}), 200
    except Exception as e:
        return jsonify({"error": f"Błąd podczas usuwania historii z Firestore: {e}"}), 500

# Endpoint do wczytywania konkretnej historii po ID (opcjonalny, ale przydatny)
@app.route("/api/stories/<string:story_id>", methods=['GET'])
def get_story_by_id_firestore(story_id):
    try:
        doc = db.collection('stories').document(story_id).get()
        if doc.exists:
            story_data = doc.to_dict()
            story_data['id'] = doc.id
            if 'timestamp' in story_data and story_data['timestamp']:
                story_data['timestamp'] = story_data['timestamp'].isoformat()
            return jsonify(story_data)
        else:
            return jsonify({"error": "Historia nie znaleziona"}), 404
    except Exception as e:
        return jsonify({"error": f"Błąd podczas pobierania historii z Firestore: {e}"}), 500


# ### NOWY ENDPOINT: WYSYŁANIE SŁÓW Z NOTATNIKA NA E-MAIL ###
@app.route("/api/send-notebook-email", methods=['POST'])
def send_notebook_email():
    data = request.get_json()
    recipient_email = data.get('recipient_email')
    notebook_words = data.get('notebook_words') # To będzie lista obiektów {original, translated}

    if not recipient_email or not notebook_words:
        return jsonify({"error": "Adres e-mail odbiorcy i słowa z notatnika są wymagane."}), 400
    
    if not all([EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD]):
        return jsonify({"error": "Konfiguracja serwera pocztowego jest niekompletna. Skontaktuj się z administratorem."}), 500

    email_body = "Oto Twoje słowa z notatnika AI English Buddy:\n\n"
    for entry in notebook_words:
        email_body += f"- {entry['original']} - {entry['translated']}\n"
    email_body += "\nPowodzenia w nauce!"

    msg = MIMEText(email_body, 'plain', 'utf-8')
    msg['Subject'] = "Twoje słówka z notatnika AI English Buddy"
    msg['From'] = EMAIL_USERNAME
    msg['To'] = recipient_email

    try:
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.starttls() # Użyj TLS
            server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
            server.send_message(msg)
        return jsonify({"message": "Słówka wysłane pomyślnie na e-mail."}), 200
    except smtplib.SMTPAuthenticationError as e:
        print(f"Błąd uwierzytelniania SMTP: {e}")
        return jsonify({"error": "Błąd uwierzytelniania serwera pocztowego. Sprawdź login/hasło."}), 500
    except Exception as e:
        print(f"Błąd podczas wysyłania e-maila: {e}")
        return jsonify({"error": f"Nie udało się wysłać e-maila: {e}"}), 500

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

        return jsonify(mastery_data), 200

    except Exception as e:
        print(f"Błąd przygotowania Mastery Path: {e}")
        return jsonify({"error": f"Błąd serwera AI: {e}"}), 500

@app.route('/api/mastery-evaluate', methods=['POST'])
def evaluate_mastery():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file"}), 400
    
    audio_file = request.files['audio']
    original_text = request.form.get('target_text', '')
    
    # HF Inference API for Whisper
    HF_TOKEN = os.getenv("HF_API_TOKEN")
    API_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v3-turbo"
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}

    try:
        # 1. Transkrypcja
        audio_data = audio_file.read()
        print(f"Sending audio to Whisper Turbo... Size: {len(audio_data)} bytes")
        
        # Jawną specyfikacja formatu może pomóc HF API
        asr_headers = headers.copy()
        asr_headers["Content-Type"] = "audio/webm" 
        
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

        # 2. Ewaluacja przez AI
        evaluation_prompt = f"""
        Objective: Compare a student's speech transcription with the target English text.
        Target: "{original_text}"
        Transcription: "{transcription}"

        Provide:
        1. A score from 0 to 100.
        2. "corrections": A short markdown string highlighting differences (e.g., missing words, wrong pronunciation). Use ~~strikethrough~~ for extra words, **bold** for correctly matched, and *italics* for expected but missed words.
        3. A brief motivational tip in Polish.

        Respond in JSON format:
        {{
          "score": 85,
          "transcription": "...",
          "corrections": "...",
          "tip": "..."
        }}
        """
        
        if not client:
             print("DeepSeek client is not initialized.")
             return jsonify({"error": "AI Evaluation service is currently unavailable (missing API key)."}), 500

        print(f"Starting DeepSeek evaluation for: {original_text[:20]}...")
        ai_response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": evaluation_prompt}],
            response_format={"type": "json_object"}
        )
        
        print("DeepSeek responded. Parsing JSON...")
        result = json.loads(ai_response.choices[0].message.content)
        print("Mastery evaluation complete.")
        return jsonify(result)

    except Exception as e:
        print(f"CRITICAL ERROR in evaluate_mastery: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # db.create_all() # Nie potrzebne dla Firestore, Firebase zarządza strukturą dokumentów
    # print("Baza danych zainicjalizowana.")
    app.run(debug=True, port=5001)