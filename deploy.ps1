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

Write-Host "=== 2. Budowanie aplikacji przegladarkowej (React Web) ==="
$env:REACT_APP_API_URL=""
npm run build --prefix frontend

Write-Host "=== 3. Laczenie buildow (kopiowanie wersji mobilnej do /speakling/mobile oraz /mobile) ==="
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

Write-Host "=== 3b. Konfiguracja Portalu Glownego przemokoduje.com ==="
Copy-Item -Force frontend/build/index.html frontend/build/speakling.html
if (Test-Path portal/index.html) {
    Copy-Item -Force portal/index.html frontend/build/index.html
}

$CurrentCommit = (git rev-parse HEAD).Trim()
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "frontend/build/.speakling-commit"), $CurrentCommit)

Write-Host "=== 3c. Synchronizacja KeepGoals i weryfikacja integralnosci calego ekosystemu ==="
if (Get-Command python -ErrorAction SilentlyContinue) {
    python scripts/sync-and-verify-bundle.py
} else {
    python3 scripts/sync-and-verify-bundle.py
}
if ($LASTEXITCODE -ne 0) {
    throw "Weryfikacja integralnosci pakietu nie powiodla sie - wdrozenie przerwane."
}

# === 4. Publikacja aplikacji na Firebase Hosting ===
$TargetProject = if ($env:FIREBASE_PROJECT) { $env:FIREBASE_PROJECT } else { "speakling-live-temp" }
Write-Host "Wdrazanie na projekt Firebase: $TargetProject..." -ForegroundColor Cyan
npx firebase-tools deploy --only hosting --project $TargetProject

Write-Host "Wdrazanie na projekt Firebase: przemokoduje-online..." -ForegroundColor Cyan
npx firebase-tools deploy --only hosting --project przemokoduje-online

Write-Host "=== WDROZENIE ZAKONCZONE SUKCESEM! ===" -ForegroundColor Green
Write-Host "Adres dzialajacy (Hosting): https://$TargetProject.web.app/speakling"
Write-Host "Adres glowny (przemokoduje): https://przemokoduje-online.web.app/speakling (https://przemokoduje.com/speakling)"
Write-Host "Adres mobilny: https://$TargetProject.web.app/speakling/mobile/"
