-- CreateTable
CREATE TABLE "LoisConfig" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "customGreeting" TEXT,
    "toneNote" TEXT,
    "restrictedTopics" TEXT,
    "schoolContext" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoisConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoisConfig_schoolId_key" ON "LoisConfig"("schoolId");

-- CreateIndex
CREATE INDEX "LoisConfig_schoolId_idx" ON "LoisConfig"("schoolId");

-- AddForeignKey
ALTER TABLE "LoisConfig" ADD CONSTRAINT "LoisConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
