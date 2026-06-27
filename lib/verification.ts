import { hasUserReportedCluster, findUserReportsForClusters } from "@/lib/db/reports";
import {
  createVerificationAtomic,
  findVerificationsForUserInClusters,
  VerificationAlreadyExistsError,
  VerificationClusterNotFoundError,
} from "@/lib/db/verifications";
import type { ConfirmState, VerifyResultDTO } from "@/lib/types";

// SYSTEM LAYER — F4 community verification ("I see this too"). No Gemini: this is pure
// crowd-sourced credibility. A citizen corroborates an issue either by FILING a report (the
// "auto" path — clustering already groups N reports) or by a lightweight one-tap CONFIRM (the
// "manual" path). The two sets are kept disjoint so nobody is counted twice:
//
//   credibility = reportCount (distinct reporters) + verifiedCount (confirmers who never reported)
//
// "One per user per issue" is enforced by the deterministic verification document ID
// (${clusterId}_${userId}) in Firestore, replacing the old Prisma unique constraint.
// Migrated from Prisma — 2026-06-24

export class AlreadyCorroboratedError extends Error {
  constructor(public state: Exclude<ConfirmState, "can">) {
    super(
      state === "reported"
        ? "You've already reported this issue."
        : "You've already confirmed this issue.",
    );
    this.name = "AlreadyCorroboratedError";
  }
}

export class ClusterNotFoundError extends Error {
  constructor() {
    super("Issue not found.");
    this.name = "ClusterNotFoundError";
  }
}

/**
 * Record a one-tap "I see this too" for the current user. Idempotent at the persona level:
 * a citizen who already reported OR already verified the issue can't inflate the count.
 */
export async function recordVerification(
  clusterId: string,
  userId: string,
): Promise<VerifyResultDTO> {
  if (await hasUserReportedCluster(clusterId, userId)) {
    throw new AlreadyCorroboratedError("reported");
  }

  try {
    const updated = await createVerificationAtomic(clusterId, userId);
    return {
      verifiedCount: updated.verifiedCount,
      reportCount: updated.reportCount,
      credibility: updated.reportCount + updated.verifiedCount,
      state: "verified",
    };
  } catch (err) {
    if (err instanceof VerificationClusterNotFoundError) throw new ClusterNotFoundError();
    if (err instanceof VerificationAlreadyExistsError) throw new AlreadyCorroboratedError("verified");
    throw err;
  }
}

/**
 * The current user's relationship to a set of clusters, for rendering the button state on first
 * paint (issue detail + every map popup) without an N+1. Returns a map id -> ConfirmState; ids
 * the user hasn't touched are omitted (treat as "can").
 */
export async function confirmStatesFor(
  userId: string,
  clusterIds: string[],
): Promise<Record<string, ConfirmState>> {
  if (clusterIds.length === 0) return {};

  const [reports, verifications] = await Promise.all([
    findUserReportsForClusters(userId, clusterIds),
    findVerificationsForUserInClusters(userId, clusterIds),
  ]);

  const states: Record<string, ConfirmState> = {};
  // Reported wins over verified (the two are disjoint in practice, but be deterministic).
  for (const v of verifications) states[v.clusterId] = "verified";
  for (const r of reports) if (r.clusterId) states[r.clusterId] = "reported";
  return states;
}
