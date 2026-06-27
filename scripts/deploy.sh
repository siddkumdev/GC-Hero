#!/bin/bash
# GCHeros — Cloud Run Deploy Script
# Usage: ./scripts/deploy.sh
# Prerequisites: gcloud CLI installed, `gcloud auth login`, project secrets already stored
#   in Secret Manager (see .memory/deployment.md for setup instructions).

set -e

PROJECT_ID=$(gcloud config get-value project)
REGION="asia-south1"  # Mumbai — closest to Bengaluru
SERVICE_NAME="gcheros"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🔨 Building container image..."
gcloud builds submit --tag "$IMAGE"

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest,FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest"

echo "✅ Deployed! Service URL:"
gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --format "value(status.url)"
