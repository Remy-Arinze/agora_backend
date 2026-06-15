-- CreateTable
CREATE TABLE "LoisSkill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetRoles" TEXT NOT NULL DEFAULT 'ALL',
    "category" TEXT NOT NULL DEFAULT 'behavior',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoisSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoisSkill_isActive_idx" ON "LoisSkill"("isActive");

-- CreateIndex
CREATE INDEX "LoisSkill_priority_idx" ON "LoisSkill"("priority");
