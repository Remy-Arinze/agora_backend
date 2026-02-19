/*
  Warnings:

  - A unique constraint covering the columns `[schoolId,code,schoolType]` on the table `Subject` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Subject_schoolId_code_key";

-- CreateTable
CREATE TABLE "CourseRegistration" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "semester" TEXT,
    "academicYear" TEXT NOT NULL,
    "termId" TEXT,
    "isCarryOver" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseRegistration_studentId_idx" ON "CourseRegistration"("studentId");

-- CreateIndex
CREATE INDEX "CourseRegistration_subjectId_idx" ON "CourseRegistration"("subjectId");

-- CreateIndex
CREATE INDEX "CourseRegistration_termId_idx" ON "CourseRegistration"("termId");

-- CreateIndex
CREATE INDEX "CourseRegistration_isActive_idx" ON "CourseRegistration"("isActive");

-- CreateIndex
CREATE INDEX "CourseRegistration_academicYear_idx" ON "CourseRegistration"("academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistration_studentId_subjectId_termId_key" ON "CourseRegistration"("studentId", "subjectId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_code_schoolType_key" ON "Subject"("schoolId", "code", "schoolType");

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
