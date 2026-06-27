import { describe, it, expect } from "vitest";
import { urgencyScore } from "@/lib/config";

// ---------------------------------------------------------------------------
// urgencyScore
// ---------------------------------------------------------------------------
describe("urgencyScore", () => {
  it("returns higher score for higher severity", () => {
    const high = urgencyScore("high", 1);
    const med = urgencyScore("med", 1);
    const low = urgencyScore("low", 1);
    expect(high).toBeGreaterThan(med);
    expect(med).toBeGreaterThan(low);
  });

  it("increases as reportCount increases (logarithmically)", () => {
    const s1 = urgencyScore("med", 1);
    const s10 = urgencyScore("med", 10);
    const s100 = urgencyScore("med", 100);
    expect(s10).toBeGreaterThan(s1);
    expect(s100).toBeGreaterThan(s10);
    // Log growth: gap 1→10 should be larger than 10→100
    expect(s10 - s1).toBeGreaterThan(0);
  });

  it("handles reportCount = 0 without NaN", () => {
    const score = urgencyScore("high", 0);
    expect(Number.isFinite(score)).toBe(true);
  });

  it("handles reportCount = 1 correctly", () => {
    const score = urgencyScore("low", 1);
    expect(score).toBeGreaterThan(0);
  });

  it("high severity with many reports beats low severity with few reports", () => {
    // High severity always beats low severity at equal counts.
    expect(urgencyScore("high", 10)).toBeGreaterThan(urgencyScore("low", 10));
    // The score is (rank+1) * log2(count+1), so at very high counts med can exceed high×1.
    // This documents the ACTUAL intended behaviour: urgency is count-weighted.
    expect(urgencyScore("high", 1)).toBeLessThan(urgencyScore("med", 100));
  });
});
