import { NextResponse } from "next/server";
import { getAllClustersByUpdatedAt } from "@/lib/db/clusters";
import { urgencyScore, type Severity } from "@/lib/config";

export const runtime = "nodejs";

// The report submission pipeline is split into two phases so the AI work is visible:
//   POST /api/reports/analyze  → Gemini reads the photo + previews clustering (no DB write)
//   POST /api/reports/confirm  → files the reviewed complaint + runs clustering for real
// This route keeps the read side: clusters for the dashboard/map, ordered by urgency.
// Migrated from Prisma — 2026-06-24
export async function GET() {
  const clusters = await getAllClustersByUpdatedAt();
  const withUrgency = clusters
    .map((c) => ({
      ...c,
      urgency: urgencyScore(c.severity as Severity, c.reportCount),
    }))
    .sort((a, b) => b.urgency - a.urgency);
  return NextResponse.json({ clusters: withUrgency });
}
