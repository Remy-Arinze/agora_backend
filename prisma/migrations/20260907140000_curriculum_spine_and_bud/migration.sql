-- Curriculum spine + Bud

-- AgoraCurriculumTopic.stableKey
ALTER TABLE "AgoraCurriculumTopic" ADD COLUMN IF NOT EXISTS "stableKey" TEXT;
ALTER TABLE "AgoraCurriculumTopic" ADD COLUMN IF NOT EXISTS "deprecatedAt" TIMESTAMP(3);

UPDATE "AgoraCurriculumTopic"
SET "stableKey" = CONCAT('TOPIC-', "id")
WHERE "stableKey" IS NULL OR "stableKey" = '';

ALTER TABLE "AgoraCurriculumTopic" ALTER COLUMN "stableKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "AgoraCurriculumTopic_curriculumId_stableKey_key"
  ON "AgoraCurriculumTopic"("curriculumId", "stableKey");
CREATE INDEX IF NOT EXISTS "AgoraCurriculumTopic_stableKey_idx" ON "AgoraCurriculumTopic"("stableKey");

-- SchoolCurriculumTopic
CREATE TABLE IF NOT EXISTS "SchoolCurriculumTopic" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "schoolCurriculumDocId" TEXT,
  "subjectId" TEXT NOT NULL,
  "gradeLevel" TEXT NOT NULL,
  "termNumber" INTEGER NOT NULL DEFAULT 1,
  "stableKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "weekNumber" INTEGER NOT NULL DEFAULT 0,
  "subTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "learningOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "studentFriendlyOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "suggestedActivities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "resources" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "assessmentType" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolCurriculumTopic_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolCurriculumTopic_schoolId_stableKey_key" ON "SchoolCurriculumTopic"("schoolId", "stableKey");
CREATE INDEX IF NOT EXISTS "SchoolCurriculumTopic_schoolId_idx" ON "SchoolCurriculumTopic"("schoolId");

ALTER TABLE "SchoolCurriculumTopic" DROP CONSTRAINT IF EXISTS "SchoolCurriculumTopic_schoolId_fkey";
ALTER TABLE "SchoolCurriculumTopic" ADD CONSTRAINT "SchoolCurriculumTopic_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SchemeOfWork archive + activeKey
ALTER TABLE "SchemeOfWork" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "SchemeOfWork" ADD COLUMN IF NOT EXISTS "archivedBy" TEXT;
ALTER TABLE "SchemeOfWork" ADD COLUMN IF NOT EXISTS "activeKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "SchemeOfWork_activeKey_key" ON "SchemeOfWork"("activeKey");

