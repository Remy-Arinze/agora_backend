/*
  Warnings:

  - A unique constraint covering the columns `[termId,classId,dayOfWeek,startTime]` on the table `TimetablePeriod` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "TimetablePeriod" ADD COLUMN     "classId" TEXT,
ADD COLUMN     "courseId" TEXT,
ALTER COLUMN "classArmId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "TimetablePeriod_classId_idx" ON "TimetablePeriod"("classId");

-- CreateIndex
CREATE INDEX "TimetablePeriod_subjectId_idx" ON "TimetablePeriod"("subjectId");

-- CreateIndex
CREATE INDEX "TimetablePeriod_courseId_idx" ON "TimetablePeriod"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetablePeriod_termId_classId_dayOfWeek_startTime_key" ON "TimetablePeriod"("termId", "classId", "dayOfWeek", "startTime");

-- AddForeignKey
ALTER TABLE "TimetablePeriod" ADD CONSTRAINT "TimetablePeriod_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetablePeriod" ADD CONSTRAINT "TimetablePeriod_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
