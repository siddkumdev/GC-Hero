import { z } from "zod";
import {
  CATEGORIES,
  SEVERITIES,
  STATUSES,
  type Category,
  type Severity,
  type Status,
} from "@/lib/config";

// The FIXED schema Gemini must return for image understanding.
// Re-validated here after the model responds (defense in depth on top of responseSchema).
export const issueAnalysisSchema = z.object({
  category: z.enum(CATEGORIES),
  severity: z.enum(SEVERITIES),
  description: z.string().min(1),
  // One short clause justifying the severity call — shown in the AI reveal, not persisted.
  severity_reason: z.string().min(1),
  department: z.string().min(1),
  is_valid_issue: z.boolean(),
});

export type IssueAnalysis = z.infer<typeof issueAnalysisSchema>;

// F1 — fixed verdict Gemini returns when comparing a before/after pair. Re-validated after the
// model responds. is_resolved + confidence drive our (system-layer) decision to flip status.
export const resolutionVerdictSchema = z.object({
  is_resolved: z.boolean(),
  confidence: z.number(),
  reasoning: z.string().min(1),
});

export type ResolutionVerdict = z.infer<typeof resolutionVerdictSchema>;

// Returned by /api/clusters/[id]/resolve. The verdict plus what our code decided to do with it.
export interface ResolveResultDTO {
  isResolved: boolean; // AI verdict
  confidence: number; // 0..1
  reasoning: string;
  statusChanged: boolean; // did we actually flip the cluster to "resolved"?
  status: string; // the cluster's status after this check
  afterImagePath: string; // the stored "after" photo we compared
}

// --- F2: natural-language search ---------------------------------------------------------
// Gemini parses free text → this structured filter (intent only). Our code does ALL the actual
// filtering over our own data. Every field is independently nullable so chips are removable.
export interface SearchLocation {
  name: string; // the place the user named, e.g. "Whitefield"
  lat: number; // Gemini's best-known approximate centroid for that place
  lng: number;
  radiusMeters: number;
}

export interface SearchFilter {
  category: Category | null;
  severity: Severity | null;
  status: Status | null;
  location: SearchLocation | null;
  dateFrom: string | null; // inclusive ISO date (YYYY-MM-DD)
  dateTo: string | null; // inclusive ISO date (YYYY-MM-DD)
  text: string | null; // free-text keyword matched against title/summary
}

// Validates a filter handed back by the client (e.g. after a chip is removed) before we re-run
// the system-layer filtering. The Gemini-parsed filter is coerced separately (more forgiving).
export const searchLocationSchema = z.object({
  name: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  radiusMeters: z.number().positive(),
});

export const searchFilterSchema = z.object({
  category: z.enum(CATEGORIES).nullable(),
  severity: z.enum(SEVERITIES).nullable(),
  status: z.enum(STATUSES).nullable(),
  location: searchLocationSchema.nullable(),
  dateFrom: z.string().nullable(),
  dateTo: z.string().nullable(),
  text: z.string().nullable(),
});

// One matched cluster in the search results (lean shape for the feed card).
export interface SearchResultDTO {
  id: string;
  category: string;
  severity: string;
  status: string;
  summary: string;
  reportCount: number;
  verifiedCount: number;
}

export interface SearchResponseDTO {
  filter: SearchFilter; // the effective filter (echoed so the client can render chips)
  results: SearchResultDTO[];
}

// --- F3: AI community digest -------------------------------------------------------------
// Aggregate stats are computed entirely by our code (lib/digest.ts). Gemini only writes the
// natural-language insight over these numbers — it never counts or geo-clusters.
export interface Hotspot {
  category: Category;
  count: number; // same-category issues co-located within HOTSPOT_RADIUS_METERS
  lat: number; // representative centroid of the hotspot
  lng: number;
  radiusMeters: number;
}

export interface DigestStats {
  totalIssues: number;
  totalReports: number;
  resolvedCount: number;
  byCategory: Record<Category, number>;
  bySeverity: Record<Severity, number>;
  byStatus: Record<Status, number>;
  topIssue: { category: Category; reportCount: number; summary: string } | null;
  hotspots: Hotspot[];
}

export interface DigestResponseDTO {
  digest: string; // Gemini's natural-language summary + insight
  generatedAt: string; // ISO timestamp of when this text was produced
  cached: boolean; // true if served from cache (stats unchanged within TTL)
  stats: {
    totalIssues: number;
    totalReports: number;
    resolvedCount: number;
  };
}

// --- F4: community verification ("I see this too") ---------------------------------------
// One-tap corroboration without a full report. No Gemini — pure system layer. The DB unique
// (clusterId, userId) guarantees one verification per citizen per issue.
//
// The current user's relationship to an issue. "reported" and "verified" both mean they've
// already corroborated it (so the button is inert); only "can" shows an active button.
export type ConfirmState = "can" | "reported" | "verified";

// Returned by POST /api/clusters/[id]/verify.
export interface VerifyResultDTO {
  verifiedCount: number; // distinct citizens who confirmed without reporting
  reportCount: number; // unchanged here; echoed for the combined credibility figure
  credibility: number; // reportCount + verifiedCount (distinct corroborators)
  state: ConfirmState; // the user's relationship after this call (normally "verified")
}

// Shape returned to the client for a stored report + its cluster context.
export interface ReportDTO {
  id: string;
  category: string;
  severity: string;
  description: string;
  department: string;
  complaintDraft: string;
  imagePath: string;
  lat: number;
  lng: number;
  createdAt: string;
  user: { id: string; name: string };
  cluster: ClusterDTO | null;
}

// --- Two-phase report flow (powers the staged AI reveal + visible clustering) ---

// Phase 1 (/api/reports/analyze): Gemini's reading of the photo, plus a read-only
// preview of which existing cluster this would join. Nothing is persisted yet.
export interface AnalyzeResultDTO {
  analysisId: string; // opaque handle to the server-side pending analysis
  imagePath: string;
  category: string;
  severity: string;
  severityReason: string;
  department: string;
  description: string;
  complaintDraft: string;
  clusterPreview: ClusterPreviewDTO;
  // F1 auto-path: set when this photo is geographically near an existing OPEN issue of the same
  // category that the dedup did NOT match as a duplicate (i.e. the scene looks different — it may
  // have been fixed). Drives a soft, dismissible "is this resolved?" suggestion. null otherwise.
  resolutionSuggestion: ResolutionSuggestionDTO | null;
}

// A gentle hint that the just-analyzed photo might be an "after" shot of a nearby open issue.
// The resolution check only runs if the user taps to confirm — never automatically.
export interface ResolutionSuggestionDTO {
  clusterId: string;
  currentCount: number; // citizens currently on that open issue
  distanceMeters: number;
}

// Read-only "what would happen on confirm" — drives "we found N similar within Xm".
export interface ClusterPreviewDTO {
  matched: boolean;
  clusterId: string | null;
  currentCount: number; // reports already in the matched cluster (0 if new)
  similarity: number | null;
  distanceMeters: number | null;
  radiusMeters: number;
}

// Phase 2 (/api/reports/confirm): the report is filed and clustering runs for real.
export interface ConfirmResultDTO {
  clusterId: string;
  isNew: boolean;
  previousCount: number; // before this report joined
  reportCount: number; // after — animate previousCount -> reportCount
  matchedSimilarity: number | null;
}

export interface ClusterDTO {
  id: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  centroidLat: number;
  centroidLng: number;
  reportCount: number;
  urgency: number;
  createdAt: string;
  updatedAt: string;
}
