# Architecture

## Two layers (keep them separate — do not blur)
- **Perception layer = Gemini.** Understands ONE image at a time: category, severity,
  description, responsible department, and whether it's a real civic issue. Also drafts the
  complaint text and produces embeddings. Stateless, per-image. See `gemini-integration.md`.
- **System layer = our code.** Everything stateful and cross-report: clustering/dedup,
  geo-proximity, the map, the database, status tracking, the dashboard, auth. Gemini never
  does clustering, geo math, or status logic.

## Request flow (core happy path)
1. Client (`app/report`) captures a photo + browser geolocation, POSTs to `/api/reports`.
2. Server route (`app/api/reports/route.ts`):
   a. Auth: resolve current user from session cookie (`lib/session.ts`).
   b. Persist the image to `public/uploads/<id>.<ext>`.
   c. Gemini vision → fixed JSON `{ category, severity, description, department, is_valid_issue }`.
   d. If `is_valid_issue` is false → return 422, store nothing (graceful reject).
   e. Gemini embeds the description (`lib/gemini.ts`).
   f. Clustering (`lib/clustering.ts`): find an existing cluster matching by category +
      geo-radius + embedding similarity. Attach (bump count/urgency) or create a new cluster.
   g. Gemini drafts the complaint text.
   h. Persist the `Report`, return it (with cluster info) to the client.
3. `app/map` renders Leaflet pins; `app/` (dashboard) lists clusters; `app/issues/[id]`
   shows a cluster with "Reported by N citizens", status, and the complaint draft.

## Folder map
- `app/` — App Router pages (functional, unstyled) + `app/api/*` server routes.
- `lib/` — system layer: `prisma.ts` (client singleton), `gemini.ts` (server-only Gemini),
  `clustering.ts` (haversine + cosine + match), `session.ts` (cookie auth), `config.ts`
  (tunable knobs + model names), `types.ts` (shared types + zod schema).
- `components/` — client components (e.g. Leaflet `MapView`, SW registration).
- `prisma/` — schema, migrations, `seed.ts`.
- `public/uploads/` — runtime-stored images (gitignored).

## Conventions
- All Gemini access is server-only and funnelled through `lib/gemini.ts`.
- Tunables (radius, similarity threshold, model names) come from env via `lib/config.ts` —
  never hardcode them at call sites.
- Next 16: `cookies()`/`headers()` from `next/headers` are async — always `await`.
