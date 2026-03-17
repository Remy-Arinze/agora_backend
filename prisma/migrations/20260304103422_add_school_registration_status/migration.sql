-- AlterTable
ALTER TABLE "School" ADD COLUMN     "registrationNote" TEXT,
ADD COLUMN     "registrationStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- CreateIndex
CREATE INDEX "School_registrationStatus_idx" ON "School"("registrationStatus");
