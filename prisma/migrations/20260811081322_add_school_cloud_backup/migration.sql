-- CreateTable
CREATE TABLE "SchoolCloudBackup" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "megaEmail" TEXT,
    "megaPassword" TEXT,
    "lastBackupAt" TIMESTAMP(3),
    "lastBackupStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCloudBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolCloudBackup_schoolId_idx" ON "SchoolCloudBackup"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCloudBackup_schoolId_provider_key" ON "SchoolCloudBackup"("schoolId", "provider");

-- AddForeignKey
ALTER TABLE "SchoolCloudBackup" ADD CONSTRAINT "SchoolCloudBackup_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
