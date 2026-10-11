# 🎨 Speakling (AI-English-Buddy) — Aktualna Specyfikacja Designu (`Design.md`)

> **Data aktualizacji:** 2026-10-11  
> **Status:** Aktualny stan wdrożenia produkcyjnego (https://przemokoduje.com/speakling)  
> **Przeznaczenie:** Kompletna dokumentacja architektury UI/UX, tokenów projektowych, układów poszczególnych widoków oraz zasad estetycznych wdrożonych na podstawie projektów Figma i wytycznych Apple-clean minimalism.

---

## 1. 📌 Wizja Produktu i Filozofia Estetyczna

**Speakling** to nowoczesna platforma do nauki języka angielskiego oparta na sztucznej inteligencji (Gemini Live, Claude, Edge TTS, Google Cloud TTS) oraz neuronauce poznawczej. Łączy konwersacje głosowe w czasie rzeczywistym, interaktywne czytanie z natychmiastowym tłumaczeniem, automatycznie generowane historie, analizę wideo z transkrypcjami oraz metody aktywnego przypominania (Active Recall) i powtórek interwałowych (Spaced Repetition).

### Główne Zasady Projektowe
1. **Apple-Clean & Minimalizm**: Usunięcie zbędnych ikon, dekoracji i przeładowanych kontenerów. Czyste, lekkie karty, harmonijne odstępy (whitespace) i wysoka czytelność.
2. **Kierowanie Uwagi (Cognitive Focus)**: Interfejs nie rozprasza uwagi. Istotne akcje posiadają wyraźną hierarchię (np. przycisk Mastery Path wyróżniony gradientem na tle minimalistycznej siatki narzędzi).
3. **Płynne Mikroanimacje**: Zbalansowane przejścia CSS (`150ms – 250ms cubic-bezier(0.16, 1, 0.3, 1)`), płynne wysuwanie galerii, delikatne podnoszenie kart (`translateY(-1px..-2px)`) przy najechaniu.
4. **Jednolity Język Wizualny**: Wszystkie widoki korzystają z tych samych promieni zaokrągleń (`border-radius: 12px`, `16px`, `20px`, `999px`), subtelnych cieni oraz palety Slate/Purple/Blue/Orange.

---

## 2. 🎨 Globalne Tokeny Projektowe (Design Tokens)

### 2.1 Paleta Kolorów

#### Akcenty i Wyróżnienia
- **Mastery & Primary Violet**: `#7c3aed` / `#8b5cf6` — Gradienty Mastery Path, kluczowe akcenty edukacyjne.
- **Brand Blue**: `#1a73e8` / `#2563eb` — Główne akcje, odnośniki, quizy.
- **Narrator Orange (Audio Reading)**: 
  - Tło czytanego zdania: `#fff7ed` (delikatny ciepły krem/pomarańcz)
  - Lewa krawędź akcentująca: `#f97316` (3px border)
  - Tekst czytany: `#7c2d12` (głęboki, czytelny brąz/pomarańcz)
- **Active Chat Blue / Live Orb**: `#0284c7` / `#38bdf8` — Przyciski i wskaźniki połączenia na żywo.
- **Success Green**: `#10b981` — Opanowane słówka, wysoki wynik quizu.
- **Warning Amber**: `#f59e0b` — Powtórki, wskaźniki podsumowań.
- **Danger Red**: `#ef4444` — Usuwanie słówek (kosz), zakończenie sesji.

#### Powierzchnie (Light Surfaces)
- **Tło aplikacji (`--bg-main`)**: `#f8fafc` / `#f1f5f9`
- **Karty (`--bg-card`)**: `#ffffff`
- **Karty hover**: `#fafafa` / `#f8fafc`
- **Ramki (`--border`)**: `#e2e8f0` (subtelny, naturalny kontur)
- **Ramki aktywne / hover**: `#cbd5e1` / `#7c3aed`

#### Typografia i Kolory Tekstu
- **Tekst główny (Headings & Bold)**: `#0f172a` (Slate 900)
- **Tekst podstawowy (Body)**: `#1e293b` (Slate 800)
- **Tekst pomocniczy (Muted / Subtitles)**: `#64748b` (Slate 500)
- **Tekst wygaszony (Placeholders / Icons)**: `#94a3b8` (Slate 400)

### 2.2 Typografia
- **Fonty**: `'Outfit'`, `'Inter'`, `'Roboto'`, system-ui, sans-serif
- **Hierarchia**:
  - `H1` (Tytuł artykułu/historii): `2.2rem` (35px), font-weight: `800`, line-height: `1.2`
  - `H2` (Nagłówki sekcji): `1.4rem` (22px), font-weight: `700`
  - `H3` (Tytuły kart bocznych): `1.1rem` (17.5px), font-weight: `700`
  - `Body Story Text`: `1.15rem` (18.5px), line-height: `1.75`, font-weight: `400`
  - `Badges & Labels`: `0.72rem – 0.8rem`, font-weight: `700`, text-transform / rounded pills

### 2.3 Zaokrąglenia i Cienie
- **Zaokrąglenia**:
  - Kafelki narzędzi, inputy: `12px`
  - Przyciski banerowe (Mastery Hero): `14px`
  - Główne kontenery kart: `20px`
  - Pigułki (Pills, Chips, Badges, Okrągłe przyciski): `999px`
- **Cienie (Elevation)**:
  - `Card Base`: `0 2px 12px -2px rgba(0, 0, 0, 0.03)`
  - `Card Hover`: `0 6px 18px rgba(0, 0, 0, 0.06)`
  - `Mastery Button Glow`: `0 4px 14px rgba(124, 58, 237, 0.25)`

---

## 3. 🖥️ Szczegółowa Specyfikacja Widoków

---

### 3.1 Workspace (Czytelnia i Centrum Nauki — Figma Redesign)

Układ podzielony jest na dwie główne kolumny desktopowe:

#### Lewa Kolumna: Czytelnik i Tekst Historii
1. **Pasek postępu (Top Progress Bar)**:
   - Dyskretny pasek postępu czytania (`reading-progress-bar`) w skali 0–100%.
   - Etykieta `Reading progress · X%` po lewej oraz `Continue where you left off` po prawej.
2. **Nagłówek Historii**:
   - Pigułki meta-danych: Odznaka poziomu CEFR (np. `B2`) oraz kategoria tematyczna (np. `Business`).
   - Tytuł opowiadania (`H1`): duża, elegancka typografia.
   - Pasek statystyk: liczba słów (np. `255 words`), szacowany czas czytania (`2 min read`), data utworzenia.
3. **Pasek Narzędzi Czytania (Toolbar)**:
   - Przycisk `Listen / Pause` z ikoną głośnika / pauzy.
   - Przycisk `Translate` (tłumaczenie całego akapitu/tekstu).
   - Przełącznik rozmiaru tekstu (`T`).
   - Przycisk kopiowania treści historii ze wskaźnikiem toast.
   - Dyskretna wskazówka: `Click any word to explore it.`
4. **Interaktywny Tekst Opowiadania**:
   - **Podświetlenie czytanego zdania**:
     - Pełne zdanie aktualnie odczytywane przez lektora ma ciepłe tło `#fff7ed`, lewą ramkę `3px solid #f97316` oraz zaokrąglone narożniki (`8px`).
     - **Pauza i wznawianie**: Jeśli użytkownik kliknie słowo w trakcie czytania, aby podejrzeć tłumaczenie, odtwarzanie lektora zatrzymuje się, ale **pomarańczowe podświetlenie zdania pozostaje widoczne**. Po ponownym kliknięciu słowa (zamknięciu dymku), lektor wznawia czytanie od początku tego zdania.
   - **Interaktywne słowa**: Każde słowo reaguje na kliknięcie, otwierając dymek tłumaczenia z wymową audio i opcją natychmiastowego zapisania do słownika.

#### Prawa Kolumna: Trzy Karty Boczne (Sidebar)

1. **Karta 1 (Góra, Sticky): `story-words-card` (Words in this story)**
   - Pozycjonowanie: Zawsze na samej górze panelu bocznego, z zachowaniem właściwości `position: sticky; top: 1rem; z-index: 10`, dzięki czemu pozostaje widoczna podczas przewijania długiego tekstu.
   - Nagłówek: Tytuł `Words in this story` wraz z odznaką liczbową (np. `3`).
   - Lista słówek:
     - Angielskie słowo wytłuszczonym krojem.
     - Czyste tłumaczenie w języku polskim (usunięto zbędne dopiski typu `· noun · B1`).
     - **Akcje słowa**:
       - **Ikonka głośnika (`volume-2`)**: Natychmiastowe odtworzenie czystej wymowy słowa.
       - **Ikonka kosza (`trash-2`)**: Usunięcie słowa ze słownika i natychmiastowe ukrycie go z widoku karty.
   - Stopka karty: Przycisk `Open vocabulary` z ikoną książki, przekierowujący bezpośrednio do pełnego widoku **Vocabulary View** (`'notebook'`).

2. **Karta 2 (Środek): `learning-buddy-card` (Story Mastery & Ćwiczenia)**
   - Nagłówek: `✨ Story Mastery & Ćwiczenia`.
   - Opis: *„Opanuj tę historię w 3 krokach z Mastery Path oraz utrwalaj słownictwo za pomocą interaktywnych fiszek i quizów.”*
   - **Główny Przycisk Banerowy (Mastery Hero Button)**:
     - Fioletowo-indygo gradient (`linear-gradient(135deg, #7c3aed, #6366f1)`).
     - Tytuł: `Mastery Path` + pigułka `3 kroki`.
     - Podtytuł: `Poznaj tekst w 3 krokach`.
     - Strzałka nawigacji `→`.
     - Uruchamia `PracticeMode` (3 fazy: Shadowing, Słownictwo, Konwersacja).
   - **Siatka Narzędzi Treningowych (2x2 Grid)**:
     - **Fiszki (`Flashcards`)**: Fioletowa ikonka kart; uruchamia interaktywne odwracane fiszki ze słówek historii.
     - **Quiz słówek (`Vocabulary Quiz`)**: Niebieska ikonka z ptaszkiem; uruchamia generowany przez AI test tłumaczeniowy.
     - **Podsumowanie AI (`AI Summary`)**: Bursztynowa ikonka wykresu; generuje raport sesji i rekomendacje.
     - **E-mail (`Export`)**: Błękitna ikonka koperty; wysyła listę słówek na e-mail użytkownika.

3. **Karta 3 (Dół): `small-steps-card` (Small steps count)**
   - Delikatna karta motywacyjna z ikoną żarówki `💡`.
   - Porada neuronaukowa: *„Read a sentence aloud, then say it in your own words. Retrieval makes learning stick.”*

4. **Pływający Przycisk (FAB): `Chat Live`**
   - Pozycja: Prawy dolny róg (`fixed; bottom: 2rem; right: 2rem; z-index: 99`).
   - Pigułka z niebieskim gradientem i ikoną fal dźwiękowych `Chat Live`.

---

### 3.2 My Vocabulary (Word Bank — Czysty Minimalizm Apple)

- **Czysta Typografia i Przestrzeń**: Całkowite odejście od przeładowanych, kolorowych ikon.
- **Zakładki Kategorii**:
  - `All`, `New`, `Review`, `Mastered`.
  - Minimalistyczne linie podziału i aktywne wskaźniki podświetlenia.
- **Wyszukiwarka i Filtry**:
  - Pasek wyszukiwania z ikoną lupy, natychmiastowe filtrowanie fraz i definicji.
- **Karty Słów**:
  - Pigułka poziomu CEFR (np. `A2`, `B1`, `B2`).
  - Główne słowo w języku angielskim + transkrypcja fonetyczna IPA.
  - Czyste tłumaczenie na język polski.
  - Przycisk wymowy audio (subtelny głośnik).
  - Przycisk usunięcia słowa (dyskretny kosz, widoczny na hover lub w menu akcji).
  - Zdanie kontekstowe z pogrubionym słowem docelowym.
- **Paginacja / Widok Karuzeli**:
  - Ograniczenie do **5 aktualnie widocznych słówek**, płynnie przesuwanych w miarę postępu użytkownika.

---

### 3.3 Media Buddy (Wideo i Zsynchronizowany Transkrypt)

- **Przycisk Wideo i Wysuwana Galeria**:
  - Przycisk `Wideo` / `Wybierz klip`.
  - **Animowana pozioma galeria**: Po kliknięciu sekcja wyboru klipów wysuwa się płynnie w dół poniżej przycisku, przesuwając resztę elementów w dół.
  - Wybór konkretnego wideo natychmiast ładuje klip i automatycznie zwija galerię z powrotem.
- **Układ Dwukolumnowy**:
  - **Lewa kolumna**:
    - Odtwarzacz wideo (YouTube / HTML5).
    - **`synced-transcript-card`**: Karta transkryptu ze zsynchronizowanym podświetlaniem wypowiedzi. Posiada ograniczenie wysokości (`max-height: calc(90vh - 120px)`), dzięki czemu spód elementu nigdy nie przekracza 90% wysokości ekranu (90vh).
  - **Prawa kolumna**:
    - **Góra**: `words-keeping-card` (Kluczowe słownictwo do zachowania z lekcji wideo).
    - **Dół**: `lesson-details-card` (Szczegóły lekcji, opis, poziom trudności, ćwiczenia).

---

### 3.4 Chat Live / Dashboard (Gemini Live Voice Orb)

- **Główny Wizualizator Głosu**:
  - Wielopierścieniowy, animowany orb reagujący na strumień audio w czasie rzeczywistym.
  - Stany: *Idle/Breathing* (delikatne pulsowanie fioletowo-niebieskie), *Listening* (rozszerzające się fale częstotliwości), *Speaking* (dynamiczna fala odpowiedzi AI).
- **Dolny Panel Sterowania**:
  - Przełącznik mikrofonu (Mic on/off).
  - Przełącznik kamery / udostępniania ekranu.
  - Panel boczny z transkrypcją rozmowy na żywo i możliwością zapisu słówek do notatnika.

---

### 3.5 Good to Know & Ćwiczenia Oddechowe (4-7-8 Breathing Widget)

- **Karty Wiedzy**: Spójne z jasnym motywem aplikacji, białe karty z ramką `#e2e8f0`.
- **Widget Oddechowy 4-7-8 (Neuroscience Calming)**:
  - W pełni zintegrowany z jasnym designem (usunięto ciemne, prześwitujące tła).
  - Płynnie powiększający się okrąg oddechowy (140px skalowane do 1.55x) z animacją faz:
    - *Wdech (4s)*: subtelny cyjan `#38bdf8`
    - *Zatrzymanie (7s)*: indygo `#6366f1`
    - *Wydech (8s)*: szmaragdowa zieleń `#10b981`
  - Wygładzone przejścia z timerem i instrukcjami fizjologicznymi.

---

## 4. 📱 Responsywność i Strategia Ekranów

1. **Desktop (`> 1024px`)**:
   - Pełny układ 2-kolumnowy z przyklejonym (sticky) paskiem bocznym.
   - Pływający FAB w rogu ekranu.
2. **Tablet (`768px – 1024px`)**:
   - Skompresowany panel boczny, menu wysuwane w drawerze.
3. **Mobile (`< 768px`)**:
   - Dedykowana, natywnie zoptymalizowana wersja mobilna oparta na Expo Web pod adresem: `/speakling/mobile/`.
   - Dotykowe cele o minimalnym rozmiarze `44px x 44px`.

---

## 5. 🔄 Procedura Wdrażania i Integracji

Zgodnie z regułami projektu opisanymi w `.agents/AGENTS.md`:
- Po każdej modyfikacji kodu frontendowego i stylów następuje automatyczna kompilacja (`npm run build --prefix frontend`).
- Uruchamiany jest skrypt publikacyjny `./deploy.sh` (Firebase Hosting dla projektów `speakling-live-temp`, `przemokoduje-online`, `ai-english-buddy-150e5`).
- Zmiany są automatycznie zatwierdzane i wypychane do repozytorium GitHub (`git commit` + `git push origin main`), co automatycznie aktualizuje produkcję dostępną pod adresem:
  **https://przemokoduje.com/speakling**
