import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import {
  GEMINI_VISION_MODEL,
  GEMINI_FALLBACK_MODELS,
  GEMINI_EMBEDDING_MODEL,
  EMBEDDING_DIM,
  CATEGORIES,
  SEVERITIES,
  STATUSES,
  CATEGORY_LABELS,
  DEPARTMENT_BY_CATEGORY,
  type Category,
  type Severity,
  type Status,
} from "@/lib/config";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import {
  issueAnalysisSchema,
  resolutionVerdictSchema,
  type IssueAnalysis,
  type ResolutionVerdict,
  type SearchFilter,
  type DigestStats,
} from "@/lib/types";
import type { InlineImage } from "@/lib/images";

// PERCEPTION LAYER. Server-only. Gemini understands ONE image, validates it, drafts complaint
// text, and produces embeddings. It does NOT do clustering / geo / status (that's our code).

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env (server-side only). " +
        "Map/dashboard/seeded data still work without it.",
    );
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Gemini (especially free-tier) intermittently returns 503 UNAVAILABLE ("high demand") or
// 429 RESOURCE_EXHAUSTED. These are transient, so retry a few times with exponential backoff
// + jitter before giving up. Thrown as a tagged error the API route maps to a friendly 503.
export class GeminiOverloadedError extends Error {
  constructor() {
    super("Gemini is busy right now (high demand). Please try again in a moment.");
    this.name = "GeminiOverloadedError";
  }
}

function isOverloadError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toUpperCase();
  return (
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("OVERLOADED") ||
    msg.includes("HIGH DEMAND") ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED")
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isOverloadError(err) || i === attempts - 1) break;
      // 0.4s, 1s, 2.5s (+ up to 300ms jitter) — enough to ride out a demand spike.
      const backoff = [400, 1000, 2500][i] ?? 2500;
      await sleep(backoff + Math.random() * 300);
    }
  }
  if (isOverloadError(lastErr)) throw new GeminiOverloadedError();
  throw lastErr;
}

// Ordered, de-duplicated model list: primary first, then fallbacks.
const VISION_MODELS = [GEMINI_VISION_MODEL, ...GEMINI_FALLBACK_MODELS].filter(
  (m, i, a) => a.indexOf(m) === i,
);

// Run generateContent across the model fallback chain. Each model gets a couple of retries;
// on an overload/rate-limit (503/429) we move on to the next model. Non-transient errors stop
// immediately. Throws GeminiOverloadedError only if EVERY model is overloaded.
async function generateAcrossModels(
  ai: GoogleGenAI,
  params: Omit<GenerateContentParameters, "model">,
): Promise<GenerateContentResponse> {
  let lastErr: unknown;
  for (const model of VISION_MODELS) {
    try {
      const out = await withRetry(() => ai.models.generateContent({ model, ...params }), 2);
      if (model !== VISION_MODELS[0]) {
        console.warn(`[gemini] primary unavailable; served by fallback model "${model}"`);
      }
      return out;
    } catch (err) {
      lastErr = err;
      if (isOverloadError(err)) {
        console.warn(`[gemini] model "${model}" overloaded/rate-limited — trying next`);
        continue; // overloaded/rate-limited → try the next model
      }
      throw err; // genuine error (bad request, auth, …) → stop
    }
  }
  if (isOverloadError(lastErr)) throw new GeminiOverloadedError();
  throw lastErr;
}

const VISION_PROMPT = `You are triaging a single citizen-submitted photo for a civic-issue reporting app.
Decide whether the photo shows a REAL public civic issue (a problem in public infrastructure or
public space). Examples of valid issues: potholes, water leaks/flooding, broken/non-working
streetlights, uncollected garbage or illegal dumping. NOT valid: selfies, people, food, memes,
screenshots, indoor/private scenes, random objects with no civic problem.

Fill the response schema exactly:
- category: the single best-fit category.
- severity: low (minor/cosmetic), med (notable, should be fixed), high (dangerous/urgent).
- description: ONE neutral factual sentence describing what is visibly wrong.
- severity_reason: ONE short clause (max ~12 words) justifying the severity, e.g. "deep enough to damage vehicles" or "minor surface cracking only".
- department: the municipal department that should handle it.
- is_valid_issue: false if this is NOT a real civic issue (then other fields are best-effort).
Be consistent and conservative.`;

