-- CreateTable
CREATE TABLE "StudentResource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "description" TEXT,
    "studentId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentResource_studentId_idx" ON "StudentResource"("studentId");

-- CreateIndex
CREATE INDEX "StudentResource_uploadedBy_idx" ON "StudentResource"("uploadedBy");

-- CreateIndex
CREATE INDEX "StudentResource_fileType_idx" ON "StudentResource"("fileType");

-- AddForeignKey
ALTER TABLE "StudentResource" ADD CONSTRAINT "StudentResource_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
