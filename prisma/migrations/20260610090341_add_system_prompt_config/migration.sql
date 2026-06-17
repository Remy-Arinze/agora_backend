-- CreateTable
CREATE TABLE "SystemPromptConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "identityOverride" TEXT,
    "additionalRules" TEXT,
    "teacherRulesOverride" TEXT,
    "adminRulesOverride" TEXT,
    "studentRulesOverride" TEXT,
    "internalNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemPromptConfig_pkey" PRIMARY KEY ("id")
);