// responseSchema enforces the fixed JSON contract at the model boundary; zod re-checks after.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING, enum: [...CATEGORIES] },
    severity: { type: Type.STRING, enum: [...SEVERITIES] },
    description: { type: Type.STRING },
    severity_reason: { type: Type.STRING },
    department: { type: Type.STRING },
    is_valid_issue: { type: Type.BOOLEAN },
  },
  required: [
    "category",
    "severity",
    "description",
    "severity_reason",
    "department",
    "is_valid_issue",
  ],
  propertyOrdering: [
    "category",
    "severity",
    "description",
    "severity_reason",
    "department",
    "is_valid_issue",
  ],
};

/** Understand one civic-issue image → fixed, validated JSON. */
export async function analyzeIssueImage(
  base64Data: string,
  mimeType: string,
): Promise<IssueAnalysis> {
  const ai = getClient();
  const res = await generateAcrossModels(ai, {
    contents: [
      {
        role: "user",
        parts: [
          { text: VISION_PROMPT },
          { inlineData: { mimeType, data: base64Data } },
        ],
      },
    ],
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = res.text;
  if (!text) throw new Error("Gemini returned an empty analysis.");

  const parsed = issueAnalysisSchema.parse(JSON.parse(text));
  // Normalize the routing target to our simulated table so it stays consistent.
  parsed.department = DEPARTMENT_BY_CATEGORY[parsed.category as Category];
  return parsed;
}

/** Draft a clean, file-ready complaint addressed to the responsible department. */
export async function draftComplaint(input: {
  category: Category;
  severity: Severity;
  description: string;
  department: string;
  reporterName: string;
  approxLocation: string;
}): Promise<string> {
  const ai = getClient();
  const prompt = `Write a concise, polite, file-ready civic complaint in plain text (no markdown).
Address it to: ${input.department}.
Issue type: ${CATEGORY_LABELS[input.category]} (severity: ${input.severity}).
Observation: ${input.description}
Approximate location: ${input.approxLocation}.
Reporter: ${input.reporterName}.
Include a short subject line, one short body paragraph stating the issue, its location and why it
needs attention, and a courteous request for action. Do not invent specific street addresses or
case numbers. 120 words max.`;

  const res = await generateAcrossModels(ai, {
    contents: prompt,
    config: { temperature: 0.3 },
  });
  return (res.text ?? "").trim();
}

// F1 — before/after resolution verification. Gemini compares the ORIGINAL issue photo against a
// new "after" photo and judges whether the same issue is now fixed. Perception only: our code
// decides what to do with the verdict (whether to flip status), using a confidence threshold.
const RESOLUTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    is_resolved: { type: Type.BOOLEAN },
    confidence: { type: Type.NUMBER },
    reasoning: { type: Type.STRING },
  },
  required: ["is_resolved", "confidence", "reasoning"],
  propertyOrdering: ["is_resolved", "confidence", "reasoning"],
};

/**
 * Compare an original ("before") civic-issue photo with a new ("after") photo and decide whether
 * the SAME issue has been resolved. Returns a fixed, validated verdict; never mutates state.
 */
export async function verifyResolution(
  before: InlineImage,
  after: InlineImage,
  context: { categoryLabel: string; description: string },
): Promise<ResolutionVerdict> {
  const ai = getClient();
  const prompt = `You are verifying whether a reported civic issue has been RESOLVED.
The issue was: ${context.categoryLabel} — "${context.description}".
The FIRST image is the ORIGINAL "before" photo of the problem.
The SECOND image is a NEW "after" photo taken at the same place.
Decide whether the SAME issue is now fixed.
Fill the schema exactly:
- is_resolved: true ONLY if the original problem is clearly gone/repaired in the after photo.
- confidence: 0..1, how sure you are.
- reasoning: ONE short sentence citing what changed (or why you can't confirm a fix).
Be conservative: if the after photo is unclear, shows a different place, or the problem still
appears present, set is_resolved=false.`;

  const res = await generateAcrossModels(ai, {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: before.mimeType, data: before.base64 } },
          { inlineData: { mimeType: after.mimeType, data: after.base64 } },
        ],
      },
    ],
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: RESOLUTION_SCHEMA,
    },
  });

  const text = res.text;
  if (!text) throw new Error("Gemini returned an empty resolution verdict.");
  const parsed = resolutionVerdictSchema.parse(JSON.parse(text));
  // Clamp confidence defensively (model can occasionally drift outside 0..1).
  parsed.confidence = Math.min(1, Math.max(0, parsed.confidence));
  return parsed;
}

