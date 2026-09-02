-- CreateTable
CREATE TABLE "LoisInsight" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "studentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "classIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "teacherIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "href" TEXT,
    "askPrompt" TEXT,
    "fingerprint" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoisInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoisInsight_schoolId_createdAt_idx" ON "LoisInsight"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "LoisInsight_schoolId_type_idx" ON "LoisInsight"("schoolId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "LoisInsight_schoolId_fingerprint_key" ON "LoisInsight"("schoolId", "fingerprint");

-- AddForeignKey
ALTER TABLE "LoisInsight" ADD CONSTRAINT "LoisInsight_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
