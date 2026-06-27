# Cloud Run Deployment

Stack: Next.js (standalone output) containerised via Docker, deployed to Cloud Run.
Secrets injected at runtime from Google Cloud Secret Manager — never baked into the image.

## One-time setup (first deploy only)

### 1. Firebase project + Firestore
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create project → name it (e.g. `ghero-siddkum`)
3. Build → Firestore Database → Create database → Production mode, region `asia-south2` (Bengaluru) or `asia-south1`
4. Build → Firestore Database → Indexes tab → import `firestore.indexes.json` for composite indexes (or let them be created automatically on first query with an error link)

### 2. Service account & key extraction
1. Project Settings → Service accounts → Generate new private key → download JSON
2. From the JSON, extract:
   - `FIREBASE_PROJECT_ID` = `project_id` field
   - `FIREBASE_CLIENT_EMAIL` = `client_email` field
   - `FIREBASE_PRIVATE_KEY` = `private_key` field (the full `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n` string)

### 3. Store secrets in Google Cloud Secret Manager
Run each of these (replace values with your actual credentials):
```bash
echo -n "your_gemini_key" | gcloud secrets create GEMINI_API_KEY --data-file=-
echo -n "ghero-siddkum" | gcloud secrets create FIREBASE_PROJECT_ID --data-file=-
echo -n "firebase-adminsdk-fbsvc@ghero-siddkum.iam.gserviceaccount.com" | gcloud secrets create FIREBASE_CLIENT_EMAIL --data-file=-
printf '%s' '-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n' | gcloud secrets create FIREBASE_PRIVATE_KEY --data-file=-
```

Grant the Cloud Run service account access to these secrets:
```bash
PROJECT_ID=$(gcloud config get-value project)
SA="$PROJECT_ID@appspot.gserviceaccount.com"  # or the auto-created Cloud Run SA
for SECRET in GEMINI_API_KEY FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL FIREBASE_PRIVATE_KEY; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$SA" \
    --role="roles/secretmanager.secretAccessor"
done
```

### 4. Set gcloud project
```bash
gcloud config set project ghero-siddkum
```

### 5. Enable required Google Cloud APIs
```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com
```

### 6. First deploy
```bash
./scripts/deploy.sh
```

The script prints the public HTTPS URL at the end.

---

## Re-deploying after code changes
Just re-run:
```bash
./scripts/deploy.sh
```
Cloud Build rebuilds the image, Cloud Run rolls out the new revision with zero downtime.

---

## Seeding demo data (Cloud Run)
The seed script runs locally and writes directly to Firestore over the network:
```bash
npm run db:seed
```
No `DATABASE_URL` needed — credentials come from `.env`.

---

## Troubleshooting

**Build fails with "FIREBASE_PROJECT_ID is not defined"**
The Dockerfile sets build-time placeholder values for env vars — they're not needed at
build time since Firebase Admin is only initialized at request time. If you see this error,
check that `next.config.ts` has `output: "standalone"`.

**Cloud Run container fails to start (exit code 1)**
Check logs: `gcloud run services logs read community-hero --region asia-south1`
Most common cause: one of the Secret Manager secrets is missing or the Cloud Run SA
doesn't have `roles/secretmanager.secretAccessor` on it.

**Firestore "Missing composite index" error**
Deploy the indexes from `firestore.indexes.json` via the Firebase console
(Firestore → Indexes → Add index) or Firebase CLI:
```bash
npx firebase deploy --only firestore:indexes
```

**"Cannot read properties of undefined (reading 'replace')" on FIREBASE_PRIVATE_KEY**
The secret value is empty or missing. Verify with:
```bash
gcloud secrets versions access latest --secret=FIREBASE_PRIVATE_KEY
```

---

## Architecture note
"Deployed via Cloud Run, initiated from gcloud CLI linked to the same Google Cloud project
as the AI Studio Vibe2Ship Hackathon key." — project `ghero-siddkum`.
