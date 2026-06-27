# AI reveal + visible clustering (Part A — the point of the app)

Goal: make Gemini's intelligence *visible*. The report flow is now two server phases so the
AI work can be staged, revealed, and edited before anything is filed.

## Two-phase API (replaces the old single POST /api/reports)
1. **POST `/api/reports/analyze`** (`app/api/reports/analyze/route.ts`)
   - Auth → vision (`analyzeIssueImage`) → if invalid civic issue, 422 reject (no image saved).
   - Else: save image, then `embedText` + `draftComplaint` in parallel.
   - **Read-only** clustering preview via `findBestCluster` (no writes).
   - Stash the embedding + image + classification server-side in `lib/pending.ts` (in-memory,
     10-min TTL, keyed by `analysisId`) — keeps the embedding off the client.
   - Returns `AnalyzeResultDTO` (category, severity, severityReason, department, description,
     editable complaintDraft, `clusterPreview{matched,currentCount,similarity,distanceMeters,radiusMeters}`).
2. **POST `/api/reports/confirm`** (`app/api/reports/confirm/route.ts`)
   - Takes `{analysisId, complaintDraft}` (the reviewed/edited text), re-runs `resolveCluster`
     for real, persists the `Report`. Returns `ConfirmResultDTO`
     (`isNew, previousCount, reportCount, matchedSimilarity`) — before/after counts drive the count-up.
   - Pending is single-use; if expired → 410 "re-submit".

`GET /api/reports` (clusters by urgency) is unchanged.

## Gemini change
`severity_reason` added to the fixed vision schema + zod (`lib/types.ts`, `lib/gemini.ts`) —
a one-line justification for the severity, shown in the reveal. **Transient: not persisted**
(no DB migration). Department still normalized to `DEPARTMENT_BY_CATEGORY`.

## Clustering refactor (`lib/clustering.ts`)
Extracted `findBestCluster` (read-only matcher: same category + within radius + cosine ≥
threshold). Both `previewCluster`-style analyze and `resolveCluster` use it, so "found N
similar nearby" and the actual attach are identical logic. `ClusterResolution` now carries
`previousCount`.

## Client flow (`components/civic/ReportFlow.tsx`, phase machine)
capture → **analyzing** → reveal → filed (+ rejected / error).
- **analyzing** (`AnalyzingStages.tsx`): staged "Reading image → Classifying → Assessing
  severity → Drafting report" with a teal scan-beam over the photo. Tied to the real call but
  floored at `MIN_ANALYZE_MS` (2.1s) via an upfront delay promise so it always feels deliberate.
- **reveal** (`AiResultCard.tsx`): staggered result card — category+icon, severity badge +
  justification, routed department, the live cluster preview line, and the **editable** drafted
  complaint. Confirm files it; Discard restarts.
- **filed** (`FiledResult.tsx`): the payoff — if a duplicate merged, the count animates
  `previousCount → reportCount` (`CountUp`), `CitizenCount` stacked avatars pop the new citizen
  in, and a "Priority raised" chip shows. If new, a "first report" empty-ish state.
- `CitizenCount.tsx` is the reusable "Reported by N citizens" credibility treatment (A2) —
  reuse on issue detail + map popup during the full rollout.

## Verified live (real Gemini, 2026-06-23)
analyze→200 (pothole/high + justification + complaint); preview matched at cosine **0.939**,
**70m**; confirm climbed **1→2**, duplicate merged into one cluster. (Browser click-driving and
screenshots are broken in the preview sandbox — env tooling, not the app; verified via API + a11y
snapshot instead.) See [[design-system]] for the look/motion. [[community-hero-project]].
