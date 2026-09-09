-- CreateTable
CREATE TABLE "LoisInsightRead" (
    "id" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoisInsightRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoisInsightRead_insightId_userId_key" ON "LoisInsightRead"("insightId", "userId");

-- CreateIndex
CREATE INDEX "LoisInsightRead_userId_readAt_idx" ON "LoisInsightRead"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "LoisInsightRead" ADD CONSTRAINT "LoisInsightRead_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "LoisInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoisInsightRead" ADD CONSTRAINT "LoisInsightRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