// F2 — natural-language search. Gemini ONLY parses free text into a structured filter; our code
// (lib/search.ts) does all the actual filtering over our data. Perception/intent only.
const SEARCH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING, enum: [...CATEGORIES], nullable: true },
    severity: { type: Type.STRING, enum: [...SEVERITIES], nullable: true },
    status: { type: Type.STRING, enum: [...STATUSES], nullable: true },
    location_name: { type: Type.STRING, nullable: true },
    location_lat: { type: Type.NUMBER, nullable: true },
    location_lng: { type: Type.NUMBER, nullable: true },
    location_radius_m: { type: Type.NUMBER, nullable: true },
    date_from: { type: Type.STRING, nullable: true },
    date_to: { type: Type.STRING, nullable: true },
    text: { type: Type.STRING, nullable: true },
  },
};

/**
 * Parse a free-text civic-issue search ("high-severity water issues near Whitefield this week")
 * into a structured filter. `today` (YYYY-MM-DD) anchors relative dates. Returns a fully-coerced
 * SearchFilter — anything the model gets wrong/omits is normalized to null here, so the system
 * layer can trust it.
 */
export async function parseSearchQuery(
  query: string,
  today: string,
): Promise<SearchFilter> {
  const ai = getClient();
  const prompt = `Convert this civic-issue search query into a structured filter for a city
issue-tracker. Today's date is ${today}.
Query: "${query}"

Rules:
- category: one of pothole, water_leak, broken_streetlight, garbage, other — or null.
- severity: one of low, med, high — or null. ("high-severity" → high.)
- status: one of submitted, acknowledged, in_progress, resolved — or null.
- If the query names a place/area/locality, set location_name and your BEST-KNOWN approximate
  location_lat/location_lng for it, plus a sensible location_radius_m (e.g. 1500-3000 for a
  neighborhood). Otherwise leave all location_* null.
- For relative time ("today", "this week", "last month", "past 3 months") compute date_from and
  date_to as YYYY-MM-DD relative to today. Otherwise null.
- text: any leftover descriptive keyword to match (else null).
Leave every field null when the query doesn't specify it. Do not invent filters.`;

  const res = await generateAcrossModels(ai, {
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: SEARCH_SCHEMA,
    },
  });

  const text = res.text;
  if (!text) throw new Error("Gemini returned an empty search parse.");
  return coerceSearchFilter(JSON.parse(text));
}

// Defensive normalization: trust nothing from the model. Invalid enums → null; a location only
// survives if it has finite coordinates; dates must look like dates.
function coerceSearchFilter(raw: unknown): SearchFilter {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;

  const lat = Number(r.location_lat);
  const lng = Number(r.location_lng);
  const radius = Number(r.location_radius_m);
  const hasLoc =
    typeof r.location_name === "string" &&
    r.location_name.trim().length > 0 &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  const cleanDate = (v: unknown): string | null =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
      ? v
      : null;

  const cleanText =
    typeof r.text === "string" && r.text.trim().length > 0 ? r.text.trim() : null;

  return {
    category: pick<Category>(r.category, CATEGORIES),
    severity: pick<Severity>(r.severity, SEVERITIES),
    status: pick<Status>(r.status, STATUSES),
    location: hasLoc
      ? {
          name: (r.location_name as string).trim(),
          lat,
          lng,
          radiusMeters: Number.isFinite(radius) && radius > 0 ? radius : 2000,
        }
      : null,
    dateFrom: cleanDate(r.date_from),
    dateTo: cleanDate(r.date_to),
    text: cleanText,
  };
}

