/*
  Warnings:

  - The values [STARTER,PROFESSIONAL,ENTERPRISE] on the enum `SubscriptionTier` will be removed. If these variants are still used in the database, this will fail.
  - The values [PARENT] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[classLevelId,name,academicYear]` on the table `ClassArm` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[classArmId,subjectId,sessionId]` on the table `ClassTeacher` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[classId,classArmId,teacherId,subject]` on the table `ClassTeacher` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[schoolId,classLevelId,subjectId,termId]` on the table `Curriculum` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[schoolId,classId,subjectId,termId]` on the table `Curriculum` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[curriculumId,weekNumber]` on the table `CurriculumItem` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `weekNumber` to the `CurriculumItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ErrorSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ErrorStatus" AS ENUM ('UNRESOLVED', 'INVESTIGATING', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "CurriculumStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WeekStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PermissionResource" ADD VALUE 'GRADES';
ALTER TYPE "PermissionResource" ADD VALUE 'CURRICULUM';
ALTER TYPE "PermissionResource" ADD VALUE 'RESOURCES';
ALTER TYPE "PermissionResource" ADD VALUE 'TRANSFERS';
ALTER TYPE "PermissionResource" ADD VALUE 'INTEGRATIONS';

-- CreateTable (moved before AlterEnum that references it)
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "tierCode" "SubscriptionTier" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "yearlyPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "features" JSONB,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "cta" TEXT NOT NULL DEFAULT 'Upgrade',
    "accent" TEXT NOT NULL DEFAULT 'blue',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "customSchoolId" TEXT,
    "maxStudents" INTEGER NOT NULL DEFAULT -1,
    "maxTeachers" INTEGER NOT NULL DEFAULT -1,
    "maxAdmins" INTEGER NOT NULL DEFAULT -1,
    "aiCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionTier_new" AS ENUM ('FREE', 'PRO', 'PRO_PLUS', 'CUSTOM');
ALTER TABLE "Subscription" ALTER COLUMN "tier" DROP DEFAULT;
ALTER TABLE "SubscriptionPlan" ALTER COLUMN "tierCode" TYPE "SubscriptionTier_new" USING ("tierCode"::text::"SubscriptionTier_new");
ALTER TABLE "Subscription" ALTER COLUMN "tier" TYPE "SubscriptionTier_new" USING ("tier"::text::"SubscriptionTier_new");
ALTER TYPE "SubscriptionTier" RENAME TO "SubscriptionTier_old";
ALTER TYPE "SubscriptionTier_new" RENAME TO "SubscriptionTier";
DROP TYPE "SubscriptionTier_old";
ALTER TABLE "Subscription" ALTER COLUMN "tier" SET DEFAULT 'FREE';
ALTER TABLE "SubscriptionPlan" ALTER COLUMN "tierCode" SET DEFAULT 'FREE';
COMMIT;



-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Curriculum" DROP CONSTRAINT "Curriculum_teacherId_fkey";

-- DropIndex
DROP INDEX "ClassArm_classLevelId_name_key";

-- DropIndex
DROP INDEX "ClassTeacher_classId_teacherId_subject_key";

-- DropIndex
DROP INDEX "Curriculum_classId_subject_academicYear_termId_key";

-- DropIndex
DROP INDEX "CurriculumItem_week_idx";

-- AlterTable
ALTER TABLE "ClassArm" ADD COLUMN     "academicYear" TEXT NOT NULL DEFAULT '2024/2025',
ADD COLUMN     "classTeacherId" TEXT;

-- AlterTable
ALTER TABLE "ClassLevel" ADD COLUMN     "description" TEXT,
ADD COLUMN     "facultyId" TEXT,
ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "ClassResource" ADD COLUMN     "classArmId" TEXT,
ALTER COLUMN "classId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ClassTeacher" ADD COLUMN     "classArmId" TEXT,
ADD COLUMN     "isFormTeacher" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "subjectId" TEXT,
ALTER COLUMN "classId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Curriculum" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "classLevelId" TEXT,
ADD COLUMN     "customizations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isNerdcBased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nerdcCurriculumId" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "schoolId" TEXT,
ADD COLUMN     "status" "CurriculumStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ALTER COLUMN "classId" DROP NOT NULL,
ALTER COLUMN "teacherId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CurriculumItem" ADD COLUMN     "activities" TEXT[],
ADD COLUMN     "assessment" TEXT,
ADD COLUMN     "completedBy" TEXT,
ADD COLUMN     "isCustomized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalTopic" TEXT,
ADD COLUMN     "status" "WeekStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "subTopics" TEXT[],
ADD COLUMN     "taughtAt" TIMESTAMP(3),
ADD COLUMN     "teacherNotes" TEXT,
ADD COLUMN     "weekNumber" INTEGER NOT NULL,
ALTER COLUMN "week" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "subjectId" TEXT;

-- AlterTable
ALTER TABLE "SchoolAdmin" ADD COLUMN     "schoolType" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "planId" TEXT,
ALTER COLUMN "maxAdmins" SET DEFAULT 10;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "schoolType" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;

-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "schoolId" TEXT NOT NULL,
    "deanId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT,
    "schoolType" TEXT,
    "name" TEXT NOT NULL,
    "gradeType" "GradeType" NOT NULL,
    "maxScore" DECIMAL(65,30) NOT NULL DEFAULT 100,
    "weight" DECIMAL(65,30),
    "sequence" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolProfileEditToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolProfileEditToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolProfileEditTokenAudit" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolProfileEditTokenAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationError" (
    "id" TEXT NOT NULL,
    "errorId" TEXT NOT NULL,
    "schoolId" TEXT,
    "userId" TEXT,
    "errorType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stackTrace" TEXT,
    "context" JSONB,
    "severity" "ErrorSeverity" NOT NULL,
    "status" "ErrorStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "otpCode" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NerdcSubject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT,
    "schoolTypes" TEXT[],
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NerdcSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NerdcCurriculum" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classLevel" TEXT NOT NULL,
    "term" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NerdcCurriculum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NerdcCurriculumWeek" (
    "id" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "subTopics" TEXT[],
    "objectives" TEXT[],
    "activities" TEXT[],
    "resources" TEXT[],
    "assessment" TEXT,
    "duration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NerdcCurriculumWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumItemProgress" (
    "id" TEXT NOT NULL,
    "curriculumItemId" TEXT NOT NULL,
    "classArmId" TEXT,
    "classId" TEXT,
    "teacherId" TEXT NOT NULL,
    "status" "WeekStatus" NOT NULL DEFAULT 'PENDING',
    "taughtAt" TIMESTAMP(3),
    "teacherNotes" TEXT,
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumItemProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT,
    "classArmId" TEXT,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3),
    "maxScore" DECIMAL(65,30) NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentQuestion" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" JSONB,
    "correctAnswer" TEXT,
    "points" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentSubmission" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "totalScore" DECIMAL(65,30),
    "teacherFeedback" TEXT,
    "aiFeedback" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "AssessmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT,
    "selectedOption" TEXT,
    "score" DECIMAL(65,30),
    "isCorrect" BOOLEAN,
    "aiFeedback" TEXT,
    "teacherFeedback" TEXT,
    "gradedBy" TEXT NOT NULL DEFAULT 'AUTO',

    CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Faculty_schoolId_idx" ON "Faculty"("schoolId");

-- CreateIndex
CREATE INDEX "Faculty_isActive_idx" ON "Faculty"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_schoolId_code_key" ON "Faculty"("schoolId", "code");

-- CreateIndex
CREATE INDEX "AssessmentTemplate_schoolId_idx" ON "AssessmentTemplate"("schoolId");

-- CreateIndex
CREATE INDEX "AssessmentTemplate_subjectId_idx" ON "AssessmentTemplate"("subjectId");

-- CreateIndex
CREATE INDEX "AssessmentTemplate_schoolType_idx" ON "AssessmentTemplate"("schoolType");

-- CreateIndex
CREATE INDEX "AssessmentTemplate_gradeType_idx" ON "AssessmentTemplate"("gradeType");

-- CreateIndex
CREATE INDEX "AssessmentTemplate_isActive_idx" ON "AssessmentTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentTemplate_schoolId_name_subjectId_schoolType_grade_key" ON "AssessmentTemplate"("schoolId", "name", "subjectId", "schoolType", "gradeType");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolProfileEditToken_token_key" ON "SchoolProfileEditToken"("token");

-- CreateIndex
CREATE INDEX "SchoolProfileEditToken_schoolId_idx" ON "SchoolProfileEditToken"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolProfileEditToken_token_idx" ON "SchoolProfileEditToken"("token");

-- CreateIndex
CREATE INDEX "SchoolProfileEditToken_expiresAt_idx" ON "SchoolProfileEditToken"("expiresAt");

-- CreateIndex
CREATE INDEX "SchoolProfileEditTokenAudit_token_idx" ON "SchoolProfileEditTokenAudit"("token");

-- CreateIndex
CREATE INDEX "SchoolProfileEditTokenAudit_schoolId_idx" ON "SchoolProfileEditTokenAudit"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolProfileEditTokenAudit_userId_idx" ON "SchoolProfileEditTokenAudit"("userId");

-- CreateIndex
CREATE INDEX "SchoolProfileEditTokenAudit_event_idx" ON "SchoolProfileEditTokenAudit"("event");

-- CreateIndex
CREATE INDEX "SchoolProfileEditTokenAudit_createdAt_idx" ON "SchoolProfileEditTokenAudit"("createdAt");

-- CreateIndex
CREATE INDEX "SchoolProfileEditTokenAudit_ipAddress_idx" ON "SchoolProfileEditTokenAudit"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationError_errorId_key" ON "ApplicationError"("errorId");

-- CreateIndex
CREATE INDEX "ApplicationError_schoolId_idx" ON "ApplicationError"("schoolId");

-- CreateIndex
CREATE INDEX "ApplicationError_errorType_idx" ON "ApplicationError"("errorType");

-- CreateIndex
CREATE INDEX "ApplicationError_severity_idx" ON "ApplicationError"("severity");

-- CreateIndex
CREATE INDEX "ApplicationError_status_idx" ON "ApplicationError"("status");

-- CreateIndex
CREATE INDEX "ApplicationError_firstSeen_idx" ON "ApplicationError"("firstSeen");

-- CreateIndex
CREATE INDEX "ApplicationError_lastSeen_idx" ON "ApplicationError"("lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "LoginSession_sessionId_key" ON "LoginSession"("sessionId");

-- CreateIndex
CREATE INDEX "LoginSession_userId_idx" ON "LoginSession"("userId");

-- CreateIndex
CREATE INDEX "LoginSession_sessionId_idx" ON "LoginSession"("sessionId");

-- CreateIndex
CREATE INDEX "LoginSession_email_idx" ON "LoginSession"("email");

-- CreateIndex
CREATE INDEX "LoginSession_expiresAt_idx" ON "LoginSession"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginSession_usedAt_idx" ON "LoginSession"("usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NerdcSubject_code_key" ON "NerdcSubject"("code");

-- CreateIndex
CREATE INDEX "NerdcSubject_code_idx" ON "NerdcSubject"("code");

-- CreateIndex
CREATE INDEX "NerdcSubject_isActive_idx" ON "NerdcSubject"("isActive");

-- CreateIndex
CREATE INDEX "NerdcCurriculum_classLevel_idx" ON "NerdcCurriculum"("classLevel");

-- CreateIndex
CREATE INDEX "NerdcCurriculum_term_idx" ON "NerdcCurriculum"("term");

-- CreateIndex
CREATE UNIQUE INDEX "NerdcCurriculum_subjectId_classLevel_term_key" ON "NerdcCurriculum"("subjectId", "classLevel", "term");

-- CreateIndex
CREATE INDEX "NerdcCurriculumWeek_curriculumId_idx" ON "NerdcCurriculumWeek"("curriculumId");

-- CreateIndex
CREATE UNIQUE INDEX "NerdcCurriculumWeek_curriculumId_weekNumber_key" ON "NerdcCurriculumWeek"("curriculumId", "weekNumber");

-- CreateIndex
CREATE INDEX "CurriculumItemProgress_curriculumItemId_idx" ON "CurriculumItemProgress"("curriculumItemId");

-- CreateIndex
CREATE INDEX "CurriculumItemProgress_classArmId_idx" ON "CurriculumItemProgress"("classArmId");

-- CreateIndex
CREATE INDEX "CurriculumItemProgress_classId_idx" ON "CurriculumItemProgress"("classId");

-- CreateIndex
CREATE INDEX "CurriculumItemProgress_teacherId_idx" ON "CurriculumItemProgress"("teacherId");

-- CreateIndex
CREATE INDEX "CurriculumItemProgress_status_idx" ON "CurriculumItemProgress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumItemProgress_curriculumItemId_classArmId_key" ON "CurriculumItemProgress"("curriculumItemId", "classArmId");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumItemProgress_curriculumItemId_classId_key" ON "CurriculumItemProgress"("curriculumItemId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_customSchoolId_key" ON "SubscriptionPlan"("customSchoolId");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_tierCode_idx" ON "SubscriptionPlan"("tierCode");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_isPublic_idx" ON "SubscriptionPlan"("isPublic");

-- CreateIndex
CREATE INDEX "Assessment_schoolId_idx" ON "Assessment"("schoolId");

-- CreateIndex
CREATE INDEX "Assessment_classId_idx" ON "Assessment"("classId");

-- CreateIndex
CREATE INDEX "Assessment_classArmId_idx" ON "Assessment"("classArmId");

-- CreateIndex
CREATE INDEX "Assessment_subjectId_idx" ON "Assessment"("subjectId");

-- CreateIndex
CREATE INDEX "Assessment_teacherId_idx" ON "Assessment"("teacherId");

-- CreateIndex
CREATE INDEX "Assessment_status_idx" ON "Assessment"("status");

-- CreateIndex
CREATE INDEX "AssessmentQuestion_assessmentId_idx" ON "AssessmentQuestion"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentQuestion_order_idx" ON "AssessmentQuestion"("order");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_assessmentId_idx" ON "AssessmentSubmission"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_studentId_idx" ON "AssessmentSubmission"("studentId");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_status_idx" ON "AssessmentSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSubmission_assessmentId_studentId_key" ON "AssessmentSubmission"("assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "AssessmentAnswer_submissionId_idx" ON "AssessmentAnswer"("submissionId");

-- CreateIndex
CREATE INDEX "AssessmentAnswer_questionId_idx" ON "AssessmentAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAnswer_submissionId_questionId_key" ON "AssessmentAnswer"("submissionId", "questionId");

-- CreateIndex
CREATE INDEX "AiUsageLog_schoolId_idx" ON "AiUsageLog"("schoolId");

-- CreateIndex
CREATE INDEX "AiUsageLog_userId_idx" ON "AiUsageLog"("userId");

-- CreateIndex
CREATE INDEX "AiUsageLog_createdAt_idx" ON "AiUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "ClassArm_academicYear_idx" ON "ClassArm"("academicYear");

-- CreateIndex
CREATE INDEX "ClassArm_classTeacherId_idx" ON "ClassArm"("classTeacherId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassArm_classLevelId_name_academicYear_key" ON "ClassArm"("classLevelId", "name", "academicYear");

-- CreateIndex
CREATE INDEX "ClassLevel_facultyId_idx" ON "ClassLevel"("facultyId");

-- CreateIndex
CREATE INDEX "ClassResource_classArmId_idx" ON "ClassResource"("classArmId");

-- CreateIndex
CREATE INDEX "ClassTeacher_classArmId_idx" ON "ClassTeacher"("classArmId");

-- CreateIndex
CREATE INDEX "ClassTeacher_subjectId_idx" ON "ClassTeacher"("subjectId");

-- CreateIndex
CREATE INDEX "ClassTeacher_sessionId_idx" ON "ClassTeacher"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassTeacher_classArmId_subjectId_sessionId_key" ON "ClassTeacher"("classArmId", "subjectId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassTeacher_classId_classArmId_teacherId_subject_key" ON "ClassTeacher"("classId", "classArmId", "teacherId", "subject");

-- CreateIndex
CREATE INDEX "Curriculum_schoolId_idx" ON "Curriculum"("schoolId");

-- CreateIndex
CREATE INDEX "Curriculum_classLevelId_idx" ON "Curriculum"("classLevelId");

-- CreateIndex
CREATE INDEX "Curriculum_subjectId_idx" ON "Curriculum"("subjectId");

-- CreateIndex
CREATE INDEX "Curriculum_status_idx" ON "Curriculum"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Curriculum_schoolId_classLevelId_subjectId_termId_key" ON "Curriculum"("schoolId", "classLevelId", "subjectId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "Curriculum_schoolId_classId_subjectId_termId_key" ON "Curriculum"("schoolId", "classId", "subjectId", "termId");

-- CreateIndex
CREATE INDEX "CurriculumItem_weekNumber_idx" ON "CurriculumItem"("weekNumber");

-- CreateIndex
CREATE INDEX "CurriculumItem_status_idx" ON "CurriculumItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumItem_curriculumId_weekNumber_key" ON "CurriculumItem"("curriculumId", "weekNumber");

-- CreateIndex
CREATE INDEX "Grade_subjectId_idx" ON "Grade"("subjectId");

-- CreateIndex
CREATE INDEX "SchoolAdmin_schoolType_idx" ON "SchoolAdmin"("schoolType");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Teacher_schoolType_idx" ON "Teacher"("schoolType");

-- AddForeignKey
ALTER TABLE "ClassTeacher" ADD CONSTRAINT "ClassTeacher_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "ClassArm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacher" ADD CONSTRAINT "ClassTeacher_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacher" ADD CONSTRAINT "ClassTeacher_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_deanId_fkey" FOREIGN KEY ("deanId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassLevel" ADD CONSTRAINT "ClassLevel_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassArm" ADD CONSTRAINT "ClassArm_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentTemplate" ADD CONSTRAINT "AssessmentTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentTemplate" ADD CONSTRAINT "AssessmentTemplate_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolProfileEditToken" ADD CONSTRAINT "SchoolProfileEditToken_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolProfileEditTokenAudit" ADD CONSTRAINT "SchoolProfileEditTokenAudit_token_fkey" FOREIGN KEY ("token") REFERENCES "SchoolProfileEditToken"("token") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationError" ADD CONSTRAINT "ApplicationError_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationError" ADD CONSTRAINT "ApplicationError_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginSession" ADD CONSTRAINT "LoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassResource" ADD CONSTRAINT "ClassResource_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "ClassArm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NerdcCurriculum" ADD CONSTRAINT "NerdcCurriculum_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "NerdcSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NerdcCurriculumWeek" ADD CONSTRAINT "NerdcCurriculumWeek_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "NerdcCurriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_classLevelId_fkey" FOREIGN KEY ("classLevelId") REFERENCES "ClassLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_nerdcCurriculumId_fkey" FOREIGN KEY ("nerdcCurriculumId") REFERENCES "NerdcCurriculum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumItemProgress" ADD CONSTRAINT "CurriculumItemProgress_curriculumItemId_fkey" FOREIGN KEY ("curriculumItemId") REFERENCES "CurriculumItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumItemProgress" ADD CONSTRAINT "CurriculumItemProgress_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "ClassArm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumItemProgress" ADD CONSTRAINT "CurriculumItemProgress_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumItemProgress" ADD CONSTRAINT "CurriculumItemProgress_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_customSchoolId_fkey" FOREIGN KEY ("customSchoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "ClassArm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssessmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
