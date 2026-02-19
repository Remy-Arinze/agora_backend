-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "schoolType" TEXT;

-- CreateIndex
CREATE INDEX "Event_schoolType_idx" ON "Event"("schoolType");
