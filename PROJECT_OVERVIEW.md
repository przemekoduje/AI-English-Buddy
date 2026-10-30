# Speakling (AI-English-Buddy) — Architektura i Przewodnik po Projekcie

> **Cel dokumentu**: Zwięzła, gęsta semantycznie specyfikacja aplikacji dla zewnętrznych modeli językowych (LLM) i programistów. Zawiera esencję architektury, przepływów danych, logiki biznesowej i kluczowych wzorców, eliminując zbędny boilerplate.

---

## 1. Czym jest Speakling?
**Speakling** (nazwa repozytorium: `AI-English-Buddy`) to zaawansowana platforma webowo-mobilna do immersyjnej nauki języka angielskiego. Łączy cztery filary:
1. **Interaktywne czytanie (Reader / Workspace)**: generowanie historii AI dopasowanych do poziomów CEFR (A1–C2), podział na części, lektor neural TTS z podświetlaniem zdań, klikalne słowa (karty ze słownikiem, fonetyką IPA, tłumaczeniem kontekstowym i wykrywaniem idiomów).
2. **Gemini Live Audio Tutor**: konwersacje głosowe w czasie rzeczywistym w pełnym dupleksie (WebSockets) z natywnym modelem audio Google Gemini, z izolacją tur, transkrypcją na żywo i wieloma scenariuszami dydaktycznymi.
3. **Media / Subtitle Studio**: praca z wideo (YouTube) i zsynchronizowanymi napisami, klikalne słówka w napisach, tłumaczenia frazowe i shadow-reading.
4. **Słownik i powtórki (SRS)**: unikalny słownik podręczny dla każdej czytanki, globalny notatnik słówek, quizy translacyjne, fiszki, mnemotechniki AI oraz eksport e-mail.

* **Adres produkcyjny**: `https://przemokoduje.com/speakling`
* **Hosting**: Firebase Hosting (`speakling-live-temp.web.app/speakling`) + Google Cloud Run (Backend API).

---

## 2. Architektura Technologiczna

```
┌────────────────────────────────────────────────────────────────────────┐
│                        UŻYTKOWNIK (Web & Mobile)                       │
├───────────────────────────────────┬────────────────────────────────────┤
│ React 19 SPA (frontend/)          │ React Native / Expo Web (mobile/)  │
│ - Web Audio API (PCM16 AudioWork) │ - Wersja mobilna pod /mobile       │
│ - Gemini Live WebSocket Client    │ - Responsive touch gestures        │
└─────────────────┬─────────────────┴──────────────────┬─────────────────┘
                  │ HTTPS / WSS                        │ HTTPS / WSS
                  ▼                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     GOOGLE CLOUD RUN BACKEND                           │
│ - Python Flask (backend/app.py)                                        │
│ - DeepSeek API / OpenAI (generowanie opowiadań, analiza CEFR, lematy)  │
│ - Edge-TTS / Google TTS (synteza mowy w 7 głosach neural)              │
│ - Stripe API (płatności, subskrypcje, webhooks)                        │
└─────────────────┬────────────────────────────────────┬─────────────────┘
                  │                                    │
                  ▼                                    ▼
      Google Cloud Firestore              Google Gemini Live API
      - users / stories / vocabulary      - WebSocket (PCM 16kHz in,
      - subscriptions / settings            PCM 24kHz out)
```

### Stos technologiczny i struktura projektu
* **Struktura repozytorium**:
  * `frontend/`: React 19 SPA, Vanilla CSS, Web Audio API, klienty WebSocket i TTS.
  * `backend/`: Flask (Python 3.11), Cloud Run, `app.py` z REST API, Firestore, Stripe SDK.
  * `mobile/`: Expo 54 / React Native (eksportowane jako web app serwowane pod `/speakling/mobile`).
  * `deploy.ps1` / `deploy-backend.ps1`: automatyczne wdrożenia (Firebase Hosting + Cloud Run).
* **Frontend Web**: React 19, Vanilla CSS (bez Tailwind), Web Audio API, WebSocket.
* **Mobile Web**: React Native, Expo 54, Expo Router, `patch-viewport.py` (blokada zoomu i desktop redirect).
* **Backend**: Python 3.11 Flask, Gunicorn, Google Cloud Run, Secret Manager.
* **Baza Danych & Auth**: Google Cloud Firestore, Firebase Authentication (nagłówek `X-Session-Token` weryfikowany w Flask).
* **Zewnętrzne AI**:
  * **DeepSeek API** (`deepseek-chat`): generowanie opowiadań, tłumaczenia kontekstowe, lematyzacja słówek (`get_base_form`).
  * **Gemini Multimodal Live API**: audio WebSocket (`gemini-2.5-flash-native-audio-latest`).
  * **Microsoft edge-tts**: darmowe, wysokiej jakości głosy neuronowe (Brian, Guy, Christopher, Jenny, Aria, Sonia, Ryan).

