/*
  Warnings:

  - A unique constraint covering the columns `[paystackSubscriptionCode]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[paystackMonthlyPlanCode]` on the table `SubscriptionPlan` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[paystackYearlyPlanCode]` on the table `SubscriptionPlan` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paystackCustomerId" TEXT,
ADD COLUMN     "paystackEmailToken" TEXT;

-- AlterTable
ALTER TABLE "SubscriptionBillingAuditLog" ADD COLUMN     "newEndDate" TIMESTAMP(3),
ADD COLUMN     "newTier" "SubscriptionTier",
ADD COLUMN     "previousEndDate" TIMESTAMP(3),
ADD COLUMN     "previousTier" "SubscriptionTier";

-- AlterTable
ALTER TABLE "SubscriptionPayment" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'INITIAL';

-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "paystackMonthlyPlanCode" TEXT,
ADD COLUMN     "paystackYearlyPlanCode" TEXT;

-- CreateTable
CREATE TABLE "PaymentIdempotency" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "PaymentIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIdempotency_eventKey_key" ON "PaymentIdempotency"("eventKey");

-- CreateIndex
CREATE INDEX "PaymentIdempotency_eventKey_idx" ON "PaymentIdempotency"("eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_paystackSubscriptionCode_key" ON "Subscription"("paystackSubscriptionCode");

-- CreateIndex
CREATE INDEX "Subscription_paystackSubscriptionCode_idx" ON "Subscription"("paystackSubscriptionCode");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_type_idx" ON "SubscriptionPayment"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_paystackMonthlyPlanCode_key" ON "SubscriptionPlan"("paystackMonthlyPlanCode");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_paystackYearlyPlanCode_key" ON "SubscriptionPlan"("paystackYearlyPlanCode");
