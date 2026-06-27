import { db, toDate, toDateOrNull } from "@/lib/firestore";
import type { Report } from "@/types/models";
import { randomUUID } from "crypto";

const REPORTS = "reports";

function docToReport(id: string, data: FirebaseFirestore.DocumentData): Report {
  return {
    id,
    category: data.category as string,
    severity: data.severity as string,
    description: data.description as string,
    department: data.department as string,
    complaintDraft: data.complaintDraft as string,
    isValid: data.isValid as boolean,
    imagePath: data.imagePath as string,
    lat: data.lat as number,
    lng: data.lng as number,
    embedding: data.embedding as string,
    createdAt: toDate(data.createdAt),
    userId: data.userId as string,
    clusterId: (data.clusterId as string | null | undefined) ?? null,
  };
}

export async function createReport(
  data: Omit<Report, "id" | "createdAt">,
): Promise<Report> {
  const id = randomUUID();
  const now = new Date();
  const doc = { ...data, createdAt: now };
  await db.collection(REPORTS).doc(id).set(doc);
  return { id, ...doc };
}

export async function findFirstReportByCluster(
  clusterId: string,
): Promise<Pick<Report, "imagePath"> | null> {
  // Single-field where only — composite index not needed. Sort createdAt in JS.
  const snap = await db.collection(REPORTS).where("clusterId", "==", clusterId).get();
  if (snap.empty) return null;
  const earliest = snap.docs.reduce((a, b) =>
    toDate(a.data().createdAt) <= toDate(b.data().createdAt) ? a : b,
  );
  return { imagePath: earliest.data().imagePath as string };
}

export async function hasUserReportedCluster(
  clusterId: string,
  userId: string,
): Promise<boolean> {
  const snap = await db
    .collection(REPORTS)
    .where("clusterId", "==", clusterId)
    .where("userId", "==", userId)
    .limit(1)
    .get();
  return !snap.empty;
}

/** Returns clusterId for each report the user filed in any of the given clusters. */
export async function findUserReportsForClusters(
  userId: string,
  clusterIds: string[],
): Promise<{ clusterId: string }[]> {
  if (clusterIds.length === 0) return [];
  // Single-field where only — filter by clusterIds in JS to avoid composite index.
  const snap = await db.collection(REPORTS).where("userId", "==", userId).get();
  const idSet = new Set(clusterIds);
  return snap.docs
    .map((doc) => ({ clusterId: doc.data().clusterId as string | null }))
    .filter((r): r is { clusterId: string } => r.clusterId !== null && idSet.has(r.clusterId));
}

/** Returns a user's reports newest-first, each including the cluster (if any). Used by profile page. */
export async function findReportsByUserWithClusters(
  userId: string,
): Promise<(Report & { cluster: import("@/types/models").Cluster | null })[]> {
  // Single-field where only — sort createdAt desc in JS to avoid composite index.
  const snap = await db.collection(REPORTS).where("userId", "==", userId).get();

  if (snap.empty) return [];

  const reports = snap.docs
    .map((doc) => docToReport(doc.id, doc.data()))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Batch-fetch distinct clusters.
  const clusterIds = [...new Set(reports.map((r) => r.clusterId).filter(Boolean) as string[])];
  const clusterMap = new Map<string, import("@/types/models").Cluster>();

  if (clusterIds.length > 0) {
    const clusterDocs = await db.getAll(
      ...clusterIds.map((cid) => db.collection("clusters").doc(cid)),
    );
    clusterDocs.forEach((doc) => {
      if (!doc.exists) return;
      const d = doc.data()!;
      clusterMap.set(doc.id, {
        id: doc.id,
        category: d.category as string,
        severity: d.severity as string,
        status: d.status as string,
        title: d.title as string,
        summary: d.summary as string,
        centroidLat: d.centroidLat as number,
        centroidLng: d.centroidLng as number,
        reportCount: d.reportCount as number,
        verifiedCount: (d.verifiedCount as number) ?? 0,
        createdAt: toDate(d.createdAt),
        updatedAt: toDate(d.updatedAt),
        resolutionImagePath: (d.resolutionImagePath as string | null) ?? null,
        resolutionConfidence: (d.resolutionConfidence as number | null) ?? null,
        resolutionReasoning: (d.resolutionReasoning as string | null) ?? null,
        resolvedAt: toDateOrNull(d.resolvedAt),
      });
    });
  }

  return reports.map((r) => ({
    ...r,
    cluster: r.clusterId ? (clusterMap.get(r.clusterId) ?? null) : null,
  }));
}

export async function deleteAllReports(): Promise<void> {
  const snap = await db.collection(REPORTS).get();
  if (snap.empty) return;
  // Batch delete in groups of 500 (Firestore batch limit).
  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = db.batch();
    snap.docs.slice(i, i + 500).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

export async function countAllReports(): Promise<number> {
  const snap = await db.collection(REPORTS).count().get();
  return snap.data().count;
}
