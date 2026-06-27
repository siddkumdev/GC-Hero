# Feature registry

**Single source of truth for what this app does.** Every feature — existing AND new — lives here.
**STANDING RULE:** After EVERY feature added, changed, or removed (this session or any future one),
update this file to match. It must never drift from reality. Columns:
- **Status** — built / partial / planned / removed
- **Gemini?** — yes (+how) / no — keep the layer split honest (Gemini = perception only)
- **Demo** — ⭐ must-show · ✓ good-to-show · – skip in demo

Layer reminder: Gemini understands one image / parses one intent / writes one insight. Our code
owns all state, geo, clustering, filtering, aggregation, status. Gemini never clusters or filters.

---

## Already built (audited from code 2026-06-25)

### Reporting & perception (the hero flow)

| # | Feature | Status | Gemini? | Demo | Why it impresses |
|---|---------|--------|---------|------|------------------|
| B1 | **Two-phase report flow** (`/report` → `/api/reports/analyze` then `/confirm`). Capture photo + browser geolocation; staged "Analyzing…" reveal; nothing persists until the user confirms. | built | indirectly (drives the Gemini calls below) | ⭐ | The spine of the demo — one photo becomes a structured, filed civic case on screen. |
| B2 | **Gemini image understanding** — fixed JSON schema (`category`, `severity`, `severity_reason`, `description`, `department`, `is_valid_issue`), temp 0.2, zod-revalidated. `analyzeIssueImage` in `lib/gemini.ts`. | built | yes — vision, `gemini-2.5-flash` + fallback chain | ⭐ | AI reads a raw photo and returns clean, actionable triage in seconds. |
| B3 | **Graceful non-civic reject** — `is_valid_issue:false` → 422, stores nothing, friendly retry screen. | built | yes — same vision call | ✓ | Shows guardrails: the AI says "no" to selfies/memes instead of filing junk. |
| B4 | **Complaint drafting** — `draftComplaint`, file-ready text addressed to the routed department; editable before filing. | built | yes — text, temp 0.3 | ⭐ | Turns a citizen's photo into a department-ready complaint they can edit and file. |
| B5 | **Description embeddings** — `embedText`, `gemini-embedding-001` @ 768-dim; stored JSON on `Report`. | built | yes — embeddings | ✓ | The dedup signal; mention it, don't dwell — it powers B7. |
| B6 | **AI reveal UI** — `AiResultCard` / `AnalyzingStages` / `FiledResult`, framer-motion staged reveal, editable draft, live clustering preview + count-up. | built | no (renders B2–B4 output) | ⭐ | Makes the AI *visible and satisfying* — the moment judges remember. |

### System layer (our code — the differentiator)

