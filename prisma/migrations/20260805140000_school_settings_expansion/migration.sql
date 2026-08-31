-- CreateEnum
CREATE TYPE "SchemeDeliveryCatchUpReason" AS ENUM ('MISSED', 'CATCH_UP', 'COMBINED');

-- CreateEnum
CREATE TYPE "ClassLevelNamingMode" AS ENUM ('STANDARD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SubjectRegistryMode" AS ENUM ('AGORA_DEFAULT', 'AGORA_PLUS_CUSTOM', 'CUSTOM_ONLY');

-- CreateEnum
CREATE TYPE "TeacherScopeMode" AS ENUM ('ASSIGNED_ONLY', 'ALL_SCHOOL');

-- CreateEnum
CREATE TYPE "GradeScaleType" AS ENUM ('PERCENTAGE', 'A1_F9', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TemplatesMode" AS ENUM ('SCHOOL_TEMPLATES', 'TEACHER_DISCRETION');

-- CreateEnum
CREATE TYPE "ReportCardReleaseMode" AS ENUM ('MANUAL', 'AUTO_AFTER_LOCK', 'AUTO_ON_TERM_END');

-- CreateEnum
CREATE TYPE "TransferPolicyMode" AS ENUM ('MANUAL_REVIEW', 'AUTO_ACCEPT', 'DISABLED');

-- CreateEnum
CREATE TYPE "CurriculumSourceMode" AS ENUM ('AGORA_NATIONAL', 'SCHOOL_UPLOAD', 'MERGED');

-- AlterEnum
ALTER TYPE "PermissionResource" ADD VALUE 'SETTINGS';

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "allowLateSubmissionAfterDue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowLateSubmissionAfterTimer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lateDuePenaltyPoints" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "lateTimerPenaltyPoints" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AssessmentSubmission" ADD COLUMN     "isLateDue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isLateTimer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lateDueDeduction" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "lateTimerDeduction" DECIMAL(65,30) DEFAULT 0;

-- AlterTable
ALTER TABLE "Fee" ADD COLUMN     "feeScheduleId" TEXT;

-- AlterTable
ALTER TABLE "SchemeOfWorkWeek" ADD COLUMN     "catchUpReason" "SchemeDeliveryCatchUpReason",
ADD COLUMN     "deliveryConfidence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryNote" TEXT,
ADD COLUMN     "lessonNoteFileName" TEXT,
ADD COLUMN     "lessonNotePublicId" TEXT,
ADD COLUMN     "lessonNoteUrl" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "photoConsentGiven" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT,
    "role" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolStructureConfig" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "terminologyOverrides" JSONB,
    "defaultClassArmNames" TEXT[] DEFAULT ARRAY['A', 'B', 'C']::TEXT[],
    "classLevelNamingMode" "ClassLevelNamingMode" NOT NULL DEFAULT 'STANDARD',
    "subjectRegistryMode" "SubjectRegistryMode" NOT NULL DEFAULT 'AGORA_PLUS_CUSTOM',
    "defaultAgoraSubjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "facultyStructureVisible" BOOLEAN NOT NULL DEFAULT true,
    "teacherScope" "TeacherScopeMode" NOT NULL DEFAULT 'ASSIGNED_ONLY',
    "customRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "admissionApproverRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "transferApproverRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolStructureConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolHolidayPreset" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "recurringRule" TEXT,
    "schoolType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolHolidayPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "gradeScaleType" "GradeScaleType" NOT NULL DEFAULT 'PERCENTAGE',
    "gradeScaleBands" JSONB,
    "passMark" DECIMAL(65,30) NOT NULL DEFAULT 40,
    "defaultCaWeight" DECIMAL(65,30) NOT NULL DEFAULT 40,
    "defaultExamWeight" DECIMAL(65,30) NOT NULL DEFAULT 60,
    "defaultLateDuePenalty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "defaultLateTimerPenalty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "defaultIntegrityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultViolationThreshold" INTEGER NOT NULL DEFAULT 1,
    "defaultPointsPerViolation" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "defaultAllowLateSubmissionAfterDue" BOOLEAN NOT NULL DEFAULT false,
    "defaultAllowLateSubmissionAfterTimer" BOOLEAN NOT NULL DEFAULT false,
    "templatesMode" "TemplatesMode" NOT NULL DEFAULT 'TEACHER_DISCRETION',
    "gradeLockDaysAfterTermEnd" INTEGER NOT NULL DEFAULT 7,
    "reportCardReleaseMode" "ReportCardReleaseMode" NOT NULL DEFAULT 'MANUAL',
    "gradeApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "gradeApproverRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minAttendancePercentForExam" DECIMAL(65,30) NOT NULL DEFAULT 75,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissionIds" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "applicationsOpen" BOOLEAN NOT NULL DEFAULT true,
    "applicationDeadline" TIMESTAMP(3),
    "tacExpiryDays" INTEGER NOT NULL DEFAULT 30,
    "transferPolicy" "TransferPolicyMode" NOT NULL DEFAULT 'MANUAL_REVIEW',
    "formFields" JSONB,
    "documentRequirements" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BellScheduleTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolType" TEXT NOT NULL,
    "periods" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BellScheduleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetablePolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "defaultPeriodLengthMinutes" INTEGER NOT NULL DEFAULT 40,
    "maxPeriodsPerTeacherPerDay" INTEGER NOT NULL DEFAULT 6,
    "roomCapacityWarningEnabled" BOOLEAN NOT NULL DEFAULT true,
    "examBlackoutEnabled" BOOLEAN NOT NULL DEFAULT true,
    "substituteNotifyRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetablePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "markingWindowHours" INTEGER NOT NULL DEFAULT 24,
    "statusOptions" TEXT[] DEFAULT ARRAY['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK']::TEXT[],
    "minAttendancePercent" DECIMAL(65,30) NOT NULL DEFAULT 75,
    "absenceNotifyChannels" TEXT[] DEFAULT ARRAY['EMAIL', 'IN_APP']::TEXT[],
    "editRoles" TEXT[] DEFAULT ARRAY['TEACHER', 'ADMIN']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "emailSenderName" TEXT,
    "enabledChannels" TEXT[] DEFAULT ARRAY['EMAIL', 'IN_APP', 'PUSH']::TEXT[],
    "eventTriggers" JSONB,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "quietHoursTimezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeCategory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeSchedule" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "classLevelId" TEXT,
    "termId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "lateGraceDays" INTEGER NOT NULL DEFAULT 0,
    "latePenaltyPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "paymentMethods" TEXT[] DEFAULT ARRAY['BANK_TRANSFER', 'PAYSTACK', 'CASH']::TEXT[],
    "feeVisibleToStudents" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "curriculumSource" "CurriculumSourceMode" NOT NULL DEFAULT 'MERGED',
    "schemeApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "schemeApproverRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiCreditLimitPerTeacher" INTEGER,
    "aiCreditLimitPerDepartment" INTEGER,
    "departmentCreditOverrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 480,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
    "passwordRequireSpecialChar" BOOLEAN NOT NULL DEFAULT true,
    "passwordResetDays" INTEGER NOT NULL DEFAULT 90,
    "auditLogRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "alumniDataRetentionYears" INTEGER NOT NULL DEFAULT 7,
    "studentPhotoConsentRequired" BOOLEAN NOT NULL DEFAULT false,
    "sensitiveChangesRequireEmailVerification" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentRecordAudit" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "studentId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentRecordAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InAppNotification_userId_readAt_createdAt_idx" ON "InAppNotification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_createdAt_idx" ON "InAppNotification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InAppNotification_schoolId_createdAt_idx" ON "InAppNotification"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "InAppNotification_type_idx" ON "InAppNotification"("type");

-- CreateIndex
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "WebPushSubscription_userId_idx" ON "WebPushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolStructureConfig_schoolId_key" ON "SchoolStructureConfig"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolHolidayPreset_schoolId_idx" ON "SchoolHolidayPreset"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "GradingPolicy_schoolId_key" ON "GradingPolicy"("schoolId");

-- CreateIndex
CREATE INDEX "RoleTemplate_schoolId_idx" ON "RoleTemplate"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleTemplate_schoolId_name_key" ON "RoleTemplate"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionPolicy_schoolId_key" ON "AdmissionPolicy"("schoolId");

-- CreateIndex
CREATE INDEX "AdmissionDocument_applicationId_idx" ON "AdmissionDocument"("applicationId");

-- CreateIndex
CREATE INDEX "AdmissionDocument_schoolId_idx" ON "AdmissionDocument"("schoolId");

-- CreateIndex
CREATE INDEX "BellScheduleTemplate_schoolId_schoolType_idx" ON "BellScheduleTemplate"("schoolId", "schoolType");

-- CreateIndex
CREATE UNIQUE INDEX "TimetablePolicy_schoolId_key" ON "TimetablePolicy"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePolicy_schoolId_key" ON "AttendancePolicy"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPolicy_schoolId_key" ON "NotificationPolicy"("schoolId");

-- CreateIndex
CREATE INDEX "FeeCategory_schoolId_idx" ON "FeeCategory"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeCategory_schoolId_name_key" ON "FeeCategory"("schoolId", "name");

-- CreateIndex
CREATE INDEX "FeeSchedule_schoolId_idx" ON "FeeSchedule"("schoolId");

-- CreateIndex
CREATE INDEX "FeeSchedule_categoryId_idx" ON "FeeSchedule"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePolicy_schoolId_key" ON "FinancePolicy"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumPolicy_schoolId_key" ON "CurriculumPolicy"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityPolicy_schoolId_key" ON "SecurityPolicy"("schoolId");

-- CreateIndex
CREATE INDEX "StudentRecordAudit_schoolId_idx" ON "StudentRecordAudit"("schoolId");

-- CreateIndex
CREATE INDEX "StudentRecordAudit_userId_idx" ON "StudentRecordAudit"("userId");

-- CreateIndex
CREATE INDEX "StudentRecordAudit_studentId_idx" ON "StudentRecordAudit"("studentId");

-- CreateIndex
CREATE INDEX "StudentRecordAudit_createdAt_idx" ON "StudentRecordAudit"("createdAt");

-- CreateIndex
CREATE INDEX "Event_schoolId_startDate_endDate_idx" ON "Event"("schoolId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Fee_feeScheduleId_idx" ON "Fee"("feeScheduleId");

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_feeScheduleId_fkey" FOREIGN KEY ("feeScheduleId") REFERENCES "FeeSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStructureConfig" ADD CONSTRAINT "SchoolStructureConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolHolidayPreset" ADD CONSTRAINT "SchoolHolidayPreset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingPolicy" ADD CONSTRAINT "GradingPolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleTemplate" ADD CONSTRAINT "RoleTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionPolicy" ADD CONSTRAINT "AdmissionPolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionDocument" ADD CONSTRAINT "AdmissionDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionDocument" ADD CONSTRAINT "AdmissionDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BellScheduleTemplate" ADD CONSTRAINT "BellScheduleTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetablePolicy" ADD CONSTRAINT "TimetablePolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePolicy" ADD CONSTRAINT "AttendancePolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPolicy" ADD CONSTRAINT "NotificationPolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCategory" ADD CONSTRAINT "FeeCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FeeCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_classLevelId_fkey" FOREIGN KEY ("classLevelId") REFERENCES "ClassLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePolicy" ADD CONSTRAINT "FinancePolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumPolicy" ADD CONSTRAINT "CurriculumPolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityPolicy" ADD CONSTRAINT "SecurityPolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRecordAudit" ADD CONSTRAINT "StudentRecordAudit_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
