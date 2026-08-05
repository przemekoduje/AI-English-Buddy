# PowerShell Deployment Script for Windows

$ErrorActionPreference = "Stop"

Write-Host "=== 1. Budowanie aplikacji mobilnej (Expo Web) ==="
Set-Location mobile
npx expo export --platform web
Write-Host "=== 1b. Patching viewport (blokada pinch-zoom) ==="
python3 scripts/patch-viewport.py
Set-Location ..

Write-Host "=== 2. Budowanie aplikacji przeglądarkowej (React Web) ==="
$env:REACT_APP_API_URL=""
npm run build --prefix frontend

Write-Host "=== 3. Łączenie buildów (kopiowanie wersji mobilnej do podfolderu /speakling/mobile) ==="
if (Test-Path frontend/build/speakling/mobile) {
    Remove-Item -Recurse -Force frontend/build/speakling/mobile
}
New-Item -ItemType Directory -Force -Path frontend/build/speakling/mobile
Copy-Item -Recurse -Force mobile/dist/* frontend/build/speakling/mobile/

Write-Host "=== 4. Publikacja połączonej aplikacji na Firebase Hosting ==="
npx firebase-tools deploy --only hosting

Write-Host "=== WDRUŻENIE ZAKOŃCZONE SUKCESEM! ===" -ForegroundColor Green
Write-Host "Adres główny (Desktop): https://przemokoduje.com/speakling"
Write-Host "Adres mobilny (wersja dedykowana): https://przemokoduje.com/speakling/mobile/"
