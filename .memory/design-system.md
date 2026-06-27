# Design system — "Civic" (replaces neumorphism)

POV (committed): **"Trustworthy civic infrastructure that feels alive."** Credible and
institutional, but modern and satisfying. Calm/clear by default; energetic at the key moments
(AI reveal, clustering, status changes). Not a generic SaaS dashboard.

Influences (specific takeaways, not their look): Stripe → typographic clarity + ruthless
restraint + whitespace. Linear → engineered depth/layering + crisp micro-motion. Things 3 →
calm, breathing room, nothing shouts unless it matters. Maps/Citizen/Uber → map-as-hero,
bottom-sheets, location-first.

## Rollout status — COMPLETE (rolled out 2026-06-23, user-approved)
`.civic` is applied on `<body>` (`app/layout.tsx`), so the whole app inherits the tokens,
typography, and `cv-*` component classes. **The neumorphic `.neu*` system has been deleted**
from `app/globals.css`; the dead `components/ReportForm.tsx` (old single-phase form) was removed.
Every screen is restyled: report flow (proof + AI reveal), dashboard/feed, issue detail
(+ `CitizenCount`), map (custom severity pins + civic popup + `CitizenCount`), profile, login,
top nav + bottom nav (lucide icons + teal FAB). `CATEGORY_EMOJI` in `lib/config.ts` is now
unused (kept harmless); icons come from `categoryMeta()` in `components/civic/meta.tsx`.

## Anti-template rules (a template look is an automatic fail)
- Neumorphism is killed. Depth = hairline borders + at most two real elevation levels
  (`--c-shadow-sm`, `--c-shadow-md`), used sparingly. No uniform soft shadows.
- No emoji/placeholder icons. Custom icon set via **lucide-react** (`components/civic/meta.tsx`):
  pothole=Construction, water_leak=Droplets, broken_streetlight=Lightbulb, garbage=Trash2,
  other=MapPin.
- Real type hierarchy: **Space Grotesk** (display/headings) + **Inter** (body), loaded in
  `app/layout.tsx` as `--font-display` / `--font-body`. The pairing is what kills the template feel.
- 8px spacing rhythm; not seven identical rounded boxes with identical padding.

## Tokens (see `.civic` block in `app/globals.css` — single source of truth)
- Accent: elevated teal — `--c-accent #0e9384`, `--c-accent-strong`, `--c-accent-weak` (tint).
  ONE accent, used deliberately. Don't rainbow it.
- Neutrals: deep ink/slate text (`--c-ink #14181f`, `--c-text`, `--c-muted`, `--c-faint`) on
  warm off-white surfaces (`--c-bg #f7f5f0`, `--c-surface #fff`, `--c-surface-2`). No cold lavender.
- Borders: `--c-border` / `--c-border-strong` (hairlines).
- **Semantic severity/status (consistent across feed, map, detail):**
  high=red (`--c-high`), med=amber (`--c-med`), low/info=blue (`--c-low`), resolved/ok=green (`--c-ok`).
  Each has `-bg` and `-bd` companions for tinted badges. Status: submitted=blue, acknowledged=blue,
  in_progress=amber, resolved=green (see `STATUS_META`).
- Radii: `--c-radius-lg 22px`, `--c-radius 15px`, `--c-radius-sm 10px`, `--c-radius-pill 9999px`.

### Reference-driven warm pass (REF-1/2/3, rolled out 2026-06-24, user-approved)
Layered onto the Civic system (teal + severity kept). New surface tokens for the warm/caramel feel:
`--c-bg #f2ede6` (warm sand page, was #f7f5f0), `--c-surface-muted #e8e2d9` (section backgrounds),
`--c-surface-accent #c8a882` (caramel — AI digest / accent surfaces), `--c-on-caramel #fffaf2`
(text on caramel), `--c-shadow-float 0 4px 16px / 0 2px 6px` (floating nav + selected-issue pill).
New classes: `.cv-icon-btn` (36px header icon button, no box), `.cv-pin-bubble` + `.cv-pin-count`
(circular severity-ringed map pin + count badge), `.cv-map .leaflet-tile` filter
(`saturate(.6) sepia(.15) brightness(1.05)` — muted warm basemap), `.cv-map-pill` (REF-1 floating
selected-issue pill, fixed above the nav). `.cv-nav-link` is now bottom-nav-only, circular,
active = **teal-filled** circle (was tinted). New helper `severityAccent()` in `meta.tsx` → solid
severity color for card left-borders.

Component changes:
- **Header** (`Nav.tsx`): REF-2 slim — 48px, no card, hairline border-bottom, padding inherited from
  the page container so it aligns with content. Search + sign-out are bare 36px icon buttons.
- **Bottom nav** (`BottomNav.tsx`): white pill, `--c-shadow-float`, floats `12px + env(safe-area-inset-bottom)`.
- **Feed/issue cards** (`ClusterCard`, issue detail, profile cards): 4px severity **left-border accent**;
  `CountPill` now pops in teal (`Users` icon, teal-weak bg, 700).
- **Map** (`MapView`): tiles desaturated/warmed; pins are circular icon bubbles (lucide glyph via
  `renderToStaticMarkup`, severity ring, count badge); clicking a pin opens the floating `.cv-map-pill`
  (category + count + compact VerifyButton + View →), dismissed by tapping the map. Height
  `calc(100vh - 230px)`.
- **AI digest** (`DigestCard`): full caramel surface, near-white text, semi-transparent white stat chips.
- **Profile**: 64px avatar, "N reports filed" stat chip, recessed `--c-surface-muted` reports section,
  illustrated empty state.
- **Report flow**: photo zone radius-lg + ✕-to-clear on the preview; 20px section rhythm. CTA unchanged.
- **Desktop**: page container widens to `lg:max-w-6xl`; all content pages stay centered (`lg:max-w-2xl/3xl`).
  (A dashboard feed+map side-by-side was tried then **removed 2026-06-24** — user found it clunky to use;
  the map keeps its own /map tab.)

## Component classes (`.civic` scope)
`.cv-card` (hairline + shadow-sm), `.cv-elevated` (shadow-md, key surfaces), `.cv-well`
(recessed), `.cv-btn` + `.cv-btn-primary/secondary/ghost`, `.cv-field` (focus = accent ring),
`.cv-chip` + severity variants `.cv-sev-high/med/low/ok`, `.cv-eyebrow` (overline label),
`.cv-ai-surface` (accent-tinted gradient for AI moments), `.cv-display` (grotesk numerals).

## Motion (`lib/motion.ts`, framer-motion)
Polished, never bouncy-toy: short eased springs, small travel. Primitives: `fadeUp`, `stagger`
+ `staggerItem`, `spring`, `easeOut`. Honors `prefers-reduced-motion` for the shimmer.
The **AI reveal is the signature animation** (staged ~2s, then the result card staggers in).
Subtle list stagger, gentle count-up on cluster numbers (`CountUp`), micro-feedback on buttons.

See [[ai-reveal]] for the report-flow flow that uses all of this.
