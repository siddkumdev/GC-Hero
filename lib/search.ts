import { getAllClusters } from "@/lib/db/clusters";
import { haversineMeters } from "@/lib/clustering";
import { urgencyScore, type Severity } from "@/lib/config";
import type { SearchFilter, SearchResultDTO } from "@/lib/types";

// SYSTEM LAYER. Gemini turned free text into a SearchFilter (intent); everything here is our own
// code filtering our own data. No Gemini, no network — pure predicates over clusters.

/** True if the cluster passes every non-null facet of the filter (facets AND together). */
function matches(
  c: {
    category: string;
    severity: string;
    status: string;
    title: string;
    summary: string;
    centroidLat: number;
    centroidLng: number;
    createdAt: Date;
  },
  filter: SearchFilter,
): boolean {
  if (filter.category && c.category !== filter.category) return false;
  if (filter.severity && c.severity !== filter.severity) return false;
  if (filter.status && c.status !== filter.status) return false;

  if (filter.location) {
    const d = haversineMeters(
      filter.location.lat,
      filter.location.lng,
      c.centroidLat,
      c.centroidLng,
    );
    if (d > filter.location.radiusMeters) return false;
  }

  if (filter.dateFrom) {
    // Inclusive from start-of-day.
    if (c.createdAt < new Date(`${filter.dateFrom}T00:00:00`)) return false;
  }
  if (filter.dateTo) {
    // Inclusive to end-of-day.
    if (c.createdAt > new Date(`${filter.dateTo}T23:59:59.999`)) return false;
  }

  if (filter.text) {
    const hay = `${c.title} ${c.summary}`.toLowerCase();
    if (!hay.includes(filter.text.toLowerCase())) return false;
  }

  return true;
}

/** Whether any facet is active (an all-null filter matches everything → show all, urgency-ranked). */
export function isEmptyFilter(filter: SearchFilter): boolean {
  return (
    !filter.category &&
    !filter.severity &&
    !filter.status &&
    !filter.location &&
    !filter.dateFrom &&
    !filter.dateTo &&
    !filter.text
  );
}

/** Apply a structured filter to all tracked clusters; return matches ranked by urgency. */
export async function searchClusters(filter: SearchFilter): Promise<SearchResultDTO[]> {
  const clusters = await getAllClusters();
  return clusters
    .filter((c) => matches(c, filter))
    .map((c) => ({
      cluster: c,
      urgency: urgencyScore(c.severity as Severity, c.reportCount),
    }))
    .sort((a, b) => b.urgency - a.urgency)
    .map(({ cluster: c }) => ({
      id: c.id,
      category: c.category,
      severity: c.severity,
      status: c.status,
      summary: c.summary,
      reportCount: c.reportCount,
      verifiedCount: c.verifiedCount,
    }));
}
