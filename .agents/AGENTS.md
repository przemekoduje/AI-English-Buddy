# Zasady projektu Speakling (AI-English-Buddy)

- Po zakończeniu każdej pracy/zadania kodowego, zawsze automatycznie uruchamiaj skrypt wdrażający frontendu `.\deploy.ps1` lub `./deploy.sh` (Firebase Hosting) oraz zatwierdzaj i wypychaj najnowsze zmiany do repozytorium zdalnego (`git commit` + `git push`).
- WAŻNE: Jeśli zmiany obejmowały kod backendu (`backend/*`), ZAWSZE uruchamiaj również wdrożenie backendu na Google Cloud Run (`./deploy-backend.sh` lub `.\deploy-backend.ps1`), ponieważ `git push` sam z siebie nie posiada pipeline'u CI/CD budującego kontenery na Cloud Run. Użytkownik chce od razu widzieć działające wyniki pod adresem: https://przemokoduje.com/speakling