---

## 3. Kluczowe Moduły i Logika Biznesowa

### 3.1. Interaktywny Workspace Czytania (`frontend/src/components/Workspace.js`)
* **Generowanie Opowiadań**:
  * Parametry: Tematyka (`Tech`, `Business`, `Daily Life`, `Travel`), poziom CEFR (`A1`–`C2`), opcjonalny prompt użytkownika.
  * Opowiadania wieloczęściowe: parametr `parent_id` łączy kolejne rozdziały (Part 1, Part 2...).
* **Podręczny słownik czytanki (Izolacja danych)**:
  * **Zasada absolutna**: Każda historia posiada swój unikalny słownik podręczny (`notebookWords`).
  * Klucz pamięci: `buddy_story_notebook_words_${userKey}_${storyId}`.
  * Przy tworzeniu **nowej** historii (`handleGenerateFigmaStory`, `generateStory`, `generateDefaultText`, `pasteStory`), słownik jest **natychmiast czyszczony do pustej tablicy `[]`**.
  * Zapytania do `/api/vocabulary?story_id=<id>` pobierają **wyłącznie** słówka tej konkretnej historii (brak pobierania `demo_default` dla historii użytkownika).
* **Karty Słów (`inlineWordData`)**:
  * Kliknięcie słowa w tekście czytanki pauzuje lektora i otwiera kartę: transkrypcja fonetyczna IPA, część mowy, poziom CEFR, polskie tłumaczenie kontekstowe, wykrywanie frazy/idiomu (`detectedChunk`), przycisk zapisu do słownika historii.
* **Mastery Path**:
  * 3-etapowa ścieżka opanowania czytanki: Krok 1 (Słuchanie i czytanie) → Krok 2 (Fiszki / Quiz słownictwa) → Krok 3 (Dyskusja głosowa Live z Gemini).

### 3.2. Czat Głosowy na Żywo Gemini Live (`frontend/src/services/GeminiLiveClient.js`, `Dashboard.js`)
* **Format Audio**:
  * Mikrofon klienta: PCM 16-bit, 16 000 Hz, mono.
  * Odtwarzanie odpowiedzi AI: PCM 16-bit, 24 000 Hz, mono (kolejkowane bufory przez `AudioContext`).
* **Role Konwersacyjne**:
  1. `story_discussion` — Dyskusja o przeczytanej historii, pytania o fabułę.
  2. `character_roleplay` — Wcielenie się w bohatera opowiadania.
  3. `retell_summarize` — Streszczenie historii własnymi słowami.
  4. `grammar_coach` — Ćwiczenie struktur gramatycznych z tekstu.
  5. `free_talk` — Luźna konwersacja na dowolny temat.
* **Protokół WebSocket (Gemini Multimodal Live API)**:
  * Handshake Setup: `{ setup: { model: "models/gemini-2.5-flash-native-audio-latest", generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } }, systemInstruction: { parts: [{ text: "..." }] }, inputAudioTranscription: {}, outputAudioTranscription: {} } }`
  * Klient Audio Chunks: `{ realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: "<base64_pcm>" }] } }`
  * Obsługa Barge-in: serwer wysyła `{ serverContent: { interrupted: true } }`, klient natychmiast czyści bufor odtwarzania `outputAudioContext`.
* **Kluczowe mechanizmy audio**:
  * Tłumienie echa (Acoustic Echo Cancellation): wstrzymywanie nasłuchu podczas wypowiedzi asystenta oraz okno ochronne 500ms po zakończeniu tury bota.
  * Śledzenie limitu minut: co 30 sekund synchronizacja zużytych sekund z `/api/subscription/track-live-time`.

### 3.3. Uproszczony Instant Translator (`frontend/src/components/Translator/TranslatorDrawer.js`)
* Wysuwany panel boczny dostępny globalnie (lub wywoływany z zaznaczenia tekstu w czytance).
* **Bezpośrednie pole edycji**: Górna karta źródłowa jest od razu aktywnym polem `<textarea>` — użytkownik może bezpośrednio wpisywać/wklejać dowolne słowa, frazy lub zdania bez klikania przycisków aktywujących.
* Automatyczne tłumaczenie debounced (500 ms) lub po `Enter`.
* Przełączanie kierunku tłumaczenia (swap), wymowa audio TTS, kopiowanie i bezpośredni zapis do słownika (*Save phrase to vocabulary*).

