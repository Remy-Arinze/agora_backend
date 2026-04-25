/*
  Warnings:

  - Added the required column `createdBy` to the `AgoraCurriculum` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AgoraCurriculum" ADD COLUMN     "createdBy" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "agoraSubjectId" TEXT,
ADD COLUMN     "isAgoraStandard" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Subject_agoraSubjectId_idx" ON "Subject"("agoraSubjectId");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_agoraSubjectId_fkey" FOREIGN KEY ("agoraSubjectId") REFERENCES "NerdcSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
