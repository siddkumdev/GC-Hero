// TypeScript interfaces matching the old Prisma models exactly.
// Used by lib/db/* so API routes and lib/* see the same shapes they did before.

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface Cluster {
  id: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  centroidLat: number;
  centroidLng: number;
  reportCount: number;
  verifiedCount: number;
  createdAt: Date;
  updatedAt: Date;
  resolutionImagePath?: string | null;
  resolutionConfidence?: number | null;
  resolutionReasoning?: string | null;
  resolvedAt?: Date | null;
}

export interface Report {
  id: string;
  category: string;
  severity: string;
  description: string;
  department: string;
  complaintDraft: string;
  isValid: boolean;
  imagePath: string;
  lat: number;
  lng: number;
  embedding: string; // JSON-stringified number[]
  createdAt: Date;
  userId: string;
  clusterId?: string | null;
}

export interface Verification {
  id: string;
  createdAt: Date;
  userId: string;
  clusterId: string;
}
