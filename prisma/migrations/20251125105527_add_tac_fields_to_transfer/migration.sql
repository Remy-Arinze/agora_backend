/*
  Warnings:

  - A unique constraint covering the columns `[tac]` on the table `Transfer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "TransferStatus" ADD VALUE 'COMPLETED';

-- DropForeignKey
ALTER TABLE "Transfer" DROP CONSTRAINT "Transfer_toSchoolId_fkey";

-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "tac" TEXT,
ADD COLUMN     "tacExpiresAt" TIMESTAMP(3),
ADD COLUMN     "tacGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "tacUsedAt" TIMESTAMP(3),
ADD COLUMN     "tacUsedBy" TEXT,
ALTER COLUMN "toSchoolId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_tac_key" ON "Transfer"("tac");

-- CreateIndex
CREATE INDEX "Transfer_tac_idx" ON "Transfer"("tac");

-- CreateIndex
CREATE INDEX "Transfer_tacExpiresAt_idx" ON "Transfer"("tacExpiresAt");

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toSchoolId_fkey" FOREIGN KEY ("toSchoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
