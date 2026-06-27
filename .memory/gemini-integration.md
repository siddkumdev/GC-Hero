# Gemini integration

SDK: `@google/genai`. Client constructed once in `lib/gemini.ts` with
`new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })`. **Server-side only.** If the key is
missing, the report pipeline throws a clear error; the rest of the app (map, dashboard, seeded
clusters) still works for demoing.

Model names come from env (`lib/config.ts`), defaults:
- Vision + text: `gemini-2.5-flash`, with an automatic **fallback chain**
  (`GEMINI_FALLBACK_MODELS` = `gemini-2.5-flash-lite,gemini-2.0-flash,gemini-2.0-flash-lite`).
  Each model has its OWN free-tier daily quota (~20 req/day/model), so `generateAcrossModels`
  in `lib/gemini.ts` routes around a model that's rate-limited (429) or overloaded (503) instead
  of failing — only throws `GeminiOverloadedError` if EVERY model is down. Embeddings are NOT
  chained (different models give incomparable vectors; would break clustering vs seeded data).
- Embeddings: `gemini-embedding-001` (requested at 768-dim via `outputDimensionality`; native
  default is 3072). Must match the seed's vector length. `text-embedding-004` is NOT available
  on this API version — confirmed via `scripts/check-gemini.ts`.

## 1. Image understanding (vision) — FIXED schema, low temperature
`analyzeIssueImage(base64, mimeType)` calls `generateContent` with `temperature: 0.2`,
`responseMimeType: "application/json"`, and a `responseSchema` enforcing exactly:
```jsonc
{
  "category":      "pothole" | "water_leak" | "broken_streetlight" | "garbage" | "other",
  "severity":      "low" | "med" | "high",
  "description":   string,   // one neutral factual sentence
  "department":    string,   // simulated routing, e.g. "Public Works Department"
  "is_valid_issue": boolean  // false if not a real civic issue (selfie, meme, random object)
}
```
Output is re-validated with the zod schema in `lib/types.ts` before use. Categories are a
closed set (mirrored in `lib/config.ts`) so the system layer can group reliably.

## 2. Complaint drafting (text)
`draftComplaint(report)` → a clean, file-ready complaint addressed to the responsible
department, including category/severity/location context. Plain text. Temperature ~0.3.

## 3. Embeddings (dedup signal)
`embedText(text)` → `embedContent` on the description; returns a `number[]`. Stored on the
`Report` as a JSON string. Used by `lib/clustering.ts` for cosine similarity. This is the
**system layer's** input — Gemini only produces the vector; our code does the matching.

## Prompts
Keep prompts terse and instruction-first. The vision prompt tells Gemini it is triaging a
citizen-submitted civic-issue photo and must fill the schema; if the photo is not a civic
issue, set `is_valid_issue: false`. Do NOT ask Gemini to do clustering, geo, or status.

## Stretch seam (do not build now)
Visual dedup via a local CLIP/DINOv2 image embedding on-GPU is a sharper future upgrade.
`lib/clustering.ts` takes an embedding vector generically, so swapping/adding an image-embedding
source is a localized change. Noted in `decisions-log.md`.
