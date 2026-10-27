# PowerShell Deployment Script for Windows

$ErrorActionPreference = "Stop"

Write-Host "=== 1. Budowanie aplikacji mobilnej (Expo Web) ==="
Set-Location mobile
npx expo export --platform web
Write-Host "=== 1b. Patching viewport (blokada pinch-zoom oraz desktop redirect) ==="
if (Get-Command python -ErrorAction SilentlyContinue) {
    python scripts/patch-viewport.py
} else {
    python3 scripts/patch-viewport.py
}
Set-Location ..

Write-Host "=== 2. Budowanie aplikacji przeglądarkowej (React Web) ==="
$env:REACT_APP_API_URL=""
npm run build --prefix frontend

Write-Host "=== 3. Łączenie buildów (kopiowanie wersji mobilnej do /speakling/mobile oraz /mobile) ==="
if (Test-Path frontend/build/speakling/mobile) {
    Remove-Item -Recurse -Force frontend/build/speakling/mobile
}
New-Item -ItemType Directory -Force -Path frontend/build/speakling/mobile
Copy-Item -Recurse -Force mobile/dist/* frontend/build/speakling/mobile/

if (Test-Path frontend/build/mobile) {
    Remove-Item -Recurse -Force frontend/build/mobile
}
New-Item -ItemType Directory -Force -Path frontend/build/mobile
Copy-Item -Recurse -Force mobile/dist/* frontend/build/mobile/

Write-Host "=== 3b. Konfiguracja Portalu Głównego przemokoduje.com ==="
Copy-Item -Force frontend/build/index.html frontend/build/speakling.html
if (Test-Path portal/index.html) {
    Copy-Item -Force portal/index.html frontend/build/index.html
}

# === 4. Publikacja aplikacji na Firebase Hosting ===
# Używamy jednego wskazanego projektu Firebase (domyślnie projekt aktywny/zastępczy: speakling-live-temp)
$TargetProject = if ($env:FIREBASE_PROJECT) { $env:FIREBASE_PROJECT } else { "speakling-live-temp" }
Write-Host "Wdrażanie na projekt Firebase: $TargetProject..." -ForegroundColor Cyan
npx firebase-tools deploy --only hosting --project $TargetProject

Write-Host "=== WDROŻENIE ZAKOŃCZONE SUKCESEM! ===" -ForegroundColor Green
Write-Host "Adres działający (Hosting): https://$TargetProject.web.app/speakling"
Write-Host "Adres mobilny: https://$TargetProject.web.app/speakling/mobile/"
if ($TargetProject -eq "ai-english-buddy-150e5") {
    Write-Host "Domena główna: https://przemokoduje.com/speakling"
}
