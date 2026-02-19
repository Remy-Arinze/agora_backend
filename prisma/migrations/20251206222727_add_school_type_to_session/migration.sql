/*
  Warnings:

  - A unique constraint covering the columns `[schoolId,name,schoolType]` on the table `AcademicSession` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AcademicSession" ADD COLUMN     "schoolType" TEXT;

-- CreateIndex
CREATE INDEX "AcademicSession_schoolType_idx" ON "AcademicSession"("schoolType");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicSession_schoolId_name_schoolType_key" ON "AcademicSession"("schoolId", "name", "schoolType");
