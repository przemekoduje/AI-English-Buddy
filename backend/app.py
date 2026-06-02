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


# Klient OpenAI / DeepSeek
client = None
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")

if OPENAI_API_KEY:
    client = OpenAI(api_key=OPENAI_API_KEY)
    print("Klient OpenAI zainicjalizowany.")
    MODEL_NAME = "gpt-4o-mini"
    API_URL = "https://api.openai.com/v1/chat/completions"
    API_TOKEN = OPENAI_API_KEY
elif DEEPSEEK_API_KEY:
    client = OpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url="https://api.deepseek.com"
    )
    print("Klient DeepSeek zainicjalizowany.")
    MODEL_NAME = "deepseek-chat"
    API_URL = "https://api.deepseek.com/chat/completions"
    API_TOKEN = DEEPSEEK_API_KEY
else:
    print("OSTRZEŻENIE: Brak klucza OPENAI_API_KEY lub DEEPSEEK_API_KEY w .env.")
    MODEL_NAME = "gpt-4o-mini"
    API_URL = "https://api.openai.com/v1/chat/completions"
    API_TOKEN = ""

import secrets

def hash_password(password):
    # Standard, secure salt and sha256
    salt = "ai_buddy_secret_salt_123!"
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

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

def parse_story_response(generated_content):
    start_idx = generated_content.find('{')
    end_idx = generated_content.rfind('}')
    
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        json_str = generated_content[start_idx:end_idx + 1]
        
        try:
            parsed = json.loads(json_str)
            title = parsed.get("title", "My AI Story").strip()
            story = parsed.get("story", "").strip()
            if title and story:
                return title, story
        except Exception:
            pass

        title = "My AI Story"
        story = ""

        title_match = re.search(r'"title"\s*:\s*"((?:[^\n"\\]|\\.)*)"', json_str)
        if title_match:
            title_raw = title_match.group(1)
            try:
                title = json.loads('"' + title_raw + '"')
            except Exception:
                title = title_raw.strip()

        story_match = re.search(r'"story"\s*:\s*"((?:[^"\\]|\\.)*)"', json_str, re.DOTALL)
        if story_match:
            story_raw = story_match.group(1)
            story_escaped = story_raw.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
            try:
                story = json.loads('"' + story_escaped + '"')
            except Exception:
                story = story_raw.replace('\\"', '"').replace('\\\\', '\\').replace('\\t', '\t').replace('\\n', '\n')
        else:
            story = json_str

        if title and story:
            return title.strip(), story.strip()

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

    if not topics and not custom_details.strip():
        return jsonify({"error": "Brak wybranych tematów lub opisu szczegółów w zapytaniu"}), 400

    # Dynamic prompt construction
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
                "focus_area": "none"
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
        "focus_area": data.get("focus_area", "none")
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

        Respond in JSON format:
        {{
          "score": 85,
          "transcription": "...",
          "corrections": "...",
          "tip": "..."
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

@app.route("/api/tts", methods=['GET', 'POST'])
def get_tts_audio():
    if request.method == 'POST':
        data = request.get_json() or {}
        text = data.get("text", "")
        voice = data.get("voice", "en-US-BrianNeural")
    else:
        text = request.args.get("text", "")
        voice = request.args.get("voice", "en-US-BrianNeural")

    if "Neural" not in voice:
        voice = "en-US-BrianNeural"
    if not text:
        return jsonify({"error": "Brak parametru text"}), 400

    async def get_all_audio():
        communicate = edge_tts.Communicate(text, voice)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        return audio_data

    try:
        data = asyncio.run(get_all_audio())
        base64_data = base64.b64encode(data).decode('utf-8')
        return jsonify({"audio_base64": base64_data})
    except Exception as e:
        return jsonify({"error": f"Błąd generowania mowy: {str(e)}"}), 500

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
            asr_headers["Content-Type"] = "audio/webm"
            
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
    4. Respond ONLY with a valid JSON object. Do NOT include markdown code blocks or extra characters.
    
    Example format:
    {{
      "is_correct": true,
      "score": 90,
      "feedback": "Twoja odpowiedź jest poprawna i dobrze sformułowana. Świetna robota!"
    }}
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
            asr_headers["Content-Type"] = "audio/webm"
            
            response = requests.post(API_URL, headers=asr_headers, data=audio_data, timeout=30)
            if response.status_code == 200:
                transcription_result = response.json()
                transcription = transcription_result.get("text", "").strip()
            else:
                print(f"Whisper error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"Whisper error in chat: {e}")

    if 'audio' in request.files and not transcription:
        return jsonify({"error": "Nie wykryto mowy. Spróbuj mówić głośniej."}), 400

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
    4. Respond ONLY with a valid JSON object. Do NOT include markdown code blocks or extra characters.
    
    JSON format structure:
    {{
      "user_evaluation": {{
        "score": 85,
        "is_correct": true,
        "feedback": "..."
      }},
      "bot_response": "..."
    }}
    
    If it's the start (no user answer), set "user_evaluation" to null.
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
        return jsonify(result)
    except Exception as e:
        print(f"Error in chat-next: {e}")
        return jsonify({"error": f"Błąd komunikacji z serwisem AI: {str(e)}"}), 500

if __name__ == "__main__":
    # db.create_all() # Nie potrzebne dla Firestore, Firebase zarządza strukturą dokumentów
    # print("Baza danych zainicjalizowana.")
    app.run(debug=True, host='0.0.0.0', port=5001)