/*
  Warnings:

  - A unique constraint covering the columns `[curriculumId,term,weekNumber]` on the table `AgoraCurriculumTopic` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "AgoraCurriculumTopic_curriculumId_weekNumber_key";

-- AlterTable
ALTER TABLE "AgoraCurriculumTopic" ADD COLUMN     "term" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "AgoraCurriculumTopic_term_idx" ON "AgoraCurriculumTopic"("term");

-- CreateIndex
CREATE UNIQUE INDEX "AgoraCurriculumTopic_curriculumId_term_weekNumber_key" ON "AgoraCurriculumTopic"("curriculumId", "term", "weekNumber");
