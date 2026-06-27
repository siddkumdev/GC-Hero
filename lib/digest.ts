import "server-only";
import { getAllClusters } from "@/lib/db/clusters";
import { writeDigest } from "@/lib/gemini";
import { haversineMeters } from "@/lib/clustering";
import {
  CATEGORIES,
  SEVERITIES,
  STATUSES,
  HOTSPOT_RADIUS_METERS,
  type Category,
  type Severity,
  type Status,
} from "@/lib/config";
import type { DigestStats, Hotspot } from "@/lib/types";

// SYSTEM LAYER. Computes every number in the digest from our data. Gemini (writeDigest) only
// narrates them. The result is cached against a signature of the stats so we don't re-call Gemini
// on every dashboard load — only when the underlying data actually changes (or the TTL lapses).

const DIGEST_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cache: { signature: string; text: string; generatedAt: number } | null = null;

type ClusterRow = {
  category: string;
  severity: string;
  status: string;
  summary: string;
  reportCount: number;
  centroidLat: number;
  centroidLng: number;
};

/** Aggregate the current clusters into the digest's input stats (pure counting + geo grouping). */
export async function computeDigestStats(): Promise<DigestStats> {
  // Migrated from Prisma — 2026-06-24
  const clusters = (await getAllClusters()) as ClusterRow[];

  const byCategory = zero(CATEGORIES);
  const bySeverity = zero(SEVERITIES);
  const byStatus = zero(STATUSES);

  let totalReports = 0;
  let topIssue: DigestStats["topIssue"] = null;

  for (const c of clusters) {
    totalReports += c.reportCount;
    if (c.category in byCategory) byCategory[c.category as Category]++;
    if (c.severity in bySeverity) bySeverity[c.severity as Severity]++;
    if (c.status in byStatus) byStatus[c.status as Status]++;
    if (!topIssue || c.reportCount > topIssue.reportCount) {
      topIssue = {
        category: c.category as Category,
        reportCount: c.reportCount,
        summary: c.summary,
      };
    }
  }

  return {
    totalIssues: clusters.length,
    totalReports,
    resolvedCount: byStatus.resolved,
    byCategory,
    bySeverity,
    byStatus,
    topIssue,
    hotspots: findHotspots(clusters),
  };
}

// Greedy spatial grouping per category: any group of >= 2 same-category issues whose centroids
// fall within HOTSPOT_RADIUS_METERS of the group's anchor. Returns the densest few — the
// "systemic problem" signal Gemini highlights.
function findHotspots(clusters: ClusterRow[]): Hotspot[] {
  const hotspots: Hotspot[] = [];

  for (const category of CATEGORIES) {
    const members = clusters.filter((c) => c.category === category);
    const used = new Set<number>();

    for (let i = 0; i < members.length; i++) {
      if (used.has(i)) continue;
      const group = [members[i]];
      used.add(i);
      for (let j = i + 1; j < members.length; j++) {
        if (used.has(j)) continue;
        const d = haversineMeters(
          members[i].centroidLat,
          members[i].centroidLng,
          members[j].centroidLat,
          members[j].centroidLng,
        );
        if (d <= HOTSPOT_RADIUS_METERS) {
          group.push(members[j]);
          used.add(j);
        }
      }
      if (group.length >= 2) {
        hotspots.push({
          category,
          count: group.length,
          lat: avg(group.map((g) => g.centroidLat)),
          lng: avg(group.map((g) => g.centroidLng)),
          radiusMeters: HOTSPOT_RADIUS_METERS,
        });
      }
    }
  }

  // Densest first; keep it short for the prompt.
  return hotspots.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * The digest text + freshness metadata. Returns cached text when the stats signature is unchanged
 * and within TTL (so repeated dashboard loads don't re-spend a Gemini call). `force` bypasses the
 * cache read (the card's refresh button).
 */
export async function getDigest(force = false): Promise<{
  text: string;
  stats: DigestStats;
  generatedAt: number;
  cached: boolean;
}> {
  const stats = await computeDigestStats();

  // No data yet → a friendly static line, no Gemini call.
  if (stats.totalIssues === 0) {
    return {
      text: "No issues reported yet. As citizens submit reports, this digest will summarize what's happening and surface emerging hotspots.",
      stats,
      generatedAt: Date.now(),
      cached: false,
    };
  }

  const signature = JSON.stringify(stats); // deterministic numbers → stable signature
  if (
    !force &&
    cache &&
    cache.signature === signature &&
    Date.now() - cache.generatedAt < DIGEST_TTL_MS
  ) {
    return { text: cache.text, stats, generatedAt: cache.generatedAt, cached: true };
  }

  const text = await writeDigest(stats);
  cache = { signature, text, generatedAt: Date.now() };
  return { text, stats, generatedAt: cache.generatedAt, cached: false };
}

function zero<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>;
}

function avg(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}
