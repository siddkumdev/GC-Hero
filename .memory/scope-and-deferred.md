# Scope & deferred

## In v1 (build)
- Minimal multi-user auth (attribution + "N people reported this").
- Photo upload, browser geolocation.
- Gemini: single-image understanding (fixed schema), validation, complaint drafting, embeddings.
- Persistence (Prisma/SQLite), Leaflet map, simple list/count dashboard.
- Duplicate clustering/dedup (the differentiator).
- Simulated department routing + status lifecycle.

## Deferred — stub or roadmap only, DO NOT build in v1
- **Video reporting.** Images first. Architect so video frames slot in later (the analyze
  pipeline takes an image; a video would sample frames → same pipeline).
- **Gamification / predictive insights / fancy impact dashboards.** A simple list + counts is
  enough for v1.
- **Real municipal API integration.** SIMULATE department routing + status. No real systems.
- **Cloud deployment (Cloud Run via AI Studio free tier).** Note only; run locally for the demo.
- **EXIF geolocation fallback.** Browser geolocation first; EXIF parsing is a later add.
- **Local CLIP/DINOv2 GPU image-embedding visual dedup.** Sharper dedup upgrade; clean seam
  left in `lib/clustering.ts` (generic embedding vector in). See decisions-log.

## Clean seams to preserve while building
- `lib/clustering.ts` accepts a generic embedding vector → swap/augment the embedding source
  (text→image) without touching match logic.
- Image-analysis entrypoint takes one image → video = "sample frames, reuse pipeline".
- Data access only via `lib/prisma.ts` → SQLite→Postgres is config-only.
- Department routing + status are plain fields/functions → real API integration replaces the
  stub later.
