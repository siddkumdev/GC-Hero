// Central tunable knobs + closed vocabularies. Never hardcode these at call sites.

export const GEMINI_VISION_MODEL =
  process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
// Ordered fallbacks for vision/text: when the primary model is overloaded (503) or rate-limited
// (429) — common on the free tier — we transparently fall through to the next available model
// instead of failing the request. -lite models have separate, higher free-tier quota.
// Each model has its OWN free-tier daily quota (e.g. ~20 req/day/model), so spreading across
// the flash family multiplies effective capacity and routes around a model that's exhausted (429)
// or momentarily overloaded (503).
export const GEMINI_FALLBACK_MODELS = (
  process.env.GEMINI_FALLBACK_MODELS ||
  "gemini-2.5-flash-lite,gemini-2.0-flash,gemini-2.0-flash-lite"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
export const GEMINI_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
// Requested embedding dimensionality (gemini-embedding-001 defaults to 3072; we ask for a
// smaller vector to keep storage light. Must match the seed's vector length).
export const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM ?? 768);

// Duplicate-clustering thresholds (env-overridable).
export const CLUSTER_RADIUS_METERS = Number(
  process.env.CLUSTER_RADIUS_METERS ?? 150,
);
export const CLUSTER_SIMILARITY_THRESHOLD = Number(
  process.env.CLUSTER_SIMILARITY_THRESHOLD ?? 0.82,
);

// F1 — minimum Gemini confidence (0..1) before a before/after comparison is allowed to flip an
// issue to "resolved". Below this we keep the issue open and just show the AI's reasoning.
export const RESOLUTION_CONFIDENCE_THRESHOLD = Number(
  process.env.RESOLUTION_CONFIDENCE_THRESHOLD ?? 0.7,
);

// F3 — community digest. Two same-category issues whose centroids are within this radius count as
// a repeat-location "hotspot" (the systemic-problem signal Gemini narrates).
export const HOTSPOT_RADIUS_METERS = Number(
  process.env.HOTSPOT_RADIUS_METERS ?? 500,
);

// Closed category set — Gemini must pick from these; the system layer groups on them.
export const CATEGORIES = [
  "pothole",
  "water_leak",
  "broken_streetlight",
  "garbage",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SEVERITIES = ["low", "med", "high"] as const;
export type Severity = (typeof SEVERITIES)[number];

// Simulated municipal lifecycle (lives on the Cluster).
export const STATUSES = [
  "submitted",
  "acknowledged",
  "in_progress",
  "resolved",
] as const;
export type Status = (typeof STATUSES)[number];

// Human-readable labels (functional only — not design).
export const CATEGORY_LABELS: Record<Category, string> = {
  pothole: "Pothole",
  water_leak: "Water leak",
  broken_streetlight: "Broken streetlight",
  garbage: "Garbage / waste",
  other: "Other",
};

// Emoji glyphs for the neumorphic category squircles (cheap, colorful, no asset pipeline).
export const CATEGORY_EMOJI: Record<Category, string> = {
  pothole: "🕳️",
  water_leak: "💧",
  broken_streetlight: "💡",
  garbage: "🗑️",
  other: "📍",
};

// Simulated department routing per category (stub for real municipal APIs).
export const DEPARTMENT_BY_CATEGORY: Record<Category, string> = {
  pothole: "Public Works Department (Roads)",
  water_leak: "Water Supply & Sewerage Board",
  broken_streetlight: "Municipal Electrical Department",
  garbage: "Solid Waste Management Department",
  other: "Municipal Grievance Cell",
};

const SEVERITY_RANK: Record<Severity, number> = { low: 0, med: 1, high: 2 };

/** Higher of two severities (clusters track the worst seen). */
export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/**
 * Simple urgency signal for the system layer: severity weight amplified by how many
 * citizens have reported the same issue. Not shown to Gemini — this is our logic.
 */
export function urgencyScore(severity: Severity, reportCount: number): number {
  return (SEVERITY_RANK[severity] + 1) * Math.log2(reportCount + 1);
}
