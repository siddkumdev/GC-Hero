# Build plan

Ordered phases. Build each rock-solid before the next. Status updated as we go.

## Phase 0 — Scaffold & memory  ✅ DONE
Next.js 16 + TS + Tailwind v4 + Prisma/SQLite + deps (genai, leaflet, zod, tsx). Memory
structure (`CLAUDE.md` + `.memory/`). `.env.example`, `.gitignore` hardened (key never
committed). Prisma schema (User/Cluster/Report) + seed script.

## Phase 1 — Core happy path (end-to-end FIRST)  ✅ DONE (verified live)
1. Minimal login (cookie session, email/name). — `lib/session.ts`, `/api/auth/*`, `/login`
2. Photo upload + browser geolocation capture. — `/report`
3. Server route → Gemini vision → fixed JSON schema (temp 0.2), zod-validated. — `/api/reports`
4. Invalid (non-civic) → graceful reject, store nothing.
5. Geolocation stored with report (EXIF fallback = later stub).
6. Persist report; show pinned on Leaflet map + listed on dashboard. — `/map`, `/`
7. Gemini drafts a file-ready complaint, shown on the issue page. — `/issues/[id]`
Exit criterion: log in → upload a real pothole photo → see it validated, pinned, listed,
with a complaint draft. Invalid photo is rejected cleanly.

## Phase 2 — Duplicate clustering (the differentiator)  ✅ DONE (verified live)
- `lib/clustering.ts`: haversine geo-radius + cosine similarity on description embedding.
- On new report: match same-category clusters within radius AND above similarity threshold.
- Attach to cluster (bump `reportCount`, update centroid, escalate severity/urgency) or create.
- Surface "Reported by N citizens" + an urgency signal on the issue/dashboard.
- Threshold + radius configurable via env (`lib/config.ts`).
Verified live: real pothole photo → valid + classified + complaint drafted; a 2nd photo ~30m
away merged (cosine 0.88 > 0.82) → count 2; a copy 5km away formed a new cluster; a non-civic
photo (cat) was rejected (422) and stored nothing.

## Phase 3 — Polish of function (still no aesthetics)  ✅ DONE
- [x] Simulated status transitions (StatusControl + PATCH route).
- [x] Department routing labels shown on issue + report result.
- [x] Dashboard sorted by urgency + category/status filters + counts.
- [x] Server-side auth guard on /report; empty/error states on dashboard, map, report.
- [x] Remaining functional niceties as needed.

## Phase 4 — Visual design  ✅ DONE (design references received 2026-06-22)
Neumorphic (soft-UI) system applied across all screens. Decisions (locked by user):
- Light "lavender" theme only; full neumorphism on all controls incl. inputs/badges.
- Accent teal/green, adjustable from ONE variable: `--accent` in `app/globals.css`.
- Primitives in `globals.css`: `.neu`, `.neu-inset`, `.neu-press`, `.neu-accent`, `.neu-field`,
  `.neu-pill`, `.neu-squircle`, `.neu-fab`. Phone-first centered column + bottom tab bar with a
  central report FAB (`components/BottomNav.tsx`). Category squircles use emoji glyphs.
Verified visually (dashboard, login, issue detail) via preview at 375px.

## Phase 5 — AI visibility + full UI overhaul  ✅ DONE (2026-06-23, verified live)
Supersedes the "no UI aesthetics" hold (Hard Rule #1) — design direction now provided by the user.
- [x] **Part A — make the AI visible.** Two-phase report API (analyze/confirm), staged
  "Analyzing…" reveal, editable Gemini draft, live clustering preview + count-up. Verified live
  end-to-end with real Gemini (see [.memory/ai-reveal.md](ai-reveal.md)).
- [x] **Design system** defined: "Civic" — kills neumorphism; Space Grotesk + Inter, lucide icons,
  teal/ink/warm-off-white tokens, semantic severity, framer-motion. See
  [.memory/design-system.md](design-system.md).
- [x] **Proof screen** = report flow, restyled in the new language. CHECKPOINT passed — user
  approved 2026-06-23.
- [x] **Rolled out to all screens.** `.civic` now applied on `<body>`; the `.neu*` system is
  deleted from `globals.css`; dead `components/ReportForm.tsx` removed. Restyled: feed, map
  (map-as-hero + custom severity pins + civic popup), issue detail, profile, login, top nav +
  bottom nav (lucide + teal FAB). A2 `CitizenCount` on issue detail + map popup. Empty/error
  states restyled. Verified live at 375px (all screens screenshotted, no console errors,
  lint + tsc clean).

## Deferred (see scope-and-deferred.md)
Video, gamification, predictive insights, real municipal APIs, cloud deploy, local CLIP/DINOv2
visual dedup. Architected with clean seams; not built in v1.
