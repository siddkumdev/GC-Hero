/**
 * Integration tests for POST /api/reports/confirm
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Stubs ----

vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/pending", () => ({
  takePending: vi.fn(),
}));

vi.mock("@/lib/clustering", () => ({
  resolveCluster: vi.fn(),
}));

vi.mock("@/lib/db/reports", () => ({
  createReport: vi.fn(),
}));

vi.mock("@/lib/db/clusters", () => ({
  findClusterByIdOrThrow: vi.fn(),
  updateCluster: vi.fn(),
}));

vi.mock("@/lib/db/verifications", () => ({
  deleteVerification: vi.fn(),
}));

vi.mock("server-only", () => ({}));

import { getCurrentUser } from "@/lib/session";
import { takePending } from "@/lib/pending";
import { resolveCluster } from "@/lib/clustering";
import { createReport } from "@/lib/db/reports";
import { findClusterByIdOrThrow, updateCluster } from "@/lib/db/clusters";
import { deleteVerification } from "@/lib/db/verifications";

import { POST } from "@/app/api/reports/confirm/route";

// ---- Helpers ----

function makeUser(id = "user-1") {
  return { id, name: "Alice", email: "alice@test.com", createdAt: new Date() };
}

function makePending(userId = "user-1") {
  return {
    userId,
    imagePath: "/uploads/test.jpg",
    category: "pothole" as const,
    severity: "med" as const,
    description: "A pothole",
    department: "Public Works",
    embedding: Array(768).fill(0.1),
    lat: 12.97,
    lng: 77.59,
    createdAt: Date.now(),
  };
}

function makeResolution(isNew = true) {
  return {
    clusterId: "cluster-xyz",
    isNew,
    previousCount: isNew ? 0 : 3,
    reportCount: isNew ? 1 : 4,
    matchedSimilarity: isNew ? null : 0.88,
  };
}

function buildRequest(body: object) {
  return new Request("http://localhost/api/reports/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---- Tests ----

describe("POST /api/reports/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(makeUser());
    vi.mocked(takePending).mockReturnValue(makePending());
    vi.mocked(resolveCluster).mockResolvedValue(makeResolution(true));
    vi.mocked(createReport).mockResolvedValue({} as any);
    vi.mocked(deleteVerification).mockResolvedValue(false);
  });

  it("returns 401 when not signed in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await POST(buildRequest({ analysisId: "id-1", complaintDraft: "text" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing analysisId", async () => {
    const res = await POST(buildRequest({ complaintDraft: "text" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty complaint text", async () => {
    const res = await POST(buildRequest({ analysisId: "id-1", complaintDraft: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for whitespace-only complaint", async () => {
    const res = await POST(buildRequest({ analysisId: "id-1", complaintDraft: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 410 when analysis is expired", async () => {
    vi.mocked(takePending).mockReturnValue(null);
    const res = await POST(buildRequest({ analysisId: "expired", complaintDraft: "text" }));
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.expired).toBe(true);
  });

  it("returns 403 when analysis belongs to a different user", async () => {
    vi.mocked(takePending).mockReturnValue(makePending("user-other"));
    const res = await POST(buildRequest({ analysisId: "id-1", complaintDraft: "text" }));
    expect(res.status).toBe(403);
  });

  it("returns 201 with payload on success (new cluster)", async () => {
    const res = await POST(buildRequest({ analysisId: "id-1", complaintDraft: "Fix it please." }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.clusterId).toBe("cluster-xyz");
    expect(json.isNew).toBe(true);
    expect(json.reportCount).toBe(1);
  });

  it("returns 201 and drops verification when user already verified (existing cluster)", async () => {
    vi.mocked(resolveCluster).mockResolvedValue(makeResolution(false));
    vi.mocked(deleteVerification).mockResolvedValue(true);
    vi.mocked(findClusterByIdOrThrow).mockResolvedValue({
      id: "cluster-xyz",
      verifiedCount: 2,
      category: "pothole",
      severity: "med",
      status: "submitted",
      title: "test",
      summary: "test",
      centroidLat: 12.97,
      centroidLng: 77.59,
      reportCount: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
      resolutionImagePath: null,
      resolutionConfidence: null,
      resolutionReasoning: null,
      resolvedAt: null,
    } as any);

    const res = await POST(buildRequest({ analysisId: "id-1", complaintDraft: "Fix it please." }));
    expect(res.status).toBe(201);
    expect(updateCluster).toHaveBeenCalledWith("cluster-xyz", expect.objectContaining({
      verifiedCount: 1,
    }));
  });

  it("handles malformed JSON body gracefully", async () => {
    const req = new Request("http://localhost/api/reports/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not valid json ",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("calls createReport with correct fields", async () => {
    await POST(buildRequest({ analysisId: "id-1", complaintDraft: "Please fix this." }));
    expect(createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "pothole",
        severity: "med",
        userId: "user-1",
        clusterId: "cluster-xyz",
      }),
    );
  });
});
