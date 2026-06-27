import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { haversineMeters, cosineSimilarity, findBestCluster } from "@/lib/clustering";

// ---------------------------------------------------------------------------
// haversineMeters
// ---------------------------------------------------------------------------
describe("haversineMeters", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineMeters(12.97, 77.59, 12.97, 77.59)).toBe(0);
  });

  it("computes ~111km per degree of latitude near the equator", () => {
    const d = haversineMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("handles antipodal points (~20015 km)", () => {
    const d = haversineMeters(0, 0, 0, 180);
    expect(d).toBeGreaterThan(20_000_000);
  });

  it("is symmetric", () => {
    const d1 = haversineMeters(12.97, 77.59, 13.01, 77.62);
    const d2 = haversineMeters(13.01, 77.62, 12.97, 77.59);
    expect(d1).toBeCloseTo(d2, 2);
  });

  it("handles negative coordinates correctly", () => {
    const d = haversineMeters(-33.87, 151.21, -33.87, 151.22); // ~878m
    expect(d).toBeGreaterThan(800);
    expect(d).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// cosineSimilarity
// ---------------------------------------------------------------------------
describe("cosineSimilarity", () => {
  it("returns 1 for identical non-zero vectors", () => {
    const v = [0.5, 0.5, 0.7071];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it("returns 0 for zero-length input", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("returns 0 if either vector is all zeros", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([1, 1], [0, 0])).toBe(0);
  });

  it("handles 768-dim vectors efficiently", () => {
    const a = Array.from({ length: 768 }, () => Math.random());
    const b = Array.from({ length: 768 }, () => Math.random());
    const result = cosineSimilarity(a, b);
    expect(result).toBeGreaterThanOrEqual(-1);
    expect(result).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// findBestCluster (with mocked Firestore)
// ---------------------------------------------------------------------------
vi.mock("@/lib/db/clusters", () => ({
  findClustersWithEmbeddingsByCategory: vi.fn(),
  findOpenClustersByCategory: vi.fn(),
  findClusterByIdOrThrow: vi.fn(),
  updateCluster: vi.fn(),
  createCluster: vi.fn(),
}));

import { findClustersWithEmbeddingsByCategory } from "@/lib/db/clusters";

describe("findBestCluster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no clusters exist", async () => {
    vi.mocked(findClustersWithEmbeddingsByCategory).mockResolvedValue([]);
    const result = await findBestCluster({
      category: "pothole",
      lat: 12.97,
      lng: 77.59,
      embedding: [0.5, 0.5],
    });
    expect(result).toBeNull();
  });

  it("returns null when all clusters exceed radius", async () => {
    vi.mocked(findClustersWithEmbeddingsByCategory).mockResolvedValue([
      {
        id: "far-cluster",
        centroidLat: 15.0, // >150km away
        centroidLng: 77.59,
        reportCount: 3,
        category: "pothole",
        severity: "med",
        status: "submitted",
        title: "test",
        summary: "far away",
        verifiedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolutionImagePath: null,
        resolutionConfidence: null,
        resolutionReasoning: null,
        resolvedAt: null,
        reports: [{ embedding: JSON.stringify([0.5, 0.5]) }],
      },
    ]);

    const result = await findBestCluster({
      category: "pothole",
      lat: 12.97,
      lng: 77.59,
      embedding: [0.5, 0.5],
    });
    expect(result).toBeNull();
  });

  it("picks the cluster with highest similarity within radius", async () => {
    const lowSim = JSON.stringify([1, 0]);      // cosine=0 with query
    const highSim = JSON.stringify([0.9, 0.1]); // cosine≈0.994 with [1,0] query

    vi.mocked(findClustersWithEmbeddingsByCategory).mockResolvedValue([
      {
        id: "cluster-a",
        centroidLat: 12.97001,
        centroidLng: 77.59001, // ~15m away
        reportCount: 1,
        category: "pothole",
        severity: "med",
        status: "submitted",
        title: "a",
        summary: "a",
        verifiedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolutionImagePath: null,
        resolutionConfidence: null,
        resolutionReasoning: null,
        resolvedAt: null,
        reports: [{ embedding: lowSim }],
      },
      {
        id: "cluster-b",
        centroidLat: 12.97002,
        centroidLng: 77.59002, // ~30m away
        reportCount: 5,
        category: "pothole",
        severity: "high",
        status: "submitted",
        title: "b",
        summary: "b",
        verifiedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolutionImagePath: null,
        resolutionConfidence: null,
        resolutionReasoning: null,
        resolvedAt: null,
        reports: [{ embedding: highSim }],
      },
    ]);

    const result = await findBestCluster({
      category: "pothole",
      lat: 12.97,
      lng: 77.59,
      embedding: [0.9, 0.1], // similar to cluster-b
    });
    expect(result?.clusterId).toBe("cluster-b");
  });

  it("ignores corrupted embedding JSON", async () => {
    vi.mocked(findClustersWithEmbeddingsByCategory).mockResolvedValue([
      {
        id: "bad-cluster",
        centroidLat: 12.97001,
        centroidLng: 77.59001,
        reportCount: 1,
        category: "pothole",
        severity: "med",
        status: "submitted",
        title: "bad",
        summary: "bad",
        verifiedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolutionImagePath: null,
        resolutionConfidence: null,
        resolutionReasoning: null,
        resolvedAt: null,
        reports: [{ embedding: "not-valid-json{{" }],
      },
    ]);

    const result = await findBestCluster({
      category: "pothole",
      lat: 12.97,
      lng: 77.59,
      embedding: [1, 0],
    });
    expect(result).toBeNull();
  });
});
