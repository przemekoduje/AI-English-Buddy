# Plan Kroku: Pakiet Weryfikacyjny i Testy Integracyjne (Krok 4)

## Cel
Przygotowanie skryptu weryfikacyjnego `verify_build.sh` do lokalnej kompilacji frontendu oraz sprawdzenia poprawności statycznej konfiguracji kontenera backendu, aby zagwarantować pełną gotowość projektu Speakling do wdrożenia na produkcji w GCP.

---

## Pliki do utworzenia/edycji
1. **[NEW]** `verify_build.sh` – automatyczny skrypt bash do weryfikacji środowiska (instalacja zależności, budowanie frontendu React do `frontend/build`, sprawdzanie składni pliku `backend/Dockerfile` oraz reguł `firebase.json`).

---

## Logika
Proces wdrożeniowy Speakling opiera się na dwóch filarach:
1. **Frontend (Firebase Hosting):** Musi zostać poprawnie skompilowany do plików statycznych w folderze `frontend/build`. Skrypt sprawdzi poprawność procesu budowania.
2. **Backend (Cloud Run):** Skrypt sprawdzi poprawność struktury Dockerfile oraz upewni się, że plik `firebase.json` zawiera poprawne mapowanie przekierowań do serwera Cloud Run.

Dzięki temu eliminujemy ryzyko wdrożenia niedziałającego lub niekompletnego kodu do chmury (zasada *Fail-Fast*).

---

## Strategia weryfikacji
1. **Uruchomienie skryptu:**
   ```bash
   chmod +x verify_build.sh
   ./verify_build.sh
   ```
2. **Oczekiwany rezultat:** Skrypt powinien zakończyć się statusem powodzenia (`exit 0`), a w logach powinny pojawić się potwierdzenia sukcesu budowy Reacta oraz walidacji plików konfiguracyjnych.

---

## Koszty
* **Środowisko lokalne:** Uruchomienie lokalnych skryptów weryfikacyjnych i kompilacji: **0 USD**.
