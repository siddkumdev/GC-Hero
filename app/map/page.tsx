import { getAllClusters } from "@/lib/db/clusters";
import MapClient from "@/components/MapClient";
import { getCurrentUser } from "@/lib/session";
import { confirmStatesFor } from "@/lib/verification";

export const dynamic = "force-dynamic";

// Map of tracked issues (one pin per de-duplicated cluster).
export default async function MapPage() {
  // Migrated from Prisma — 2026-06-24
  const clusters = await getAllClusters();

  // F4 — the current citizen's confirm state per cluster, so each popup's "I see this too"
  // button renders correctly without an N+1 (one batched query for the whole map).
  const user = await getCurrentUser();
  const states = user
    ? await confirmStatesFor(user.id, clusters.map((c) => c.id))
    : {};

  const mapClusters = clusters.map((c) => ({
    id: c.id,
    centroidLat: c.centroidLat,
    centroidLng: c.centroidLng,
    category: c.category,
    severity: c.severity,
    status: c.status,
    summary: c.summary,
    reportCount: c.reportCount,
    verifiedCount: c.verifiedCount,
    confirmState: states[c.id] ?? "can",
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="cv-eyebrow">GCHeros</span>
        <h1 className="text-2xl">Issues map</h1>
        <p className="text-sm" style={{ color: "var(--c-muted)" }}>
          One pin per tracked issue · color shows severity, number shows reports.
        </p>
      </div>
      {mapClusters.length === 0 && (
        <div
          className="cv-card p-8 text-center text-sm"
          style={{ color: "var(--c-muted)" }}
        >
          No issues to show yet. Pins appear here once issues are reported.
        </div>
      )}
      <div className="cv-elevated p-1.5 overflow-hidden">
        <MapClient clusters={mapClusters} />
      </div>
    </div>
  );
}
