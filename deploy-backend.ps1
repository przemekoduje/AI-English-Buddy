# PowerShell Script to Deploy Backend to Google Cloud Run
$ErrorActionPreference = "Stop"

Write-Host "=== 1. Budowanie obrazu kontenera w Google Cloud Build ===" -ForegroundColor Cyan
gcloud builds submit --tag gcr.io/ai-english-buddy-150e5/ai-english-buddy-backend backend/ --project ai-english-buddy-150e5

Write-Host "=== 2. Wdrażanie nowej wersji na Google Cloud Run ===" -ForegroundColor Cyan
gcloud run deploy ai-english-buddy-backend `
  --image gcr.io/ai-english-buddy-150e5/ai-english-buddy-backend:latest `
  --project ai-english-buddy-150e5 `
  --region europe-west1 `
  --platform managed

Write-Host "=== WDROŻENIE BACKENDU ZAKOŃCZONE SUKCESEM! ===" -ForegroundColor Green
Write-Host "Backend URL: https://ai-english-buddy-backend-665075210565.europe-west1.run.app"
