/*
  Warnings:

  - A unique constraint covering the columns `[examSessionToken]` on the table `AssessmentSubmission` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "autoSubmitOnTimeout" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "hasIntegrity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTimed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pointsPerViolation" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "violationThreshold" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "AssessmentSubmission" ADD COLUMN     "examSessionToken" TEXT,
ADD COLUMN     "isAutoSubmitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFlagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pointDeductions" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "violationCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AssessmentViolation" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentViolation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentViolation_submissionId_idx" ON "AssessmentViolation"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSubmission_examSessionToken_key" ON "AssessmentSubmission"("examSessionToken");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_examSessionToken_idx" ON "AssessmentSubmission"("examSessionToken");

-- AddForeignKey
ALTER TABLE "AssessmentViolation" ADD CONSTRAINT "AssessmentViolation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssessmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
