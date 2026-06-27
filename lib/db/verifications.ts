import { db, toDate } from "@/lib/firestore";
import type { Verification } from "@/types/models";

const VERIFICATIONS = "verifications";
const CLUSTERS = "clusters";

// Deterministic document ID enforces the unique (clusterId, userId) constraint at the storage layer.
function verDocId(clusterId: string, userId: string): string {
  return `${clusterId}_${userId}`;
}

function docToVerification(id: string, data: FirebaseFirestore.DocumentData): Verification {
  return {
    id,
    clusterId: data.clusterId as string,
    userId: data.userId as string,
    createdAt: toDate(data.createdAt),
  };
}

export class VerificationAlreadyExistsError extends Error {
  constructor() {
    super("Already verified");
    this.name = "VerificationAlreadyExistsError";
  }
}

export class VerificationClusterNotFoundError extends Error {
  constructor() {
    super("Cluster not found");
    this.name = "VerificationClusterNotFoundError";
  }
}

/**
 * Atomically creates the verification and increments cluster.verifiedCount.
 * Throws VerificationAlreadyExistsError if the (clusterId, userId) pair already exists.
 * Throws VerificationClusterNotFoundError if the cluster doesn't exist.
 * Returns updated { reportCount, verifiedCount }.
 */
export async function createVerificationAtomic(
  clusterId: string,
  userId: string,
): Promise<{ reportCount: number; verifiedCount: number }> {
  const verRef = db.collection(VERIFICATIONS).doc(verDocId(clusterId, userId));
  const clusterRef = db.collection(CLUSTERS).doc(clusterId);

  return db.runTransaction(async (tx) => {
    const [verDoc, clusterDoc] = await Promise.all([tx.get(verRef), tx.get(clusterRef)]);

    if (!clusterDoc.exists) throw new VerificationClusterNotFoundError();
    if (verDoc.exists) throw new VerificationAlreadyExistsError();

    const d = clusterDoc.data()!;
    const newVerifiedCount = ((d.verifiedCount as number) ?? 0) + 1;

    tx.set(verRef, { clusterId, userId, createdAt: new Date() });
    tx.update(clusterRef, { verifiedCount: newVerifiedCount, updatedAt: new Date() });

    return {
      reportCount: d.reportCount as number,
      verifiedCount: newVerifiedCount,
    };
  });
}

/**
 * Deletes the verification for a (clusterId, userId) pair.
 * Returns true if it existed and was deleted, false if it didn't exist.
 */
export async function deleteVerification(
  clusterId: string,
  userId: string,
): Promise<boolean> {
  const ref = db.collection(VERIFICATIONS).doc(verDocId(clusterId, userId));
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.delete();
  return true;
}

/**
 * Returns clusterId for each verification the user has in any of the given clusters.
 * Used by confirmStatesFor to build the button-state map without N+1.
 */
export async function findVerificationsForUserInClusters(
  userId: string,
  clusterIds: string[],
): Promise<{ clusterId: string }[]> {
  if (clusterIds.length === 0) return [];
  // Fetch by deterministic IDs — O(N) reads but no composite index needed.
  const refs = clusterIds.map((cid) =>
    db.collection(VERIFICATIONS).doc(verDocId(cid, userId)),
  );
  const docs = await db.getAll(...refs);
  return docs
    .filter((doc) => doc.exists)
    .map((doc) => ({ clusterId: doc.data()!.clusterId as string }));
}

export async function deleteAllVerifications(): Promise<void> {
  const snap = await db.collection(VERIFICATIONS).get();
  if (snap.empty) return;
  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = db.batch();
    snap.docs.slice(i, i + 500).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

export async function createVerification(
  clusterId: string,
  userId: string,
): Promise<Verification> {
  const id = verDocId(clusterId, userId);
  const now = new Date();
  await db.collection(VERIFICATIONS).doc(id).set({ clusterId, userId, createdAt: now });
  return { id, clusterId, userId, createdAt: now };
}
