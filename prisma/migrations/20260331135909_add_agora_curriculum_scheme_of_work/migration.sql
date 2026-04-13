-- CreateEnum
CREATE TYPE "AgoraCurriculumSourceStatus" AS ENUM ('PENDING_PARSE', 'PARSING', 'PARSED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AgoraCurriculumPublishStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SchoolCurriculumDocStatus" AS ENUM ('PENDING_PARSE', 'PARSING', 'PARSED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SchemeOfWorkStatus" AS ENUM ('GENERATING', 'DRAFT', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SchemeGenerationMode" AS ENUM ('AGORA_ONLY', 'SCHOOL_ONLY', 'MERGED');

-- CreateTable
CREATE TABLE "AgoraCurriculumSource" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "gradeLevel" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "fileType" TEXT,
    "parsedContent" JSONB,
    "parseErrors" TEXT,
    "status" "AgoraCurriculumSourceStatus" NOT NULL DEFAULT 'PENDING_PARSE',
    "manualContent" JSONB,
    "createdBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgoraCurriculumSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgoraCurriculum" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "gradeLevel" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "AgoraCurriculumPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceIds" TEXT[],
    "consolidationNotes" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgoraCurriculum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgoraCurriculumTopic" (
    "id" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "subTopics" TEXT[],
    "learningOutcomes" TEXT[],
    "studentFriendlyOutcomes" TEXT[],
    "suggestedActivities" TEXT[],
    "resources" TEXT[],
    "assessmentType" TEXT,
    "assessmentGuidance" TEXT,
    "duration" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgoraCurriculumTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolCurriculumDoc" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "gradeLevel" TEXT NOT NULL,
    "termNumber" INTEGER,
    "sourceType" TEXT NOT NULL,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "fileType" TEXT,
    "parsedContent" JSONB,
    "parseErrors" TEXT,
    "manualContent" JSONB,
    "status" "SchoolCurriculumDocStatus" NOT NULL DEFAULT 'PENDING_PARSE',
    "uploadedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCurriculumDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeOfWork" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classArmId" TEXT,
    "classId" TEXT,
    "subjectId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "generationMode" "SchemeGenerationMode" NOT NULL,
    "agoraCurriculumId" TEXT,
    "agoraCurriculumVersion" INTEGER,
    "schoolCurriculumId" TEXT,
    "mergeWeightAgora" INTEGER,
    "mergeWeightSchool" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "SchemeOfWorkStatus" NOT NULL DEFAULT 'DRAFT',
    "parentSchemeId" TEXT,
    "isFork" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemeOfWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeOfWorkWeek" (
    "id" TEXT NOT NULL,
    "schemeOfWorkId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "calendarStartDate" TIMESTAMP(3),
    "calendarEndDate" TIMESTAMP(3),
    "topic" TEXT NOT NULL,
    "subTopics" TEXT[],
    "learningOutcomes" TEXT[],
    "studentFriendlyOutcomes" TEXT[],
    "suggestedActivities" TEXT[],
    "resources" TEXT[],
    "assessmentType" TEXT,
    "teacherNotes" TEXT,
    "privateTeacherNotes" TEXT,
    "isDelivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "deliveredBy" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemeOfWorkWeek_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgoraCurriculumSource_subjectId_idx" ON "AgoraCurriculumSource"("subjectId");

-- CreateIndex
CREATE INDEX "AgoraCurriculumSource_gradeLevel_idx" ON "AgoraCurriculumSource"("gradeLevel");

-- CreateIndex
CREATE INDEX "AgoraCurriculumSource_status_idx" ON "AgoraCurriculumSource"("status");

-- CreateIndex
CREATE INDEX "AgoraCurriculumSource_subjectId_gradeLevel_idx" ON "AgoraCurriculumSource"("subjectId", "gradeLevel");

-- CreateIndex
CREATE INDEX "AgoraCurriculum_subjectId_idx" ON "AgoraCurriculum"("subjectId");

-- CreateIndex
CREATE INDEX "AgoraCurriculum_gradeLevel_idx" ON "AgoraCurriculum"("gradeLevel");

-- CreateIndex
CREATE INDEX "AgoraCurriculum_status_idx" ON "AgoraCurriculum"("status");

-- CreateIndex
CREATE INDEX "AgoraCurriculum_subjectId_gradeLevel_idx" ON "AgoraCurriculum"("subjectId", "gradeLevel");

-- CreateIndex
CREATE UNIQUE INDEX "AgoraCurriculum_subjectId_gradeLevel_version_key" ON "AgoraCurriculum"("subjectId", "gradeLevel", "version");

-- CreateIndex
CREATE INDEX "AgoraCurriculumTopic_curriculumId_idx" ON "AgoraCurriculumTopic"("curriculumId");

-- CreateIndex
CREATE INDEX "AgoraCurriculumTopic_weekNumber_idx" ON "AgoraCurriculumTopic"("weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AgoraCurriculumTopic_curriculumId_weekNumber_key" ON "AgoraCurriculumTopic"("curriculumId", "weekNumber");

-- CreateIndex
CREATE INDEX "SchoolCurriculumDoc_schoolId_idx" ON "SchoolCurriculumDoc"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolCurriculumDoc_subjectId_idx" ON "SchoolCurriculumDoc"("subjectId");

-- CreateIndex
CREATE INDEX "SchoolCurriculumDoc_gradeLevel_idx" ON "SchoolCurriculumDoc"("gradeLevel");

-- CreateIndex
CREATE INDEX "SchoolCurriculumDoc_status_idx" ON "SchoolCurriculumDoc"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCurriculumDoc_schoolId_subjectId_gradeLevel_termNumbe_key" ON "SchoolCurriculumDoc"("schoolId", "subjectId", "gradeLevel", "termNumber");

-- CreateIndex
CREATE INDEX "SchemeOfWork_schoolId_idx" ON "SchemeOfWork"("schoolId");

-- CreateIndex
CREATE INDEX "SchemeOfWork_classArmId_idx" ON "SchemeOfWork"("classArmId");

-- CreateIndex
CREATE INDEX "SchemeOfWork_classId_idx" ON "SchemeOfWork"("classId");

-- CreateIndex
CREATE INDEX "SchemeOfWork_subjectId_idx" ON "SchemeOfWork"("subjectId");

-- CreateIndex
CREATE INDEX "SchemeOfWork_termId_idx" ON "SchemeOfWork"("termId");

-- CreateIndex
CREATE INDEX "SchemeOfWork_status_idx" ON "SchemeOfWork"("status");

-- CreateIndex
CREATE INDEX "SchemeOfWork_schoolId_subjectId_termId_idx" ON "SchemeOfWork"("schoolId", "subjectId", "termId");

-- CreateIndex
CREATE INDEX "SchemeOfWorkWeek_schemeOfWorkId_idx" ON "SchemeOfWorkWeek"("schemeOfWorkId");

-- CreateIndex
CREATE INDEX "SchemeOfWorkWeek_weekNumber_idx" ON "SchemeOfWorkWeek"("weekNumber");

-- CreateIndex
CREATE INDEX "SchemeOfWorkWeek_isDelivered_idx" ON "SchemeOfWorkWeek"("isDelivered");

-- CreateIndex
CREATE UNIQUE INDEX "SchemeOfWorkWeek_schemeOfWorkId_weekNumber_key" ON "SchemeOfWorkWeek"("schemeOfWorkId", "weekNumber");

-- AddForeignKey
ALTER TABLE "AgoraCurriculumSource" ADD CONSTRAINT "AgoraCurriculumSource_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "NerdcSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgoraCurriculum" ADD CONSTRAINT "AgoraCurriculum_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "NerdcSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgoraCurriculumTopic" ADD CONSTRAINT "AgoraCurriculumTopic_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "AgoraCurriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCurriculumDoc" ADD CONSTRAINT "SchoolCurriculumDoc_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_agoraCurriculumId_fkey" FOREIGN KEY ("agoraCurriculumId") REFERENCES "AgoraCurriculum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_schoolCurriculumId_fkey" FOREIGN KEY ("schoolCurriculumId") REFERENCES "SchoolCurriculumDoc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_parentSchemeId_fkey" FOREIGN KEY ("parentSchemeId") REFERENCES "SchemeOfWork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWorkWeek" ADD CONSTRAINT "SchemeOfWorkWeek_schemeOfWorkId_fkey" FOREIGN KEY ("schemeOfWorkId") REFERENCES "SchemeOfWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
