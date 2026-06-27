import {
  findClustersWithEmbeddingsByCategory,
  findOpenClustersByCategory,
  findClusterByIdOrThrow,
  updateCluster,
  createCluster,
} from "@/lib/db/clusters";
import {
  CLUSTER_RADIUS_METERS,
  CLUSTER_SIMILARITY_THRESHOLD,
  maxSeverity,
  type Category,
  type Severity,
} from "@/lib/config";

// SYSTEM LAYER. Duplicate detection = same category AND geo-proximity AND embedding similarity.
// Gemini only produced the embedding; all matching/geo/state below is our own code.
// The embedding is passed in generically, so a future image-embedding source (CLIP/DINOv2)
// slots in here without changing the match logic. See .memory/decisions-log.md.

/** Great-circle distance between two lat/lng points, in meters. */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Cosine similarity of two equal-length vectors (0..1 for typical embeddings). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface ClusterResolution {
  clusterId: string;
  isNew: boolean;
  previousCount: number;
  reportCount: number;
  matchedSimilarity: number | null;
}

interface ResolveInput {
  category: Category;
  severity: Severity;
  lat: number;
  lng: number;
  embedding: number[];
  title: string;
  summary: string;
}

interface MatchInput {
  category: Category;
  lat: number;
  lng: number;
  embedding: number[];
}

export interface ClusterMatch {
  clusterId: string;
  similarity: number;
  distanceMeters: number;
  reportCount: number;
}

/**
 * READ-ONLY. Find the best existing cluster a report would join (same category, within
 * radius, embedding similarity >= threshold) without writing anything. Shared by the
 * confirm pipeline (`resolveCluster`) and the report-flow preview (`previewCluster`),
 * so "we found N similar nearby" and the actual attach use identical logic.
 */
export async function findBestCluster(
  input: MatchInput,
): Promise<ClusterMatch | null> {
  // Migrated from Prisma — 2026-06-24
  const candidates = await findClustersWithEmbeddingsByCategory(input.category);

  let best: ClusterMatch | null = null;

  for (const c of candidates) {
    const distance = haversineMeters(
      input.lat,
      input.lng,
      c.centroidLat,
      c.centroidLng,
    );
    if (distance > CLUSTER_RADIUS_METERS) continue;

    // Max similarity against any member report's description embedding.
    let bestSim = 0;
    for (const r of c.reports) {
      const vec = safeParseEmbedding(r.embedding);
      if (vec) bestSim = Math.max(bestSim, cosineSimilarity(input.embedding, vec));
    }

    if (
      bestSim >= CLUSTER_SIMILARITY_THRESHOLD &&
      (!best || bestSim > best.similarity)
    ) {
      best = {
        clusterId: c.id,
        similarity: bestSim,
        distanceMeters: distance,
        reportCount: c.reportCount,
      };
    }
  }

  return best;
}

export interface ResolutionCandidate {
  clusterId: string;
  distanceMeters: number;
  reportCount: number;
}

/**
 * F1 auto-path. READ-ONLY. Find the nearest OPEN (not yet resolved) cluster of the same category
 * within the dedup radius — WITHOUT any embedding-similarity gate. A fixed issue photographs
 * differently from the original problem, so similarity would be low; here we only care about
 * "is there an open issue of this kind right here that this might be an update to?".
 *
 * `excludeClusterId` lets the caller skip the cluster the dedup already matched as a true
 * duplicate (same broken thing again ≠ a fix), so we never ask "is this resolved?" about it.
 */
export async function findNearbyOpenCluster(
  input: { category: Category; lat: number; lng: number },
  excludeClusterId?: string | null,
): Promise<ResolutionCandidate | null> {
  // Migrated from Prisma — 2026-06-24
  const candidates = await findOpenClustersByCategory(input.category);

  let best: ResolutionCandidate | null = null;
  for (const c of candidates) {
    if (excludeClusterId && c.id === excludeClusterId) continue;
    const distance = haversineMeters(input.lat, input.lng, c.centroidLat, c.centroidLng);
    if (distance > CLUSTER_RADIUS_METERS) continue;
    if (!best || distance < best.distanceMeters) {
      best = { clusterId: c.id, distanceMeters: distance, reportCount: c.reportCount };
    }
  }
  return best;
}

/**
 * Find the best existing cluster for a new report (same category, within radius, and
 * description-embedding similarity >= threshold) and attach to it; otherwise create a new
 * cluster. Returns the chosen cluster id and its updated report count.
 *
 * Note: caller is responsible for creating the Report row with the returned clusterId.
 */
export async function resolveCluster(
  input: ResolveInput,
): Promise<ClusterResolution> {
  const best = await findBestCluster(input);

  if (best) {
    // Migrated from Prisma — 2026-06-24
    const existing = await findClusterByIdOrThrow(best.clusterId);
    const newCount = existing.reportCount + 1;
    // Running-average centroid so the pin reflects all member reports.
    const centroidLat =
      (existing.centroidLat * existing.reportCount + input.lat) / newCount;
    const centroidLng =
      (existing.centroidLng * existing.reportCount + input.lng) / newCount;

    await updateCluster(existing.id, {
      reportCount: newCount,
      centroidLat,
      centroidLng,
      severity: maxSeverity(existing.severity as Severity, input.severity),
    });

    return {
      clusterId: existing.id,
      isNew: false,
      previousCount: existing.reportCount,
      reportCount: newCount,
      matchedSimilarity: best.similarity,
    };
  }

  // No match → new tracked issue.
  const created = await createCluster({
    category: input.category,
    severity: input.severity,
    status: "submitted",
    title: input.title,
    summary: input.summary,
    centroidLat: input.lat,
    centroidLng: input.lng,
    reportCount: 1,
    resolutionImagePath: null,
    resolutionConfidence: null,
    resolutionReasoning: null,
    resolvedAt: null,
  });

  return {
    clusterId: created.id,
    isNew: true,
    previousCount: 0,
    reportCount: 1,
    matchedSimilarity: null,
  };
}

function safeParseEmbedding(json: string): number[] | null {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as number[]) : null;
  } catch {
    return null;
  }
}
