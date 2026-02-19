-- CreateTable
CREATE TABLE "ClassResource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "description" TEXT,
    "classId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassResource_classId_idx" ON "ClassResource"("classId");

-- CreateIndex
CREATE INDEX "ClassResource_uploadedBy_idx" ON "ClassResource"("uploadedBy");

-- CreateIndex
CREATE INDEX "ClassResource_fileType_idx" ON "ClassResource"("fileType");

-- AddForeignKey
ALTER TABLE "ClassResource" ADD CONSTRAINT "ClassResource_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
