# Decisions log

Locked decisions + rationale + the seams we deliberately left open.

## Stack
- **Next.js 16 App Router + TS** — one codebase serves phone + desktop, one local server.
- **Prisma + SQLite** — zero external setup, file-based, fine for a multi-user demo. Data layer
  isolated behind `lib/prisma.ts` so a Postgres swap is config-only (`data-model.md`).
- **Tailwind v4** — installed/wired, but NO custom design system until Rule #1 is cleared.
- **Leaflet + OpenStreetMap** for the map — free, no API key, no billing → reliable for a demo.
  *Optional later swap:* Google Maps JS API for Google-judging optics, but it requires a billing
  account, so we default to Leaflet. Map rendering is isolated in `components/MapView.tsx`, so
  swapping the map provider is a localized change.
- **`@google/genai`** for Gemini (vision + text + embeddings), called only from server routes.

## Gemini
- Fixed JSON `responseSchema` + `temperature: 0.2` for consistent categorization. Re-validated
  with zod (`lib/types.ts`). Closed category set so the system layer can group reliably.
- Default models: vision/text `gemini-2.5-flash`, embeddings `gemini-embedding-001` (768-dim via
  `outputDimensionality`). Both env-overridable (`lib/config.ts`). NOTE: `text-embedding-004` is
  not available on the current API version for this key — discovered via `scripts/check-gemini.ts`
  (lists embedContent-capable models); default switched to `gemini-embedding-001`.
- Gemini does perception only. Clustering/geo/status/dashboard are our code (Rule: layer split).

## Auth
- Lightweight cookie session (httpOnly cookie holding the user id), email/name login, no OAuth.
  Enough to attribute reports and demo "N citizens reported this". Minimal by design.

## Clustering / dedup
- Match = same category AND within geo-radius (haversine) AND description-embedding cosine
  similarity ≥ threshold. Radius + threshold are env-configurable.
- Embeddings stored as JSON strings; linear scan over candidates (demo scale).
- **Seam:** `lib/clustering.ts` takes a generic embedding vector, so the stretch upgrade — a
  local CLIP/DINOv2 image embedding on-GPU for sharper *visual* dedup — slots in without
  changing match logic. Not built in v1.

## Images
- Uploaded images written to `public/uploads/<id>.<ext>` at runtime (gitignored) and served
  statically. Simple and demo-adequate; object storage is a later production concern.

## PWA
- Manual PWA (web app manifest + a small service worker registered client-side) rather than a
  plugin, for Next 16 compatibility. Real icon assets / theming are part of the deferred design
  pass (Rule #1) — placeholder icon for now.

## Design (Rule #1 cleared 2026-06-22 — user provided a neumorphism reference)
- **Neumorphic (soft-UI), light "lavender" theme only.** Full neumorphism on all controls
  including inputs and badges (user's explicit choice over an accessibility-first variant).
- **Accent = teal/green, adjustable from ONE variable:** `--accent` in `app/globals.css`. Change
  that token (+ `--accent-strong`/`--accent-soft`) to re-skin the whole app.
- Reusable primitives live as plain CSS classes in `globals.css` (`.neu`, `.neu-inset`,
  `.neu-press`, `.neu-accent`, `.neu-field`, `.neu-pill`, `.neu-squircle`, `.neu-fab`) — combined
  with Tailwind utilities for layout. Neumorphism = shared surface color + paired light/dark
  shadows, NOT borders; avoid hard borders.
- Phone-first: centered `max-w-md` column + fixed bottom tab bar with a central report FAB
  (`components/BottomNav.tsx`). Category icons are emoji glyphs in squircles (`CATEGORY_EMOJI`).
- **UX Fluidity & Micro-interactions (2026-06-25):** Added Framer Motion primitives (`slideUp`, `hoverLift`) and CSS scale transitions (`active` states) across buttons and cards. Staggered lists for dashboard feed. `prefers-reduced-motion` fully respected.
- **Map UX (2026-06-26):**
  - Pill UI uses `createPortal` to mount directly on `document.body`, escaping Leaflet's stacking context and parent overflow/transform bounds.
  - Pin lag fixed by aggressively memoizing `L.divIcon` instances (`iconCache` keyed by category/severity/count) so React static rendering only runs once per unique pin.
  - Mobile tap targets enlarged to 44x44 transparent wrappers with 36x36 visual bubbles. GPS "Locate Me" button added. Leaflet attribution shrunk and moved to `bottomleft`.

## Runtime
- **2026-06-24 — Firestore migration + Cloud Run deployment** (Steps 1-7 complete):
  - SQLite/Prisma replaced with Firebase Admin SDK (Firestore). Data layer in `lib/db/` (one file
    per entity: users, clusters, reports, verifications). `types/models.ts` carries the interfaces
    that previously came from `@prisma/client`.
  - Verification uniqueness was enforced by a Prisma DB unique constraint (P2002). In Firestore it
    is enforced by a deterministic document ID `${clusterId}_${userId}` — setting the same doc ID
    twice is idempotent + the create-inside-transaction check throws cleanly.
  - `prisma.$transaction` → `db.runTransaction(...)`. All other Prisma calls are straight CRUD
    replacements in `lib/db/`.
  - `output: "standalone"` added to `next.config.ts` for Cloud Run compatibility.
  - Dockerfile: multi-stage Node 20 Alpine, port 8080, no credentials baked in. Secrets injected
    at runtime via Google Cloud Secret Manager (`--set-secrets` in deploy script).
  - Deploy script: `scripts/deploy.sh` → `gcloud builds submit` + `gcloud run deploy`, region
    `asia-south1` (Mumbai — closest to Bengaluru), project `ghero-siddkum`.
  - Seed script: `scripts/seed-firestore.ts`, idempotent, matches old Prisma seed data exactly.
  - Firebase project: `ghero-siddkum`. Firestore composite indexes in `firestore.indexes.json`.
  - `gcloud` CLI not yet installed locally — judges will access the deployed URL directly.
- **2026-06-25 — Testing & Stability:**
  - Added Vitest + `@vitest/coverage-v8`. Global mock for `server-only` allows unit testing server modules directly. 49 tests spanning unit, integration, and load (clustering benchmarks).
  - Hardened memory usage: Added `MAX_STORE_SIZE` (500) and periodic TTL sweep to `lib/pending.ts` to prevent unbounded memory growth between GC cycles in a multi-worker server environment.
  - Capped `/analyze` upload size at 8MB. Added a 200 doc limit to dashboard Firestore queries.