-- Week topic join
CREATE TABLE IF NOT EXISTS "SchemeOfWorkWeekTopic" (
  "id" TEXT NOT NULL,
  "schemeOfWorkWeekId" TEXT NOT NULL,
  "agoraTopicId" TEXT,
  "schoolTopicId" TEXT,
  "stableKey" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SchemeOfWorkWeekTopic_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchemeOfWorkWeekTopic_schemeOfWorkWeekId_stableKey_key"
  ON "SchemeOfWorkWeekTopic"("schemeOfWorkWeekId", "stableKey");
ALTER TABLE "SchemeOfWorkWeekTopic" DROP CONSTRAINT IF EXISTS "SchemeOfWorkWeekTopic_schemeOfWorkWeekId_fkey";
ALTER TABLE "SchemeOfWorkWeekTopic" ADD CONSTRAINT "SchemeOfWorkWeekTopic_schemeOfWorkWeekId_fkey"
  FOREIGN KEY ("schemeOfWorkWeekId") REFERENCES "SchemeOfWorkWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-arm delivery
CREATE TABLE IF NOT EXISTS "SchemeOfWorkWeekDelivery" (
  "id" TEXT NOT NULL,
  "weekId" TEXT NOT NULL,
  "classArmId" TEXT,
  "classId" TEXT,
  "teacherId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "deliveredAt" TIMESTAMP(3),
  "deliveryNote" TEXT,
  "catchUpReason" TEXT,
  "lessonNoteUrl" TEXT,
  "lessonNotePublicId" TEXT,
  "lessonNoteFileName" TEXT,
  "deliveryConfidence" INTEGER NOT NULL DEFAULT 0,
  "combinedIntoWeekId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchemeOfWorkWeekDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchemeOfWorkWeekDelivery_weekId_classArmId_key"
  ON "SchemeOfWorkWeekDelivery"("weekId", "classArmId");
ALTER TABLE "SchemeOfWorkWeekDelivery" DROP CONSTRAINT IF EXISTS "SchemeOfWorkWeekDelivery_weekId_fkey";
ALTER TABLE "SchemeOfWorkWeekDelivery" ADD CONSTRAINT "SchemeOfWorkWeekDelivery_weekId_fkey"
  FOREIGN KEY ("weekId") REFERENCES "SchemeOfWorkWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Assessment tags
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "schemeOfWorkId" TEXT;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "weekIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "stableKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AssessmentQuestion" ADD COLUMN IF NOT EXISTS "stableKey" TEXT;
ALTER TABLE "AssessmentQuestion" ADD COLUMN IF NOT EXISTS "bloomLevel" TEXT;
ALTER TABLE "AssessmentQuestion" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'TEACHER';

-- Bud
CREATE TABLE IF NOT EXISTS "BudPlan" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "interval" TEXT NOT NULL,
  "priceKobo" INTEGER NOT NULL DEFAULT 0,
  "aiCredits" INTEGER NOT NULL DEFAULT 0,
  "dailyCardLimit" INTEGER,
  "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
  "paystackPlanCode" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "customSchoolId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BudPlan_slug_key" ON "BudPlan"("slug");

CREATE TABLE IF NOT EXISTS "BudProfile" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "companionName" TEXT NOT NULL DEFAULT 'Bud',
  "streakCount" INTEGER NOT NULL DEFAULT 0,
  "lastStudyDate" TIMESTAMP(3),
  "reminderHour" INTEGER NOT NULL DEFAULT 16,
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
  "onboardedAt" TIMESTAMP(3),
  "pendingRename" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BudProfile_studentId_key" ON "BudProfile"("studentId");

CREATE TABLE IF NOT EXISTS "BudSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolId" TEXT,
  "planId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'TRIAL',
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate" TIMESTAMP(3),
  "aiCredits" INTEGER NOT NULL DEFAULT 0,
  "aiCreditsUsed" INTEGER NOT NULL DEFAULT 0,
  "paystackCustomerId" TEXT,
  "paystackCode" TEXT,
  "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BudSubscription_studentId_key" ON "BudSubscription"("studentId");

CREATE TABLE IF NOT EXISTS "BudPayment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "reference" TEXT NOT NULL,
  "amountKobo" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB,
  "paystackResponse" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BudPayment_reference_key" ON "BudPayment"("reference");

CREATE TABLE IF NOT EXISTS "StudyDeck" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "subjectId" TEXT,
  "schemeWeekId" TEXT,
  "stableKey" TEXT,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyDeck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StudyCard" (
  "id" TEXT NOT NULL,
  "deckId" TEXT NOT NULL,
  "front" TEXT NOT NULL,
  "back" TEXT NOT NULL,
  "cloze" TEXT,
  "stableKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CardReview" (
  "id" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reps" INTEGER NOT NULL DEFAULT 0,
  "lapses" INTEGER NOT NULL DEFAULT 0,
  "lastRating" INTEGER,
  "lastReviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CardReview_cardId_key" ON "CardReview"("cardId");

CREATE TABLE IF NOT EXISTS "StudySession" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "durationSec" INTEGER NOT NULL DEFAULT 0,
  "stableKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DailyReviewPlan" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "stableKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyReviewPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DailyReviewPlan_studentId_date_key" ON "DailyReviewPlan"("studentId", "date");
