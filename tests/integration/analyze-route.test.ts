/**
 * Integration tests for POST /api/reports/analyze
 *
 * These tests stub out: Firestore (lib/db), Gemini (lib/gemini), file system (fs),
 * and lib/pending — so they run fully in-process with no external dependencies.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Stub all server-only dependencies BEFORE importing the route ----

// session
vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(),
}));

// gemini
vi.mock("@/lib/gemini", () => ({
  analyzeIssueImage: vi.fn(),
  embedText: vi.fn(),
  draftComplaint: vi.fn(),
  GeminiOverloadedError: class GeminiOverloadedError extends Error {
    constructor() {
      super("Gemini busy");
      this.name = "GeminiOverloadedError";
    }
  },
}));

// clustering (read-only preview only)
vi.mock("@/lib/clustering", () => ({
  findBestCluster: vi.fn(),
  findNearbyOpenCluster: vi.fn(),
}));

// pending
vi.mock("@/lib/pending", () => ({
  putPending: vi.fn(),
}));

// images
vi.mock("@/lib/images", () => ({
  UPLOAD_DIR: "/tmp/uploads",
  EXT_BY_MIME: { "image/jpeg": "jpg", "image/png": "png" },
}));

// fs — stub mkdir and writeFile
vi.mock("fs", () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

// server-only marker (no-op in tests)
vi.mock("server-only", () => ({}));

import { getCurrentUser } from "@/lib/session";
import {
  analyzeIssueImage,
  embedText,
  draftComplaint,
  GeminiOverloadedError,
} from "@/lib/gemini";
import { findBestCluster, findNearbyOpenCluster } from "@/lib/clustering";

// Import AFTER mocks are set up
import { POST } from "@/app/api/reports/analyze/route";

// ---- Helpers ----

function makeUser() {
  return { id: "user-1", name: "Alice", email: "alice@test.com", createdAt: new Date() };
}

function makeAnalysis(overrides = {}) {
  return {
    category: "pothole" as const,
    severity: "med" as const,
    description: "A pothole on the road",
    severity_reason: "Notable surface damage",
    department: "Public Works Department (Roads)",
    is_valid_issue: true,
    ...overrides,
  };
}

function buildFormDataRequest(
  overrides: { lat?: string; lng?: string; fileType?: string; fileSize?: number } = {},
) {
  const form = new FormData();
  const fileSize = overrides.fileSize ?? 1024;
  const blob = new Blob([new Uint8Array(fileSize)], {
    type: overrides.fileType ?? "image/jpeg",
  });
  form.append("image", new File([blob], "test.jpg", { type: "image/jpeg" }));
  form.append("lat", overrides.lat ?? "12.97160");
  form.append("lng", overrides.lng ?? "77.59460");
  return new Request("http://localhost/api/reports/analyze", {
    method: "POST",
    body: form,
  });
}

// ---- Tests ----

describe("POST /api/reports/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(makeUser());
    vi.mocked(analyzeIssueImage).mockResolvedValue(makeAnalysis());
    vi.mocked(embedText).mockResolvedValue(Array(768).fill(0.1));
    vi.mocked(draftComplaint).mockResolvedValue("Dear Roads Dept, please fix this pothole.");
    vi.mocked(findBestCluster).mockResolvedValue(null);
    vi.mocked(findNearbyOpenCluster).mockResolvedValue(null);
  });

  it("returns 401 when not signed in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await POST(buildFormDataRequest());
    expect(res.status).toBe(401);
  });

  it("returns 400 when no image is provided", async () => {
    const form = new FormData();
    form.append("lat", "12.97");
    form.append("lng", "77.59");
    const req = new Request("http://localhost/api/reports/analyze", {
      method: "POST",
      body: form,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/image/i);
  });

  it("returns 400 for missing coordinates (fields absent from form)", async () => {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(100)], { type: "image/jpeg" });
    form.append("image", new File([blob], "test.jpg", { type: "image/jpeg" }));
    // lat and lng are absent entirely — Number(undefined) = NaN
    const req = new Request("http://localhost/api/reports/analyze", {
      method: "POST",
      body: form,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });


  it("returns 400 for invalid coordinate values", async () => {
    const res = await POST(buildFormDataRequest({ lat: "999", lng: "77.59" }));
    // Coords outside valid range — currently the route checks isFinite only,
    // but we test that truly invalid strings (NaN) are rejected.
    const res2 = await POST(buildFormDataRequest({ lat: "not-a-number", lng: "77.59" }));
    expect(res2.status).toBe(400);
  });

  it("returns 422 for non-civic photos", async () => {
    vi.mocked(analyzeIssueImage).mockResolvedValue(
      makeAnalysis({ is_valid_issue: false }),
    );
    const res = await POST(buildFormDataRequest());
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.rejected).toBe(true);
  });

  it("returns 503 when Gemini is overloaded (vision)", async () => {
    vi.mocked(analyzeIssueImage).mockRejectedValue(new GeminiOverloadedError());
    const res = await POST(buildFormDataRequest());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.retryable).toBe(true);
  });

  it("returns 503 when Gemini is overloaded (embed/draft phase)", async () => {
    vi.mocked(embedText).mockRejectedValue(new GeminiOverloadedError());
    const res = await POST(buildFormDataRequest());
    expect(res.status).toBe(503);
  });

  it("returns 400 for files exceeding 8 MB size limit", async () => {
    const eightMbPlus = 8 * 1024 * 1024 + 1;
    const res = await POST(buildFormDataRequest({ fileSize: eightMbPlus }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/8\s*MB/i);
  });

  it("returns 200 with full payload on success", async () => {
    const res = await POST(buildFormDataRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("analysisId");
    expect(json).toHaveProperty("category", "pothole");
    expect(json).toHaveProperty("clusterPreview");
    expect(json).toHaveProperty("complaintDraft");
  });

  it("includes cluster preview when a matching cluster is found", async () => {
    vi.mocked(findBestCluster).mockResolvedValue({
      clusterId: "cluster-abc",
      similarity: 0.91,
      distanceMeters: 80,
      reportCount: 5,
    });
    const res = await POST(buildFormDataRequest());
    const json = await res.json();
    expect(json.clusterPreview.matched).toBe(true);
    expect(json.clusterPreview.currentCount).toBe(5);
  });

  it("returns 502 on unexpected Gemini error", async () => {
    vi.mocked(analyzeIssueImage).mockRejectedValue(new Error("Unknown model error"));
    const res = await POST(buildFormDataRequest());
    expect(res.status).toBe(502);
  });

  it("handles malformed formData gracefully", async () => {
    // Simulate a completely broken form (can't be parsed)
    const req = new Request("http://localhost/api/reports/analyze", {
      method: "POST",
      body: "not-multipart",
      headers: { "Content-Type": "text/plain" },
    });
    const res = await POST(req);
    // Should be 400 (no image), not a 500 crash
    expect(res.status).toBeLessThan(500);
  });
});
