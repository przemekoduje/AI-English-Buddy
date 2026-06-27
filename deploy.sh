#!/bin/bash

# Zatrzymanie skryptu przy jakimkolwiek błędzie
set -e

echo "=== 1. Budowanie aplikacji mobilnej (Expo Web) ==="
cd mobile
npx expo export --platform web
cd ..

echo "=== 2. Budowanie aplikacji przeglądarkowej (React Web) ==="
# Używamy adresu URL backendu z Render
REACT_APP_API_URL=https://ai-english-buddy-backend.onrender.com npm run build --prefix frontend

echo "=== 3. Łączenie buildów (kopiowanie wersji mobilnej do podfolderu /mobile) ==="
rm -rf frontend/build/mobile
mkdir -p frontend/build/mobile
cp -r mobile/dist/* frontend/build/mobile/

echo "=== 4. Publikacja połączonej aplikacji na Firebase Hosting ==="
npx firebase-tools deploy --only hosting

echo "=== WDRUŻENIE ZAKOŃCZONE SUKCESEM! ==="
echo "Adres główny (Desktop): https://ai-english-buddy-150e5.web.app"
echo "Adres mobilny (wersja dedykowana): https://ai-english-buddy-150e5.web.app/mobile/"
