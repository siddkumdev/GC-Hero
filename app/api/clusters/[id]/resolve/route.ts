import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { findClusterWithFirstReport, updateCluster } from "@/lib/db/clusters";
import { getCurrentUser } from "@/lib/session";
import { verifyResolution, GeminiOverloadedError } from "@/lib/gemini";
import { UPLOAD_DIR, EXT_BY_MIME, readUploadAsBase64 } from "@/lib/images";
import {
  CATEGORY_LABELS,
  RESOLUTION_CONFIDENCE_THRESHOLD,
  type Category,
} from "@/lib/config";
import type { ResolveResultDTO } from "@/lib/types";

export const runtime = "nodejs";

// F1 — before/after resolution verification. ONE shared server path for both the manual
// ("Upload resolution photo" on the issue page) and the auto ("Yes, check it" suggestion in the
// report flow) entrypoints. Both POST a multipart "after" photo here. Gemini compares it against
// the cluster's ORIGINAL report photo; if it confidently judges the issue fixed we flip the
// cluster to "resolved". Never flips below the confidence threshold.
// Migrated from Prisma — 2026-06-24
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;

  const cluster = await findClusterWithFirstReport(id);
  if (!cluster) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }
  const originalImagePath = cluster.reports[0]?.imagePath;
  if (!originalImagePath) {
    return NextResponse.json(
      { error: "This issue has no original photo to compare against." },
      { status: 400 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No resolution photo uploaded." }, { status: 400 });
  }

  const mimeType = file.type || "image/jpeg";
  const afterBytes = Buffer.from(await file.arrayBuffer());

  let before;
  try {
    before = await readUploadAsBase64(originalImagePath);
  } catch {
    return NextResponse.json(
      { error: "Couldn't load the original photo for comparison." },
      { status: 500 },
    );
  }

  let verdict;
  try {
    verdict = await verifyResolution(
      before,
      { base64: afterBytes.toString("base64"), mimeType },
      {
        categoryLabel: CATEGORY_LABELS[cluster.category as Category] ?? cluster.category,
        description: cluster.summary,
      },
    );
  } catch (err) {
    if (err instanceof GeminiOverloadedError) {
      return NextResponse.json({ error: err.message, retryable: true }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed." },
      { status: 502 },
    );
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = EXT_BY_MIME[mimeType] ?? "jpg";
  const fileName = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), afterBytes);
  const afterImagePath = `/uploads/${fileName}`;

  const shouldResolve =
    verdict.is_resolved && verdict.confidence >= RESOLUTION_CONFIDENCE_THRESHOLD;

  if (shouldResolve) {
    await updateCluster(cluster.id, {
      status: "resolved",
      resolutionImagePath: afterImagePath,
      resolutionConfidence: verdict.confidence,
      resolutionReasoning: verdict.reasoning,
      resolvedAt: new Date(),
    });
  }

  const payload: ResolveResultDTO = {
    isResolved: verdict.is_resolved,
    confidence: verdict.confidence,
    reasoning: verdict.reasoning,
    statusChanged: shouldResolve,
    status: shouldResolve ? "resolved" : cluster.status,
    afterImagePath,
  };

  return NextResponse.json(payload, { status: 200 });
}
