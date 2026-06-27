-- AlterTable
ALTER TABLE "Cluster" ADD COLUMN "resolutionConfidence" REAL;
ALTER TABLE "Cluster" ADD COLUMN "resolutionImagePath" TEXT;
ALTER TABLE "Cluster" ADD COLUMN "resolutionReasoning" TEXT;
ALTER TABLE "Cluster" ADD COLUMN "resolvedAt" DATETIME;
