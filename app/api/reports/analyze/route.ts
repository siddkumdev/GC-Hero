import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/session";
import {
  analyzeIssueImage,
  embedText,
  draftComplaint,
  GeminiOverloadedError,
} from "@/lib/gemini";
import { findBestCluster, findNearbyOpenCluster } from "@/lib/clustering";
import { putPending } from "@/lib/pending";
import { UPLOAD_DIR, EXT_BY_MIME } from "@/lib/images";
import { CLUSTER_RADIUS_METERS, type Category, type Severity } from "@/lib/config";
import type { AnalyzeResultDTO } from "@/lib/types";

export const runtime = "nodejs";

// Maximum accepted upload size: 8 MB. Larger files are rejected early to
// protect memory and Gemini throughput (base64 expansion = ~33% overhead).
const MAX_FILE_BYTES = 8 * 1024 * 1024;

// PHASE 1 of the report flow. Runs the perception layer (Gemini vision → embedding →
// complaint draft) and a READ-ONLY clustering preview, then stashes the result server-side
// keyed by an analysisId. Nothing is committed to the DB; /confirm finalizes after the
// user reviews and (optionally) edits the drafted complaint.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  const rawLat = form?.get("lat");
  const rawLng = form?.get("lng");
  // Reject if the field is absent (null) or not a string, not just if it's non-finite.
  // Number(null)===0 which would silently accept missing coords as the null island (0,0).
  const lat = typeof rawLat === "string" && rawLat.trim() !== "" ? Number(rawLat) : NaN;
  const lng = typeof rawLng === "string" && rawLng.trim() !== "" ? Number(rawLng) : NaN;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `Image too large. Maximum accepted size is 8 MB (received ${(file.size / 1024 / 1024).toFixed(1)} MB).` },
      { status: 400 },
    );
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "Missing or invalid location." },
      { status: 400 },
    );
  }

  const mimeType = file.type || "image/jpeg";
  const bytes = Buffer.from(await file.arrayBuffer());
  const base64 = bytes.toString("base64");

  // --- Perception (Gemini vision) ---
  let analysis;
  try {
    analysis = await analyzeIssueImage(base64, mimeType);
  } catch (err) {
    if (err instanceof GeminiOverloadedError) {
      return NextResponse.json({ error: err.message, retryable: true }, { status: 503 });
    }
    return NextResponse.json({ error: errorMessage(err) }, { status: 502 });
  }

  // Graceful reject: not a civic issue → store nothing (no image saved).
  if (!analysis.is_valid_issue) {
    return NextResponse.json(
      {
        rejected: true,
        reason:
          "This photo doesn't look like a civic issue we can act on. Please upload a clear photo of a pothole, leak, broken streetlight, or garbage.",
      },
      { status: 422 },
    );
  }

  const category = analysis.category as Category;
  const severity = analysis.severity as Severity;
  const approxLocation = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  // Embedding + complaint draft (Gemini), in parallel.
  let embedding: number[];
  let complaintDraft: string;
  try {
    [embedding, complaintDraft] = await Promise.all([
      embedText(analysis.description),
      draftComplaint({
        category,
        severity,
        description: analysis.description,
        department: analysis.department,
        reporterName: user.name,
        approxLocation,
      }),
    ]);
  } catch (err) {
    if (err instanceof GeminiOverloadedError) {
      return NextResponse.json({ error: err.message, retryable: true }, { status: 503 });
    }
    return NextResponse.json({ error: errorMessage(err) }, { status: 502 });
  }

  // Persist the image now that it's validated (so the reveal can show it back).
  let imagePath: string;
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = EXT_BY_MIME[mimeType] ?? "jpg";
    const fileName = `${randomUUID()}.${ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, fileName), bytes);
    imagePath = `/uploads/${fileName}`;
  } catch (err) {
    console.error("[analyze] Failed to persist image:", err);
    return NextResponse.json({ error: "Failed to save the uploaded image. Please try again." }, { status: 500 });
  }

  // READ-ONLY clustering preview: "we found N similar within Xm" before we commit.
  // Wrapped in try/catch — a Firestore error here must not fail the whole analysis.
  let match = null;
  let resolutionCandidate = null;
  try {
    match = await findBestCluster({ category, lat, lng, embedding });
    // F1 auto-path (READ-ONLY): is there a nearby OPEN issue of this category that the dedup did
    // NOT match as a duplicate? If so, this photo may be an "after" shot of it — offer a gentle,
    // dismissible "is this resolved?" suggestion. The actual check only runs on explicit confirm.
    resolutionCandidate = await findNearbyOpenCluster(
      { category, lat, lng },
      match?.clusterId,
    );
  } catch (err) {
    // Non-fatal: clustering preview failing should not block the report flow.
    console.warn("[analyze] Clustering preview failed (non-fatal):", err);
  }

  const analysisId = randomUUID();
  putPending(analysisId, {
    userId: user.id,
    imagePath,
    category,
    severity,
    description: analysis.description,
    department: analysis.department,
    embedding,
    lat,
    lng,
    createdAt: Date.now(),
  });

  const payload: AnalyzeResultDTO = {
    analysisId,
    imagePath,
    category,
    severity,
    severityReason: analysis.severity_reason,
    department: analysis.department,
    description: analysis.description,
    complaintDraft,
    clusterPreview: {
      matched: Boolean(match),
      clusterId: match?.clusterId ?? null,
      currentCount: match?.reportCount ?? 0,
      similarity: match?.similarity ?? null,
      distanceMeters: match?.distanceMeters ?? null,
      radiusMeters: CLUSTER_RADIUS_METERS,
    },
    resolutionSuggestion: resolutionCandidate
      ? {
          clusterId: resolutionCandidate.clusterId,
          currentCount: resolutionCandidate.reportCount,
          distanceMeters: Math.round(resolutionCandidate.distanceMeters),
        }
      : null,
  };

  return NextResponse.json(payload, { status: 200 });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected server error.";
}
