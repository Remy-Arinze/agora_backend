/*
  Warnings:

  - Added the required column `gradeType` to the `Grade` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GradeType" AS ENUM ('CA', 'ASSIGNMENT', 'EXAM');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "syncStatus" TEXT,
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "assessmentDate" TIMESTAMP(3),
ADD COLUMN     "assessmentName" TEXT,
ADD COLUMN     "gradeType" "GradeType" NOT NULL,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sequence" INTEGER;

-- CreateTable
CREATE TABLE "Curriculum" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subject" TEXT,
    "teacherId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "termId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Curriculum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumItem" (
    "id" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "objectives" TEXT[],
    "resources" TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarSync" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "googleCalendarId" TEXT NOT NULL DEFAULT 'primary',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "syncDirection" TEXT NOT NULL DEFAULT 'ONE_WAY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Curriculum_classId_idx" ON "Curriculum"("classId");

-- CreateIndex
CREATE INDEX "Curriculum_teacherId_idx" ON "Curriculum"("teacherId");

-- CreateIndex
CREATE INDEX "Curriculum_academicYear_idx" ON "Curriculum"("academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "Curriculum_classId_subject_academicYear_termId_key" ON "Curriculum"("classId", "subject", "academicYear", "termId");

-- CreateIndex
CREATE INDEX "CurriculumItem_curriculumId_idx" ON "CurriculumItem"("curriculumId");

-- CreateIndex
CREATE INDEX "CurriculumItem_week_idx" ON "CurriculumItem"("week");

-- CreateIndex
CREATE INDEX "CurriculumItem_order_idx" ON "CurriculumItem"("order");

-- CreateIndex
CREATE INDEX "GoogleCalendarSync_userId_idx" ON "GoogleCalendarSync"("userId");

-- CreateIndex
CREATE INDEX "GoogleCalendarSync_schoolId_idx" ON "GoogleCalendarSync"("schoolId");

-- CreateIndex
CREATE INDEX "GoogleCalendarSync_syncEnabled_idx" ON "GoogleCalendarSync"("syncEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarSync_userId_schoolId_key" ON "GoogleCalendarSync"("userId", "schoolId");

-- CreateIndex
CREATE INDEX "Event_googleEventId_idx" ON "Event"("googleEventId");

-- CreateIndex
CREATE INDEX "Event_syncStatus_idx" ON "Event"("syncStatus");

-- CreateIndex
CREATE INDEX "Grade_gradeType_idx" ON "Grade"("gradeType");

-- CreateIndex
CREATE INDEX "Grade_assessmentDate_idx" ON "Grade"("assessmentDate");

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumItem" ADD CONSTRAINT "CurriculumItem_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarSync" ADD CONSTRAINT "GoogleCalendarSync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarSync" ADD CONSTRAINT "GoogleCalendarSync_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
