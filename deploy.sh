#!/bin/bash

# Zatrzymanie skryptu przy jakimkolwiek błędzie
set -e

echo "=== 1. Budowanie aplikacji mobilnej (Expo Web) ==="
cd mobile
npx expo export --platform web
echo "=== 1b. Patching viewport (blokada pinch-zoom) ==="
python3 scripts/patch-viewport.py
cd ..

echo "=== 2. Budowanie aplikacji przeglądarkowej (React Web) ==="
REACT_APP_API_URL="" npm run build --prefix frontend

echo "=== 3. Łączenie buildów (kopiowanie wersji mobilnej do podfolderu /speakling/mobile) ==="
rm -rf frontend/build/speakling/mobile
mkdir -p frontend/build/speakling/mobile
cp -r mobile/dist/* frontend/build/speakling/mobile/

echo "=== 4. Publikacja połączonej aplikacji na Firebase Hosting ==="
npx firebase-tools deploy --only hosting

echo "=== WDRUŻENIE ZAKOŃCZONE SUKCESEM! ==="
echo "Adres główny (Desktop): https://przemokoduje.com/speakling"
echo "Adres mobilny (wersja dedykowana): https://przemokoduje.com/speakling/mobile/"