// F3 — community digest. Our code computes ALL the numbers (lib/digest.ts); Gemini only turns
// them into a short, readable summary + one inferred insight. Reasoning over aggregates, not a
// trained model. Plain text, no markdown.
export async function writeDigest(stats: DigestStats): Promise<string> {
  const ai = getClient();
  const labeled = {
    total_issues: stats.totalIssues,
    total_reports: stats.totalReports,
    resolved: stats.resolvedCount,
    by_category: Object.fromEntries(
      Object.entries(stats.byCategory).map(([k, v]) => [
        CATEGORY_LABELS[k as Category] ?? k,
        v,
      ]),
    ),
    by_severity: stats.bySeverity,
    by_status: stats.byStatus,
    top_issue: stats.topIssue
      ? {
          category: CATEGORY_LABELS[stats.topIssue.category] ?? stats.topIssue.category,
          reports: stats.topIssue.reportCount,
          summary: stats.topIssue.summary,
        }
      : null,
    hotspots: stats.hotspots.map((h) => ({
      category: CATEGORY_LABELS[h.category] ?? h.category,
      count: h.count,
      within_meters: h.radiusMeters,
    })),
  };

  const prompt = `You are writing a short civic "community digest" for a city issue dashboard.
Here are the aggregate statistics (already computed — do not recount):
${JSON.stringify(labeled, null, 2)}

Write 2-3 short sentences of plain text (no markdown, no bullet points, no headings):
1. A one-line state-of-play (totals + how many are resolved).
2. The most pressing or most-reported issue.
3. ONE inferred insight — especially a repeat-location hotspot if present (e.g. several issues of
   the same type clustered together suggests a systemic problem worth prioritizing).
Be specific with the numbers given. Do not invent data not present above. Under 70 words.`;

  const res = await generateAcrossModels(ai, {
    contents: prompt,
    config: { temperature: 0.4 },
  });
  return (res.text ?? "").trim();
}

/** Embed text (the issue description) → vector. System layer uses it for dedup. */
export async function embedText(text: string): Promise<number[]> {
  const ai = getClient();
  const res = await withRetry(() =>
    ai.models.embedContent({
      model: GEMINI_EMBEDDING_MODEL,
      contents: text,
      config: { outputDimensionality: EMBEDDING_DIM },
    }),
  );
  const values = res.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini returned an empty embedding.");
  }
  return values;
}

/** Generate a step-by-step action plan for city workers to resolve a civic issue. */
export async function generateActionPlan(input: {
  category: string;
  severity: string;
  description: string;
  reportCount: number;
}): Promise<string> {
  const ai = getClient();
  const prompt = `You are an expert city planner and maintenance director.
Generate a concise, professional, step-by-step resolution action plan for city workers to fix the following civic issue:
- Category: ${input.category}
- Severity: ${input.severity}
- Description: ${input.description}
- Number of Citizen Reports: ${input.reportCount}

Your response must be in plain text (no markdown formatting like ** or ##).
Structure it exactly with these sections (include the section titles):
Materials Needed:
(list 2-3 essential materials)

Safety Precautions:
(1-2 sentences on securing the site)

Action Steps:
1. (Step 1)
2. (Step 2)
3. (Step 3)

Estimated Time:
(e.g., 4 hours, 2 days)

Keep it highly practical, brief, and under 150 words total.`;

  const res = await generateAcrossModels(ai, {
    contents: prompt,
    config: { temperature: 0.2 },
  });
  return (res.text ?? "").trim();
}

/** Draft a formal escalation email to local authorities regarding a severe/unresolved issue. */
export async function draftEscalationEmail(input: {
  category: string;
  severity: string;
  description: string;
  reportCount: number;
  department: string;
}): Promise<{ subject: string; body: string }> {
  const ai = getClient();
  const prompt = `You are a concerned citizen drafting a formal escalation email to local authorities regarding an unresolved civic issue.
- Category: ${input.category}
- Severity: ${input.severity}
- Description: ${input.description}
- Number of Citizen Reports: ${input.reportCount}
- Department: ${input.department}

Write a professional and urgent email in plain text.
First line must be the subject line starting with "SUBJECT: ".
The rest should be the email body.
Do NOT include any placeholders like [Your Name] or [City Name] - write it so it is ready to send immediately. Mention that ${input.reportCount} citizens have corroborated this issue on the GHero platform. Keep the body under 120 words.`;

  const res = await generateAcrossModels(ai, {
    contents: prompt,
    config: { temperature: 0.3 },
  });
  
  const text = (res.text ?? "").trim();
  const lines = text.split("\n");
  let subject = "Urgent Civic Issue Escalation";
  let bodyStartIdx = 0;
  
  if (lines[0].toUpperCase().startsWith("SUBJECT:")) {
    subject = lines[0].substring(8).trim();
    bodyStartIdx = 1;
  }
  
  const body = lines.slice(bodyStartIdx).join("\n").trim();
  return { subject, body };
}
