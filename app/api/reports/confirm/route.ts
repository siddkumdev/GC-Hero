import { NextResponse } from "next/server";
import { createReport } from "@/lib/db/reports";
import { findClusterByIdOrThrow, updateCluster } from "@/lib/db/clusters";
import { deleteVerification } from "@/lib/db/verifications";
import { getCurrentUser } from "@/lib/session";
import { resolveCluster } from "@/lib/clustering";
import { takePending } from "@/lib/pending";
import { CATEGORY_LABELS } from "@/lib/config";
import type { ConfirmResultDTO } from "@/lib/types";

export const runtime = "nodejs";

// PHASE 2 of the report flow. Takes the analysisId from /analyze plus the (possibly edited)
// complaint text, runs the SYSTEM LAYER for real — duplicate clustering — and persists the
// Report. Returns before/after counts so the client can animate the cluster growing.
// Migrated from Prisma — 2026-06-24
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const analysisId = typeof body?.analysisId === "string" ? body.analysisId : "";
  const complaintDraft =
    typeof body?.complaintDraft === "string" ? body.complaintDraft.trim() : "";

  if (!analysisId || !complaintDraft) {
    return NextResponse.json(
      { error: "Missing analysis or complaint text." },
      { status: 400 },
    );
  }

  const pending = takePending(analysisId);
  if (!pending) {
    return NextResponse.json(
      {
        error:
          "This analysis expired. Please re-submit the photo to analyze it again.",
        expired: true,
      },
      { status: 410 },
    );
  }
  if (pending.userId !== user.id) {
    return NextResponse.json({ error: "Not your analysis." }, { status: 403 });
  }

  const approxLocation = `${pending.lat.toFixed(5)}, ${pending.lng.toFixed(5)}`;

  const resolution = await resolveCluster({
    category: pending.category,
    severity: pending.severity,
    lat: pending.lat,
    lng: pending.lng,
    embedding: pending.embedding,
    title: `${CATEGORY_LABELS[pending.category]} near ${approxLocation}`,
    summary: pending.description,
  });

  await createReport({
    category: pending.category,
    severity: pending.severity,
    description: pending.description,
    department: pending.department,
    complaintDraft,
    isValid: true,
    imagePath: pending.imagePath,
    lat: pending.lat,
    lng: pending.lng,
    embedding: JSON.stringify(pending.embedding),
    userId: user.id,
    clusterId: resolution.clusterId,
  });

  // F4 — if this citizen had only "I see this too"-confirmed this issue before, their full report
  // now supersedes that lightweight signal. Drop the verification + decrement verifiedCount so
  // credibility (reportCount + verifiedCount) never counts the same person twice.
  if (!resolution.isNew) {
    const wasVerified = await deleteVerification(resolution.clusterId, user.id);
    if (wasVerified) {
      const current = await findClusterByIdOrThrow(resolution.clusterId);
      await updateCluster(resolution.clusterId, {
        verifiedCount: Math.max(0, current.verifiedCount - 1),
      });
    }
  }

  const payload: ConfirmResultDTO = {
    clusterId: resolution.clusterId,
    isNew: resolution.isNew,
    previousCount: resolution.previousCount,
    reportCount: resolution.reportCount,
    matchedSimilarity: resolution.matchedSimilarity,
  };

  return NextResponse.json(payload, { status: 201 });
}
