import { db, toDate, toDateOrNull } from "@/lib/firestore";
import type { Cluster, Report } from "@/types/models";
import { randomUUID } from "crypto";

const CLUSTERS = "clusters";
const REPORTS = "reports";

function docToCluster(id: string, data: FirebaseFirestore.DocumentData): Cluster {
  return {
    id,
    category: data.category as string,
    severity: data.severity as string,
    status: data.status as string,
    title: data.title as string,
    summary: data.summary as string,
    centroidLat: data.centroidLat as number,
    centroidLng: data.centroidLng as number,
    reportCount: data.reportCount as number,
    verifiedCount: (data.verifiedCount as number) ?? 0,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    resolutionImagePath: (data.resolutionImagePath as string | null) ?? null,
    resolutionConfidence: (data.resolutionConfidence as number | null) ?? null,
    resolutionReasoning: (data.resolutionReasoning as string | null) ?? null,
    resolvedAt: toDateOrNull(data.resolvedAt),
  };
}

export async function getAllClusters(): Promise<Cluster[]> {
  const snap = await db.collection(CLUSTERS).get();
  return snap.docs.map((doc) => docToCluster(doc.id, doc.data()));
}

export async function getAllClustersByUpdatedAt(): Promise<Cluster[]> {
  const snap = await db.collection(CLUSTERS).orderBy("updatedAt", "desc").get();
  return snap.docs.map((doc) => docToCluster(doc.id, doc.data()));
}

export async function findClusterById(id: string): Promise<Cluster | null> {
  const doc = await db.collection(CLUSTERS).doc(id).get();
  if (!doc.exists) return null;
  return docToCluster(doc.id, doc.data()!);
}

export async function findClusterByIdOrThrow(id: string): Promise<Cluster> {
  const cluster = await findClusterById(id);
  if (!cluster) throw new Error(`Cluster ${id} not found`);
  return cluster;
}

export type ClusterCreateInput = Omit<Cluster, "id" | "createdAt" | "updatedAt" | "verifiedCount">;

export async function createCluster(data: ClusterCreateInput): Promise<Cluster> {
  const id = randomUUID();
  const now = new Date();
  const doc = { ...data, verifiedCount: 0, createdAt: now, updatedAt: now };
  await db.collection(CLUSTERS).doc(id).set(doc);
  return { id, ...doc };
}

export async function updateCluster(
  id: string,
  data: Partial<Omit<Cluster, "id" | "createdAt">>,
): Promise<Cluster> {
  const updateData = { ...data, updatedAt: new Date() };
  await db.collection(CLUSTERS).doc(id).update(updateData);
  return findClusterByIdOrThrow(id);
}

/**
 * Returns clusters of the given category, each augmented with their reports' embeddings.
 * Used by findBestCluster in lib/clustering.ts for the dedup similarity check.
 */
export async function findClustersWithEmbeddingsByCategory(
  category: string,
): Promise<(Cluster & { reports: { embedding: string }[] })[]> {
  const clustersSnap = await db
    .collection(CLUSTERS)
    .where("category", "==", category)
    .get();

  if (clustersSnap.empty) return [];

  const clusters = clustersSnap.docs.map((doc) => docToCluster(doc.id, doc.data()));
  const clusterIds = clusters.map((c) => c.id);

  // Fetch embeddings for all member reports (IN supports up to 30 items; demo-safe).
  const embeddingMap = new Map<string, { embedding: string }[]>();
  clusters.forEach((c) => embeddingMap.set(c.id, []));

  for (let i = 0; i < clusterIds.length; i += 30) {
    const batch = clusterIds.slice(i, i + 30);
    const reportsSnap = await db
      .collection(REPORTS)
      .where("clusterId", "in", batch)
      .get();
    for (const doc of reportsSnap.docs) {
      const d = doc.data();
      const list = embeddingMap.get(d.clusterId as string);
      if (list) list.push({ embedding: d.embedding as string });
    }
  }

  return clusters.map((c) => ({ ...c, reports: embeddingMap.get(c.id) ?? [] }));
}

/**
 * Returns open (non-resolved) clusters of the given category with just the geo fields.
 * Used by findNearbyOpenCluster in lib/clustering.ts for the F1 resolution suggestion.
 */
