-- AlterTable
ALTER TABLE "ClassArm" ADD COLUMN "academicYear" TEXT NOT NULL DEFAULT '2024/2025';
ALTER TABLE "ClassArm" ADD COLUMN "classTeacherId" TEXT;

-- AlterTable
ALTER TABLE "ClassTeacher" ADD COLUMN "classArmId" TEXT;

-- AlterTable
ALTER TABLE "ClassResource" ADD COLUMN "classArmId" TEXT;
ALTER TABLE "ClassResource" ADD COLUMN "classLevelId" TEXT;

-- AlterTable
ALTER TABLE "Curriculum" ADD COLUMN "classLevelId" TEXT;

-- CreateIndex
CREATE INDEX "ClassArm_academicYear_idx" ON "ClassArm"("academicYear");

-- CreateIndex
CREATE INDEX "ClassArm_classTeacherId_idx" ON "ClassArm"("classTeacherId");

-- CreateIndex
CREATE INDEX "ClassTeacher_classArmId_idx" ON "ClassTeacher"("classArmId");

-- CreateIndex
CREATE INDEX "ClassResource_classArmId_idx" ON "ClassResource"("classArmId");

-- CreateIndex
CREATE INDEX "ClassResource_classLevelId_idx" ON "ClassResource"("classLevelId");

-- CreateIndex
CREATE INDEX "Curriculum_classLevelId_idx" ON "Curriculum"("classLevelId");

-- AddForeignKey
ALTER TABLE "ClassArm" ADD CONSTRAINT "ClassArm_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacher" ADD CONSTRAINT "ClassTeacher_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "ClassArm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassResource" ADD CONSTRAINT "ClassResource_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "ClassArm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassResource" ADD CONSTRAINT "ClassResource_classLevelId_fkey" FOREIGN KEY ("classLevelId") REFERENCES "ClassLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_classLevelId_fkey" FOREIGN KEY ("classLevelId") REFERENCES "ClassLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Update unique constraints
-- Note: These constraints may fail if there are duplicate values
-- Drop existing unique constraints if they exist
ALTER TABLE "ClassArm" DROP CONSTRAINT IF EXISTS "ClassArm_classLevelId_name_key";
ALTER TABLE "ClassTeacher" DROP CONSTRAINT IF EXISTS "ClassTeacher_classId_teacherId_subject_key";
ALTER TABLE "Curriculum" DROP CONSTRAINT IF EXISTS "Curriculum_classId_subject_academicYear_termId_key";

-- Add new unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "ClassArm_classLevelId_name_academicYear_key" ON "ClassArm"("classLevelId", "name", "academicYear");
CREATE UNIQUE INDEX IF NOT EXISTS "ClassTeacher_classId_classArmId_teacherId_subject_key" ON "ClassTeacher"("classId", "classArmId", "teacherId", "subject");
CREATE UNIQUE INDEX IF NOT EXISTS "Curriculum_classId_classLevelId_subject_academicYear_termId_key" ON "Curriculum"("classId", "classLevelId", "subject", "academicYear", "termId");

