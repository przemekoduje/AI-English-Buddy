# Dokumentacja GCP Secret Manager & Mapowanie Domeny (Speakling)

Ta dokumentacja opisuje procedurę bezpiecznego przechowywania danych uwierzytelniających w usłudze **Secret Manager** na platformie Google Cloud Platform (GCP) oraz procedurę podpięcia własnej domeny `przemokoduje.com/speakling`.

---

## 1. Konfiguracja Secret Manager w GCP

### Krok 1: Włączenie Secret Manager API
1. Zaloguj się do [Konsoli GCP](https://console.cloud.google.com/).
2. Wybierz swój projekt (np. `speakling` lub powiązany projekt Firebase).
3. W wyszukiwarce u góry wpisz **Secret Manager** i kliknij go.
4. Jeśli API jest nieaktywne, kliknij **Enable**.

### Krok 2: Utworzenie Sekretów
Dla każdej wrażliwej zmiennej środowiskowej utwórz nowy sekret:
1. Kliknij przycisk **+ Create Secret** u góry strony.
2. Wprowadź nazwę sekretu (rekomendowane używanie wielkich liter) oraz jego wartość (np. klucz API):
   - `OPENAI_API_KEY` – Klucz API OpenAI.
   - `DEEPSEEK_API_KEY` – Klucz API DeepSeek.
   - `HF_API_TOKEN` – Token API Hugging Face.
   - `EMAIL_PASSWORD` – Hasło aplikacji Gmail do wysyłki e-maili.
   - `FIREBASE_CREDENTIALS_JSON` – Cała zawartość pliku JSON konta serwisowego Firebase (skopiowana bezpośrednio i wklejona jako tekst).
3. Pozostaw domyślne ustawienia replikacji (Automatic) i kliknij **Create Secret**.

### Krok 3: Nadanie uprawnień dla konta serwisowego Cloud Run
Aby Cloud Run mógł odczytywać sekrety przy starcie, jego tożsamość musi mieć rolę **Secret Manager Secret Accessor**:
1. Przejdź do zakładki **IAM & Admin** -> **IAM**.
2. Znajdź konto serwisowe używane przez Cloud Run (domyślnie jest to `[numer-projektu]-compute@developer.gserviceaccount.com` lub dedykowane konto serwisowe, np. `speakling-runner@...`).
3. Kliknij ikonę ołówka (**Edit member**).
4. Kliknij **Add another role**, wyszukaj **Secret Manager Secret Accessor** (rola: `roles/secretmanager.secretAccessor`) i wybierz ją.
5. Kliknij **Save**.

---

## 2. Podpięcie Zmiennych i Sekretów pod Cloud Run

Podczas wdrażania lub edycji usługi Cloud Run powiąż zmienne środowiskowe z utworzonymi sekretami:

1. Przejdź do **Cloud Run** w konsoli GCP i wybierz swoją usługę backendu (`ai-english-buddy-backend`).
2. Kliknij **Edit & Deploy New Revision**.
3. Przejdź do sekcji **Variables & Secrets** (Zmienne i sekrety).
4. **Zwykłe Zmienne Środowiskowe (Environment Variables):**
   Dodaj zmienne niesensytywne jako Name-Value:
   - `EMAIL_HOST` = `smtp.gmail.com`
   - `EMAIL_PORT` = `587`
   - `EMAIL_USERNAME` = `przemek.rakotny@gmail.com`
5. **Sekrety (Referenced Secrets):**
   Dodaj mapowania dla każdego sekretu jako zmiennej środowiskowej:
   - Wybierz opcję **Reference a secret**.
   - Nazwij zmienną środowiskową identycznie jak w kodzie (np. `OPENAI_API_KEY`).
   - Wybierz odpowiedni sekret z listy (np. `OPENAI_API_KEY`).
   - Jako wersję wybierz `latest` (najnowsza) lub konkretny numer wersji (np. `1`).
   - Powtórz procedurę dla: `DEEPSEEK_API_KEY`, `HF_API_TOKEN`, `EMAIL_PASSWORD`, `FIREBASE_CREDENTIALS_JSON`.
6. Kliknij **Deploy**.

---

## 3. Mapowanie Domeny `przemokoduje.com/speakling`

Aby aplikacja była dostępna pod domeną `przemokoduje.com/speakling`, konfigurujemy mapowanie na poziomie Firebase Hosting (ponieważ Firebase Hosting służy jako punkt wejścia i zajmuje się routingiem ruch /api do Cloud Run).

### Krok 1: Dodanie domeny w Firebase Hosting
1. Wejdź do [Konsoli Firebase](https://console.firebase.google.com/).
2. Przejdź do **Hosting** w menu bocznym.
3. Kliknij przycisk **Add Custom Domain** (Dodaj domenę niestandardową).
4. Wpisz `przemokoduje.com`.
5. Firebase poprosi o zweryfikowanie własności domeny poprzez dodanie rekordu `TXT` u Twojego dostawcy DNS (np. Cloudflare, GoDaddy). Dodaj wskazany rekord w konfiguracji DNS.
6. Po zweryfikowaniu własności dodaj rekordy `A` wskazane przez Firebase, aby skierować ruch na serwery Firebase Hosting.

### Krok 2: Konfiguracja ścieżki `/speakling`
Ponieważ projekt Speakling ma działać pod podścieżką `/speakling` (np. frontend pod `/speakling`, a API pod `/speakling/api`), musimy upewnić się, że struktura katalogów frontendu oraz konfiguracja routingu to uwzględnia:

1. **Konfiguracja Firebase:**
   Konfiguracja routingu `/api/**` w pliku `firebase.json` (którą utworzyliśmy w Kroku 1) zapewnia przekierowanie ruchu API.
2. **Konfiguracja ścieżki bazowej we frontendzie (React):**
   W aplikacji React w pliku `package.json` należy upewnić się, że ustawione jest pole:
   ```json
   "homepage": "/speakling"
   ```
   Dzięki temu wszystkie wygenerowane ścieżki do plików JS/CSS będą względne i poprawnie serwowane przez Firebase Hosting pod tą podścieżką.