| # | Feature | Status | Gemini? | Demo | Why it impresses |
|---|---------|--------|---------|------|------------------|
| B7 | **Duplicate clustering / dedup** — same category AND haversine radius (150m) AND cosine ≥ 0.82. Attach (bump count, re-centroid, escalate severity) or create. `lib/clustering.ts`. | built | no (consumes B5 vector) | ⭐ | "12 citizens, one issue" — the core insight that separates this from a form. |
| B8 | **Live clustering preview** — read-only "Found N similar within Xm" shown in the reveal before confirm (`findBestCluster`). | built | no | ⭐ | The dedup is visible *as you report*, not hidden in a backend. |
| B9 | **Urgency scoring** — severity weight × log(report count). Sorts the dashboard. `urgencyScore`. | built | no | ✓ | Aggregated citizen pressure ranks what the city should fix first. |
| B10 | **Simulated status lifecycle** — submitted→acknowledged→in_progress→resolved on the Cluster; `StatusControl` + PATCH route. | built | no | ✓ | Closes the loop visually; stub for real municipal-API integration. |
| B11 | **Department routing** — category→department table (`DEPARTMENT_BY_CATEGORY`), shown on reveal + issue. | built | no (Gemini suggests, we normalize) | ✓ | Each issue is auto-addressed to the right municipal body. |
| B12 | **Dashboard feed** (`/`) — tracked clusters, category/status filters, urgency-sorted, counts. Single centered column on all sizes (`lg:max-w-2xl`); the map lives on its own /map tab. Staggered card entrance animations. | built | no | ✓ | The city's prioritized worklist at a glance. |
| B13 | **Issues map** (`/map`) — Leaflet/OSM, one pin per cluster, severity color, report count, civic popup. Fluid UX with slide-up portal pill, 44x44 tap targets, GPS locate button, and memoized SVG pins. | built | no | ✓ | Spatial view of civic load; hotspots are obvious. |
| B14 | **Issue detail** (`/issues/[id]`) — "Reported by N citizens" (`CitizenCount`), representative complaint, member reports, status control. | built | no | ✓ | Where one report becomes a corroborated, tracked case. |
| B15 | **Profile / my reports** (`/profile`) — identity + filed reports. | built | no | – | Plumbing; not a demo beat. |
| B16 | **Cookie multi-user auth** — httpOnly session, email/name login, no OAuth. `lib/session.ts`, `/api/auth/*`, `/login`. | built | no | – | Enough to attribute reports + power "N citizens". |
| B17 | **Gemini resilience** — fallback model chain + retry/backoff; `GeminiOverloadedError`→friendly 503. | built | yes (infra) | – | Keeps the live demo alive on flaky free-tier quota. |
| B18 | **PWA shell** — manifest + service worker, phone-first centered column + bottom nav + teal FAB. | built | no | – | "Install to home screen" framing. |
| B19 | **Civic design system** — Space Grotesk + Inter, lucide, teal/ink tokens, framer-motion. `globals.css`. Reference-driven warm overhaul rolled out 2026-06-24. | built | no | ✓ | Looks intentional, not a hackathon template. |
| B20 | **Natural-language search** — `/search`. Gemini parses intent into JSON; `lib/search.ts` performs haversine + text/facet filtering. | built | yes — intent→JSON | ⭐ | "high-severity water issues near me" just works. |
| B21 | **AI community digest** — dashboard card. Aggregates stats + geo hotspots; Gemini narrates the summary. `lib/digest.ts`. | built | yes — reasoning over aggregates | ⭐ | Delivers "impact dashboard + predictive insight". |
| B22 | **Community verification** — "I see this too" one-tap confirm. Disjoint from reporters to avoid inflation. `lib/verification.ts`. | built | no | ✓ | Crowd-sourced credibility on top of clustering. |
| B23 | **Resolution verification** — Gemini compares "before" vs "after" photos to auto-resolve issues. `lib/gemini.ts` + `api/clusters/[id]/resolve`. | built | yes — vision comparison | ⭐ | "AI confirmed it's fixed" is a payoff moment. |

---

## Infrastructure (2026-06-24)

| # | Change | Status | Notes |
|---|--------|---------|-------|
| I1 | **Firestore migration** — SQLite/Prisma replaced with Firebase Admin SDK. | done | Project: `ghero-siddkum` |
| I2 | **Cloud Run deployment** — Dockerfile and deploy scripts ready. | ready | `scripts/deploy.sh` |
| I3 | **Firestore seed** — Idempotent seeding. | done | Data live in Firestore |
| I4 | **Composite indexes** — Defined in `firestore.indexes.json`. | done | Added `clusterId ASC + createdAt DESC` |
| I5 | **Vitest testing suite** — 49 tests across unit, integration, and load benchmarking. Mocked Next.js server-only contexts. | done | `npm test` |
| I6 | **Stress & Memory hardeners** — 8MB upload cap, background TTL sweep for in-memory pending store, 500 max cap, 200 query limit for dashboard. | done | Avoids unbounded memory/DoS in multi-worker environment |

---

## Deferred (roadmap only)

Video reporting · gamification · real municipal APIs · local CLIP/DINOv2 visual dedup.
