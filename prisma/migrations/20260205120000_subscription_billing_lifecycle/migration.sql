-- Subscription billing lifecycle (grace → admin action → downgrade) + enrollment billing lock
CREATE TYPE "SchoolBillingPhase" AS ENUM ('OK', 'GRACE_PERIOD', 'ADMIN_ACTION_REQUIRED');

ALTER TABLE "Subscription" ADD COLUMN "billingPhase" "SchoolBillingPhase" NOT NULL DEFAULT 'OK';
ALTER TABLE "Subscription" ADD COLUMN "gracePeriodEndsAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "billingGraceReminderLastAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "paystackSubscriptionCode" TEXT;

ALTER TABLE "Enrollment" ADD COLUMN "billingLocked" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Enrollment_schoolId_billingLocked_idx" ON "Enrollment"("schoolId", "billingLocked");

ALTER TABLE "Teacher" ADD COLUMN "billingSuspended" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Teacher_schoolId_billingSuspended_idx" ON "Teacher"("schoolId", "billingSuspended");

ALTER TABLE "SchoolAdmin" ADD COLUMN "billingSuspended" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "SchoolAdmin_schoolId_billingSuspended_idx" ON "SchoolAdmin"("schoolId", "billingSuspended");

CREATE TABLE "SubscriptionBillingAuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionBillingAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionBillingAuditLog_schoolId_createdAt_idx" ON "SubscriptionBillingAuditLog"("schoolId", "createdAt");

ALTER TABLE "SubscriptionBillingAuditLog" ADD CONSTRAINT "SubscriptionBillingAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