### 3.4. Media & Subtitle Studio (`frontend/src/components/Media/MediaBuddy.js`)
* Nauka z wideo (YouTube) z precyzyjnie zsynchronizowanymi napisami.
* Kliknięcie słowa w napisach pauzuje wideo i wyświetla definicję oraz tłumaczenie.
* Gotowe lekcje wideo (np. Atomic Habits, Steve Jobs) oraz możliwość dodawania własnych linków YouTube.

### 3.5. System Subskrypcji i Uprawnień
* **Pakiety**:
  * `starter`: darmowy dostęp demonstracyjny, limit 5 minut rozmowy Live.
  * `pro`: nielimitowane opowiadania, Mastery Path, 30 minut rozmów Live/mc.
  * `intensive`: 120 minut rozmów Live/mc, priorytetowe modele AI.
  * `admin`: pełen nielimitowany dostęp.
* **Symulacja ról**: Administrator może testować widok aplikacji jako dowolny pakiet za pomocą przełącznika ról (`admin_preview_role`).

---

## 4. Główne Kolekcje Firestore

| Kolekcja | Opis dokumentu | Kluczowe pola |
| :--- | :--- | :--- |
| `users` | Profil użytkownika | `email`, `created_at`, `settings`, `daily_streak` |
| `stories` | Wygenerowane lub zapisane opowiadania | `id`, `user_email`, `title`, `text`, `level`, `category`, `topics`, `parent_id`, `part_number`, `read_progress` |
| `vocabulary` | Zapisane słówka i frazy | `id`, `user_email`, `original`, `translated`, `story_id`, `context_sentence`, `item_type` (`word`/`phrase`), `timestamp`, `srs_level` |
| `subscriptions`| Stan subskrypcji Stripe | `user_email`, `tier` (`starter`/`pro`/`intensive`), `status`, `minutes_remaining`, `stripe_customer_id` |

---

## 5. Przegląd Kluczowych Endpointów Backendowych (`backend/app.py`)

### Opowiadania i Treść
* `POST /api/generate` — generowanie historii AI lub jej kontynuacji (`parent_id`).
* `GET /api/stories` — lista zapisanych opowiadań użytkownika.
* `GET /api/stories/<id>/parts` — pobranie wszystkich rozdziałów danej historii.
* `DELETE /api/stories/<id>` — usunięcie historii z bazy.

### Słownik i Tłumaczenia
* `GET /api/vocabulary?story_id=<id>` — pobranie słownictwa dla konkretnej historii lub zbiorczo.
* `POST /api/vocabulary` — dodanie słowa/frazy (automatyczna lematyzacja AI dla pojedynczych słów przez `get_base_form`).
* `DELETE /api/vocabulary/<word>?story_id=<id>` — usunięcie słowa ze słownika historii.
* `POST /api/translate` — szybkie tłumaczenie słowa/zdania w kontekście.

### Audio i Konwersacje Live
* `POST /api/tts` — synteza mowy Edge-TTS (zwraca `audio_base64`).
* `GET /api/live/config` — pobranie konfiguracji połączenia WebSocket Gemini Live.
* `POST /api/subscription/track-live-time` — zliczanie zużytych sekund rozmowy głosowej.

### Subskrypcje Stripe
* `POST /api/stripe/create-checkout-session` — inicjalizacja płatności Stripe.
* `POST /api/stripe/create-portal-session` — zarządzanie subskrypcją w portalu klienta Stripe.
* `POST /api/stripe/webhook` — obsługa zdarzeń Stripe (odnowienia, anulowania).

---

## 6. Żelazne Zasady Wdrażania (DevOps)

1. **Wdrożenie Frontendu (Web + Mobile)**:
   * Po **każdej** modyfikacji kodu frontendowego (`frontend/*` lub `mobile/*`) należy uruchomić:
     ```powershell
     .\deploy.ps1
     ```
   * Skrypt ten buduje wersję mobilną Expo, kompiluje React Web, kopiuje wersję mobilną do `/speakling/mobile` i wdraża całość na **Firebase Hosting**.

2. **Wdrożenie Backendowego API**:
   * Jeśli zmiany obejmowały kod backendu (`backend/*`), **bezwzględnie** należy uruchomić wdrożenie na Google Cloud Run:
     ```powershell
     .\deploy-backend.ps1
     ```
   * *Uwaga*: Sam `git push` nie posiada webhooka budującego kontenery na Cloud Run.

3. **Repozytorium Git**:
   * Zawsze zatwierdzaj i wypychaj zmiany: `git commit` + `git push origin main`.
