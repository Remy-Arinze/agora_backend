-- AlterTable
ALTER TABLE "School" ADD COLUMN "slug" TEXT,
ADD COLUMN "slugLockedAt" TIMESTAMP(3),
ADD COLUMN "slugHoldUntil" TIMESTAMP(3),
ADD COLUMN "customDomain" TEXT,
ADD COLUMN "customDomainStatus" TEXT,
ADD COLUMN "customDomainTxt" TEXT,
ADD COLUMN "customDomainVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");
CREATE UNIQUE INDEX "School_customDomain_key" ON "School"("customDomain");
CREATE INDEX "School_customDomainStatus_idx" ON "School"("customDomainStatus");

-- CreateTable
CREATE TABLE "SchoolSlugRedirect" (
    "id" TEXT NOT NULL,
    "fromSlug" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolSlugRedirect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolSlugRedirect_fromSlug_key" ON "SchoolSlugRedirect"("fromSlug");
CREATE INDEX "SchoolSlugRedirect_schoolId_idx" ON "SchoolSlugRedirect"("schoolId");

ALTER TABLE "SchoolSlugRedirect" ADD CONSTRAINT "SchoolSlugRedirect_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SchoolBranding" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "accentColor" TEXT,
    "faviconUrl" TEXT,
    "loginTagline" TEXT,
    "hidePlatformMark" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolBranding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolBranding_schoolId_key" ON "SchoolBranding"("schoolId");

ALTER TABLE "SchoolBranding" ADD CONSTRAINT "SchoolBranding_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PortalTransferCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalTransferCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortalTransferCode_codeHash_key" ON "PortalTransferCode"("codeHash");
CREATE INDEX "PortalTransferCode_schoolId_idx" ON "PortalTransferCode"("schoolId");
CREATE INDEX "PortalTransferCode_userId_idx" ON "PortalTransferCode"("userId");
CREATE INDEX "PortalTransferCode_expiresAt_idx" ON "PortalTransferCode"("expiresAt");

ALTER TABLE "PortalTransferCode" ADD CONSTRAINT "PortalTransferCode_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
