import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { putPending, takePending } from "@/lib/pending";
import type { PendingAnalysis } from "@/lib/pending";

// ---------------------------------------------------------------------------
// pending.ts — in-memory TTL store for two-phase report flow
// ---------------------------------------------------------------------------

// The module is imported once and the Map is shared across tests.
// We reset via fake timers + real time to control TTL behaviour.

const BASE_TS = Date.now();

function makePending(overrides: Partial<PendingAnalysis> = {}): PendingAnalysis {
  return {
    userId: "user-1",
    imagePath: "/uploads/test.jpg",
    category: "pothole",
    severity: "med",
    description: "A pothole",
    department: "Roads",
    embedding: [0.1, 0.2],
    lat: 12.97,
    lng: 77.59,
    createdAt: BASE_TS,
    ...overrides,
  };
}

// Use unique IDs per test to avoid state bleed between tests.
let idCounter = 0;
function uid(prefix = "id") {
  return `${prefix}-${++idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

describe("pending store", () => {
  it("stores and retrieves an analysis", () => {
    const id = uid();
    putPending(id, makePending());
    const out = takePending(id);
    expect(out).not.toBeNull();
    expect(out?.userId).toBe("user-1");
  });

  it("returns null for a missing id", () => {
    expect(takePending("nonexistent-id-xyz")).toBeNull();
  });

  it("is single-use — second take returns null", () => {
    const id = uid();
    putPending(id, makePending());
    takePending(id);
    expect(takePending(id)).toBeNull();
  });

  it("sweeps entries older than TTL on write", () => {
    const expiredId = uid("exp");
    const freshId = uid("fresh");
    // Plant an entry with a createdAt 11 minutes ago
    const expired = makePending({ createdAt: Date.now() - 11 * 60 * 1000 });
    putPending(expiredId, expired);

    // Trigger a sweep by writing another entry (sweep runs on every put)
    putPending(freshId, makePending());

    // The expired entry should have been swept
    expect(takePending(expiredId)).toBeNull();
    // The fresh entry should still be there
    expect(takePending(freshId)).not.toBeNull();
  });

  it("does not expire entries younger than TTL", () => {
    const youngId = uid("young");
    const young = makePending({ createdAt: Date.now() - 9 * 60 * 1000 });
    putPending(youngId, young);

    // Trigger a sweep
    putPending(uid("trigger"), makePending());

    expect(takePending(youngId)).not.toBeNull();
  });

  it("handles burst of 500 concurrent puts without error", () => {
    const ids = Array.from({ length: 500 }, () => uid("burst"));
    for (const id of ids) {
      putPending(id, makePending());
    }
    let hits = 0;
    for (const id of ids) {
      if (takePending(id)) hits++;
    }
    expect(hits).toBe(500);
  });

  it("evicts oldest entries when store exceeds MAX_STORE_SIZE (500)", () => {
    // Fill the store well past the cap (600 entries)
    const firstIds = Array.from({ length: 300 }, () => uid("old"));
    const oldTs = Date.now() - 60_000; // 1 minute old
    for (const id of firstIds) {
      putPending(id, makePending({ createdAt: oldTs }));
    }
    const newIds = Array.from({ length: 300 }, () => uid("new"));
    for (const id of newIds) {
      putPending(id, makePending({ createdAt: Date.now() }));
    }
    // At this point we have 600 items. After the next put (which triggers sweep+cap),
    // the store must be at most 500.
    putPending(uid("cap-trigger"), makePending());

    // Count how many of the oldest entries survive — some should have been evicted
    const oldSurvivors = firstIds.filter((id) => {
      const p = takePending(id);
      return p !== null;
    }).length;
    const newSurvivors = newIds.filter((id) => {
      const p = takePending(id);
      return p !== null;
    }).length;

    // Total should not exceed 501 (500 cap + the cap-trigger we just took)
    expect(oldSurvivors + newSurvivors).toBeLessThanOrEqual(501);
    // Newer entries should have been preferred over older ones during eviction
    expect(newSurvivors).toBeGreaterThanOrEqual(oldSurvivors);
  });
});
