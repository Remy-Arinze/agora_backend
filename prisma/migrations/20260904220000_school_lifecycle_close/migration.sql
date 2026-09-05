-- AlterTable
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "lifecycleStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "deactivationReason" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "deactivationRequestedAt" TIMESTAMP(3);
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "deactivatesAt" TIMESTAMP(3);
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "deactivationRequestedByUserId" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "deactivationRequestedByRole" TEXT;

CREATE INDEX IF NOT EXISTS "School_lifecycleStatus_idx" ON "School"("lifecycleStatus");
CREATE INDEX IF NOT EXISTS "School_deactivatesAt_idx" ON "School"("deactivatesAt");

UPDATE "School" SET "lifecycleStatus" = 'DEACTIVATED' WHERE "isActive" = false AND "lifecycleStatus" = 'ACTIVE';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TransferKind" AS ENUM ('NORMAL', 'SCHOOL_CLOSURE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Transfer" ADD COLUMN IF NOT EXISTS "kind" "TransferKind" NOT NULL DEFAULT 'NORMAL';