export async function findOpenClustersByCategory(
  category: string,
): Promise<Pick<Cluster, "id" | "centroidLat" | "centroidLng" | "reportCount">[]> {
  // Single-field where only — filter status in JS to avoid composite index.
  const snap = await db.collection(CLUSTERS).where("category", "==", category).get();
  return snap.docs
    .filter((doc) => doc.data().status !== "resolved")
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        centroidLat: d.centroidLat as number,
        centroidLng: d.centroidLng as number,
        reportCount: d.reportCount as number,
      };
    });
}

/**
 * Returns the cluster plus the imagePath of its earliest report.
 * Used by the F1 resolve route to load the "before" photo.
 */
export async function findClusterWithFirstReport(
  id: string,
): Promise<(Cluster & { reports: { imagePath: string }[] }) | null> {
  const cluster = await findClusterById(id);
  if (!cluster) return null;

  // Single-field where only — find earliest by createdAt in JS to avoid composite index.
  const reportsSnap = await db.collection(REPORTS).where("clusterId", "==", id).get();
  const reports: { imagePath: string }[] = [];
  if (!reportsSnap.empty) {
    const earliest = reportsSnap.docs.reduce((a, b) =>
      toDate(a.data().createdAt) <= toDate(b.data().createdAt) ? a : b,
    );
    reports.push({ imagePath: earliest.data().imagePath as string });
  }

  return { ...cluster, reports };
}

/**
 * Filters clusters by optional category and/or status. Used by the dashboard page.
 * Capped at DASHBOARD_LIMIT to prevent shipping thousands of rows to the browser.
 */
const DASHBOARD_LIMIT = 200;

export async function findClustersWithFilter(filter: {
  category?: string;
  status?: string;
}): Promise<Cluster[]> {
  let query: FirebaseFirestore.Query = db.collection(CLUSTERS);
  if (filter.category) query = query.where("category", "==", filter.category);
  if (filter.status) query = query.where("status", "==", filter.status);
  query = query.limit(DASHBOARD_LIMIT);
  const snap = await query.get();
  return snap.docs.map((doc) => docToCluster(doc.id, doc.data()));
}

/**
 * Returns the cluster with all its reports (newest first) plus each report's user name.
 * Used by the issue-detail page.
 */
export async function findClusterWithReportsAndUsers(
  id: string,
): Promise<(Cluster & { reports: (Pick<Report, "id" | "imagePath" | "description" | "lat" | "lng" | "complaintDraft" | "department" | "severity"> & { user: { name: string } })[] }) | null> {
  const cluster = await findClusterById(id);
  if (!cluster) return null;

  const reportsSnap = await db
    .collection(REPORTS)
    .where("clusterId", "==", id)
    .get();

  // Sort newest-first in JS — avoids a composite index on (clusterId, createdAt DESC)
  // which Firestore requires at the DB level. Consistent with the project pattern.
  reportsSnap.docs.sort((a, b) => {
    const ta = toDate(a.data().createdAt).getTime();
    const tb = toDate(b.data().createdAt).getTime();
    return tb - ta;
  });


  if (reportsSnap.empty) return { ...cluster, reports: [] };

  // Batch-fetch users for all report userIds (de-duplicated).
  const userIds = [...new Set(reportsSnap.docs.map((d) => d.data().userId as string))];
  const userDocs = await db.getAll(...userIds.map((uid) => db.collection("users").doc(uid)));
  const nameById = new Map<string, string>();
  userDocs.forEach((doc) => {
    if (doc.exists) nameById.set(doc.id, doc.data()!.name as string);
  });

  const reports = reportsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      imagePath: d.imagePath as string,
      description: d.description as string,
      department: d.department as string,
      complaintDraft: d.complaintDraft as string,
      severity: d.severity as string,
      lat: d.lat as number,
      lng: d.lng as number,
      user: { name: nameById.get(d.userId as string) ?? "Unknown" },
    };
  });

  return { ...cluster, reports };
}

export async function deleteAllClusters(): Promise<void> {
  const snap = await db.collection(CLUSTERS).get();
  if (snap.empty) return;
  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = db.batch();
    snap.docs.slice(i, i + 500).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

export async function countClusters(): Promise<number> {
  const snap = await db.collection(CLUSTERS).count().get();
  return snap.data().count;
}
