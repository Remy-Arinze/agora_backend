-- CreateIndex
CREATE INDEX IF NOT EXISTS "Teacher_schoolId_createdAt_idx" ON "Teacher"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Class_schoolId_isActive_createdAt_idx" ON "Class"("schoolId", "isActive", "createdAt");
