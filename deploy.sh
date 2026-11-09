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

echo "=== 3c. Integracja aplikacji KeepGoals (/keepgoals) ==="
KEEPGOALS_DIR=""
if [ -d "../KeepGoals/frontend" ]; then
  KEEPGOALS_DIR="../KeepGoals"
elif [ -d "../keepGoals/frontend" ]; then
  KEEPGOALS_DIR="../keepGoals"
elif [ -d "../keepgoals/frontend" ]; then
  KEEPGOALS_DIR="../keepgoals"
fi
if [ -n "$KEEPGOALS_DIR" ]; then
  if [ ! -f "$KEEPGOALS_DIR/frontend/dist/index.html" ]; then
    echo "Budowanie frontendu KeepGoals..."
    (cd "$KEEPGOALS_DIR/frontend" && npm run build)
  fi
  if [ -d "$KEEPGOALS_DIR/frontend/dist" ]; then
    rm -rf frontend/build/keepgoals
    mkdir -p frontend/build/keepgoals
    cp -r "$KEEPGOALS_DIR/frontend/dist/." frontend/build/keepgoals/
    echo "[OK] Skopiowano KeepGoals do frontend/build/keepgoals"
  fi
fi

# === 4. Publikacja aplikacji na Firebase Hosting ===
TARGET_PROJECT="${FIREBASE_PROJECT:-speakling-live-temp}"
echo "Wdrażanie na projekt Firebase: $TARGET_PROJECT..."
npx firebase-tools deploy --only hosting --project "$TARGET_PROJECT"

echo "Wdrażanie na projekt Firebase: przemokoduje-online..."
npx firebase-tools deploy --only hosting --project przemokoduje-online

echo "=== WDROŻENIE ZAKOŃCZONE SUKCESEM! ==="
echo "Adres działający (Hosting): https://$TARGET_PROJECT.web.app/speakling"
echo "Adres główny (przemokoduje): https://przemokoduje-online.web.app/speakling (https://przemokoduje.com/speakling)"
echo "Adres mobilny: https://$TARGET_PROJECT.web.app/speakling/mobile/"
