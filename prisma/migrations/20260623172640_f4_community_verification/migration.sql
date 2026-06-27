-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    CONSTRAINT "Verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Verification_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cluster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "centroidLat" REAL NOT NULL,
    "centroidLng" REAL NOT NULL,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resolutionImagePath" TEXT,
    "resolutionConfidence" REAL,
    "resolutionReasoning" TEXT,
    "resolvedAt" DATETIME,
    "verifiedCount" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Cluster" ("category", "centroidLat", "centroidLng", "createdAt", "id", "reportCount", "resolutionConfidence", "resolutionImagePath", "resolutionReasoning", "resolvedAt", "severity", "status", "summary", "title", "updatedAt") SELECT "category", "centroidLat", "centroidLng", "createdAt", "id", "reportCount", "resolutionConfidence", "resolutionImagePath", "resolutionReasoning", "resolvedAt", "severity", "status", "summary", "title", "updatedAt" FROM "Cluster";
DROP TABLE "Cluster";
ALTER TABLE "new_Cluster" RENAME TO "Cluster";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Verification_userId_idx" ON "Verification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_clusterId_userId_key" ON "Verification"("clusterId", "userId");
