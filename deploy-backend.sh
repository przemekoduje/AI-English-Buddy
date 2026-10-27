#!/bin/bash
set -e

echo "=== 1. Budowanie obrazu kontenera w Google Cloud Build ==="
gcloud builds submit --tag gcr.io/ai-english-buddy-150e5/ai-english-buddy-backend backend/ --project ai-english-buddy-150e5

echo "=== 2. Wdrażanie nowej wersji na Google Cloud Run ==="
gcloud run deploy speakling-backend \
  --image gcr.io/ai-english-buddy-150e5/ai-english-buddy-backend:latest \
  --project ai-english-buddy-150e5 \
  --region europe-central2 \
  --platform managed

echo "=== WDROŻENIE BACKENDU ZAKOŃCZONE SUKCESEM! ==="
echo "Backend URL: https://speakling-backend-665075210565.europe-central2.run.app"
