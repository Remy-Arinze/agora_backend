-- DropIndex
DROP INDEX "AcademicSession_schoolId_name_schoolType_key";

-- CreateIndex
CREATE INDEX "AcademicSession_schoolId_name_schoolType_idx" ON "AcademicSession"("schoolId", "name", "schoolType");
