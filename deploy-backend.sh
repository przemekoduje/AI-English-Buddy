#!/bin/bash
set -e

echo "=== 1. Budowanie obrazu kontenera w Google Cloud Build ==="
gcloud builds submit --tag gcr.io/ai-english-buddy-150e5/ai-english-buddy-backend backend/ --project ai-english-buddy-150e5

echo "=== 2. Wdrażanie nowej wersji na Google Cloud Run ==="
gcloud run deploy ai-english-buddy-backend \
  --image gcr.io/ai-english-buddy-150e5/ai-english-buddy-backend:latest \
  --project ai-english-buddy-150e5 \
  --region europe-west1 \
  --platform managed

echo "=== WDROŻENIE BACKENDU ZAKOŃCZONE SUKCESEM! ==="
echo "Backend URL: https://ai-english-buddy-backend-665075210565.europe-west1.run.app"
