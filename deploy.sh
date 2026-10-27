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

echo "=== 3. Łączenie buildów (kopiowanie wersji mobilnej do /speakling/mobile oraz /mobile) ==="
rm -rf frontend/build/speakling/mobile
mkdir -p frontend/build/speakling/mobile
cp -r mobile/dist/* frontend/build/speakling/mobile/

rm -rf frontend/build/mobile
mkdir -p frontend/build/mobile
cp -r mobile/dist/* frontend/build/mobile/

echo "=== 3b. Konfiguracja Portalu Głównego przemokoduje.com ==="
cp frontend/build/index.html frontend/build/speakling.html
if [ -f "portal/index.html" ]; then
  cp portal/index.html frontend/build/index.html
fi

# === 4. Publikacja aplikacji na Firebase Hosting ===
# Używamy jednego wskazanego projektu Firebase (domyślnie projekt aktywny/zastępczy: speakling-live-temp)
TARGET_PROJECT="${FIREBASE_PROJECT:-speakling-live-temp}"
echo "Wdrażanie na projekt Firebase: $TARGET_PROJECT..."
npx firebase-tools deploy --only hosting --project "$TARGET_PROJECT"

echo "=== WDROŻENIE ZAKOŃCZONE SUKCESEM! ==="
echo "Adres działający (Hosting): https://$TARGET_PROJECT.web.app/speakling"
echo "Adres mobilny: https://$TARGET_PROJECT.web.app/speakling/mobile/"
if [ "$TARGET_PROJECT" = "ai-english-buddy-150e5" ]; then
  echo "Domena główna: https://przemokoduje.com/speakling"
fi
