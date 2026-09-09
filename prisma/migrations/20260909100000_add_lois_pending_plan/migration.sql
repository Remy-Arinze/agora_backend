-- CreateEnum
CREATE TYPE "LoisPendingPlanKind" AS ENUM ('TIMETABLE', 'SCHEME');

-- CreateEnum
CREATE TYPE "LoisPendingPlanStatus" AS ENUM ('PROPOSED', 'APPLIED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "LoisPendingPlan" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" "LoisPendingPlanKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "LoisPendingPlanStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoisPendingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoisPendingPlan_userId_schoolId_status_idx" ON "LoisPendingPlan"("userId", "schoolId", "status");

-- CreateIndex
CREATE INDEX "LoisPendingPlan_conversationId_idx" ON "LoisPendingPlan"("conversationId");

-- CreateIndex
CREATE INDEX "LoisPendingPlan_expiresAt_idx" ON "LoisPendingPlan"("expiresAt");

-- AddForeignKey
ALTER TABLE "LoisPendingPlan" ADD CONSTRAINT "LoisPendingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoisPendingPlan" ADD CONSTRAINT "LoisPendingPlan_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
