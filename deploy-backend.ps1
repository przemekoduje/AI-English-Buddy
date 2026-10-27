# PowerShell Script to Deploy Backend to Google Cloud Run
$ErrorActionPreference = "Stop"

Write-Host "=== 1. Budowanie obrazu kontenera w Google Cloud Build ===" -ForegroundColor Cyan
gcloud builds submit --tag gcr.io/ai-english-buddy-150e5/ai-english-buddy-backend backend/ --project ai-english-buddy-150e5

Write-Host "=== 2. Wdrażanie nowej wersji na Google Cloud Run ===" -ForegroundColor Cyan
gcloud run deploy speakling-backend `
  --image gcr.io/ai-english-buddy-150e5/ai-english-buddy-backend:latest `
  --project ai-english-buddy-150e5 `
  --region europe-central2 `
  --platform managed

Write-Host "=== WDROŻENIE BACKENDU ZAKOŃCZONE SUKCESEM! ===" -ForegroundColor Green
Write-Host "Backend URL: https://speakling-backend-665075210565.europe-central2.run.app"
