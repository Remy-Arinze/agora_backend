-- AlterTable
ALTER TABLE "SchemeOfWork" ADD COLUMN     "classLevelId" TEXT;

-- CreateIndex
CREATE INDEX "SchemeOfWork_classLevelId_idx" ON "SchemeOfWork"("classLevelId");

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_classLevelId_fkey" FOREIGN KEY ("classLevelId") REFERENCES "ClassLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
