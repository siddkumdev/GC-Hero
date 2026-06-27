# GCHeros

Phone-first PWA where citizens photograph local civic issues (potholes, leaks, broken
streetlights, garbage). **Gemini is the perception layer** (understands one image, validates,
drafts a complaint). **Our code is the system layer** (clustering/dedup, geo, map, DB, status,
dashboard). Solo hackathon project (Vibe2Ship — Coding Ninjas x Google for Developers).

## THREE HARD RULES (non-negotiable)
1. **No UI aesthetics yet.** Screens are functional + unstyled. STOP and ask for design
   references before any theming/color/visual polish.
2. **Progressive-disclosure memory.** Keep this file minimal. Detailed docs live in `.memory/`
   and are read on demand, not loaded by default.
3. **`GEMINI_API_KEY` is server-side ONLY.** Read from env. Never ship to the browser; all
   Gemini calls go through Next.js server routes. `.env` is gitignored; use `.env.example`.

## Stack
Next.js 16 (App Router) + TypeScript · Tailwind v4 (with Civic design system) · Firebase Admin SDK (Firestore)
(data layer isolated in `lib/db/`) · `@google/genai` (vision + text + embeddings)
· Leaflet + OpenStreetMap · lightweight cookie-based multi-user auth · PWA (manifest + SW) · Vitest (unit/integration/load).

## Key commands
- `npm run dev` — local dev server (the demo runtime)
- `npm test` — run Vitest unit + integration tests (49 tests)
- `npm run test:load` — run Vitest clustering performance benchmarks
- `npm run test:coverage` — run tests with v8 coverage report
- `npm run build` / `npm run lint`

## STANDING RULE — keep the feature registry in sync
After EVERY feature added, changed, or removed (any session), update
[.memory/feature-registry.md](.memory/feature-registry.md) to match. It is the single source of
truth for what this app does and must never drift from reality.

## INDEX — read the relevant `.memory/` doc before working in that area
- [.memory/feature-registry.md](.memory/feature-registry.md) — every feature (built + planned), demo ratings — KEEP IN SYNC
- [.memory/architecture.md](.memory/architecture.md) — layers, request flow, folder map
- [.memory/gemini-integration.md](.memory/gemini-integration.md) — models, prompts, fixed JSON schema, embeddings
- [.memory/data-model.md](.memory/data-model.md) — Prisma models, statuses, Postgres-swap notes
- [.memory/build-plan.md](.memory/build-plan.md) — ordered phases + current status
- [.memory/scope-and-deferred.md](.memory/scope-and-deferred.md) — what's in v1 vs deferred/stubbed
- [.memory/decisions-log.md](.memory/decisions-log.md) — locked decisions + rationale + clean seams
