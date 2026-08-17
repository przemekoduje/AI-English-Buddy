import os
import json
from dotenv import load_dotenv
from openai import OpenAI

# Wczytaj zmienne środowiskowe z backend/.env
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
print("OPENAI_API_KEY exists:", bool(OPENAI_API_KEY))

if OPENAI_API_KEY:
    client = OpenAI(api_key=OPENAI_API_KEY)
    MODEL_NAME = "gpt-4o-mini"
    
    system_prompt = (
        "Jesteś zaawansowanym asystentem do nauki języka angielskiego.\n"
        "Twoim zadaniem jest wygenerowanie pytania quizowego typu jednokrotnego wyboru (3 opcje) dla podanego angielskiego słowa lub frazy (Target word).\n"
        "Cel quizu: Użytkownik musi wskazać jedno słowo/frazę spośród 3 podanych, którego znaczenie jest najbardziej zbliżone (synonim) do słowa głównego (Target word).\n\n"
        "Zasady:\n"
        "1. Podaj pytanie w języku polskim pytające o słowo o podobnym znaczeniu do słowa głównego, np. 'Wskaż słowo o podobnym znaczeniu do \"Compulsory\":'\n"
        "2. Wygeneruj dokładnie 3 opcje odpowiedzi. Każda opcja musi zawierać angielskie słowo/frazę oraz w nawiasie jego krótkie polskie tłumaczenie / objaśnienie, np.:\n"
        "   - Optional (opcjonalny / dobrowolny)\n"
        "   - Mandatory (obowiązkowy / nakazany)\n"
        "   - Temporary (tymczasowy)\n"
        "3. Dokładnie jedna z tych opcji musi być poprawną odpowiedzią (synonimem lub słowem o bardzo zbliżonym znaczeniu do Target word).\n"
        "4. Pozostałe dwie opcje (dystraktory) muszą mieć inne znaczenie (mogą to być antonimy lub inne słowa, ale nie mogą być synonimami słowa głównego).\n"
        "5. Zwróć strukturę w formacie JSON z kluczami:\n"
        "   - 'question': treść pytania (str)\n"
        "   - 'options': lista 3 obiektów, każdy z kluczami 'text' (str, zawierający słowo angielskie i polskie tłumaczenie w nawiasie) oraz 'is_correct' (boolean).\n"
        "6. Odpowiedz wyłącznie poprawnym kodem JSON bez dodatkowych komentarzy czy formatowania markdown."
    )

    input_data = {
        "word": "giddy",
        "translation": "oszołomiony zawrotny, zwariowany"
    }

    try:
        print("Calling OpenAI completions...")
        ai_response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(input_data, ensure_ascii=False)}
            ],
            response_format={"type": "json_object"}
        )
        print("Raw response content:")
        print(ai_response.choices[0].message.content)
    except Exception as e:
        print("Error during API call:", e)
else:
    print("Brak klucza API w .env")
