/**
 * Load/performance tests for clustering.
 *
 * These are intentionally slow relative to unit tests — run separately with:
 *   npx vitest run tests/load/
 *
 * Each benchmark has a generous budget that should be achievable even on slow CI.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { haversineMeters, cosineSimilarity, findBestCluster } from "@/lib/clustering";

// ---- Helpers ----

function randomVec(dim = 768): number[] {
  return Array.from({ length: dim }, () => Math.random() * 2 - 1);
}

function normalise(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

// ---- Benchmarks ----

describe("[LOAD] cosineSimilarity — 768-dim at scale", () => {
  const DIM = 768;
  const PAIRS = 10_000;
  const vectors = Array.from({ length: PAIRS * 2 }, () => normalise(randomVec(DIM)));

  it(`computes ${PAIRS} cosine similarity pairs in <300ms`, () => {
    const start = performance.now();
    for (let i = 0; i < PAIRS; i++) {
      cosineSimilarity(vectors[i * 2], vectors[i * 2 + 1]);
    }
    const elapsed = performance.now() - start;
    console.log(`  cosineSimilarity x${PAIRS}: ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(300);
  });
});

describe("[LOAD] haversineMeters — high-frequency geo calculations", () => {
  const ITERATIONS = 100_000;

  it(`computes ${ITERATIONS} haversine distances in <100ms`, () => {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      haversineMeters(12.97 + i * 0.000001, 77.59, 12.975, 77.595);
    }
    const elapsed = performance.now() - start;
    console.log(`  haversineMeters x${ITERATIONS}: ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(100);
  });
});

describe("[LOAD] findBestCluster — 500 clusters with 10 reports each", () => {
  // Mock Firestore to return a large synthetic dataset
  beforeAll(() => {
    vi.mock("@/lib/db/clusters", () => ({
      findClustersWithEmbeddingsByCategory: vi.fn(),
      findOpenClustersByCategory: vi.fn(),
      findClusterByIdOrThrow: vi.fn(),
      updateCluster: vi.fn(),
      createCluster: vi.fn(),
    }));
  });

  it("resolves within 500ms for 500 clusters × 10 reports", async () => {
    const { findClustersWithEmbeddingsByCategory } = await import("@/lib/db/clusters");

    // Build 500 clusters each with 10 report embeddings
    const clusters = Array.from({ length: 500 }, (_, i) => ({
      id: `cluster-${i}`,
      centroidLat: 12.97 + (i % 50) * 0.0003, // spread within ~15km
      centroidLng: 77.59 + Math.floor(i / 50) * 0.0003,
      reportCount: 10,
      category: "pothole",
      severity: "med" as const,
      status: "submitted",
      title: `Cluster ${i}`,
      summary: `Cluster ${i}`,
      verifiedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      resolutionImagePath: null,
      resolutionConfidence: null,
      resolutionReasoning: null,
      resolvedAt: null,
      reports: Array.from({ length: 10 }, () => ({
        embedding: JSON.stringify(normalise(randomVec(768))),
      })),
    }));

    vi.mocked(findClustersWithEmbeddingsByCategory).mockResolvedValue(clusters);

    const queryEmbedding = normalise(randomVec(768));

    const start = performance.now();
    await findBestCluster({
      category: "pothole",
      lat: 12.97,
      lng: 77.59,
      embedding: queryEmbedding,
    });
    const elapsed = performance.now() - start;

    console.log(`  findBestCluster (500 clusters × 10 reports): ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(500);
  });
});

describe("[LOAD] Pending store — burst of 1000 concurrent operations", () => {
  it("handles 1000 sequential puts and takes without error", async () => {
    const { putPending, takePending } = await import("@/lib/pending");

    const N = 1000;
    const start = performance.now();

    for (let i = 0; i < N; i++) {
      putPending(`load-${i}`, {
        userId: "user-load",
        imagePath: `/uploads/load-${i}.jpg`,
        category: "pothole",
        severity: "med",
        description: "Load test pothole",
        department: "Roads",
        embedding: Array(768).fill(0.1),
        lat: 12.97,
        lng: 77.59,
        createdAt: Date.now(),
      });
    }

    let hits = 0;
    for (let i = 0; i < N; i++) {
      if (takePending(`load-${i}`)) hits++;
    }

    const elapsed = performance.now() - start;
    console.log(`  Pending store 1000 put+take: ${elapsed.toFixed(1)}ms, hits: ${hits}`);

    expect(hits).toBe(N);
    expect(elapsed).toBeLessThan(200);
  });
});
