-- Composite and single-column indexes for scalability (dashboard, analytics, staff lists)
-- Safe to run: CREATE INDEX CONCURRENTLY in production is preferred; here we use standard CREATE INDEX

-- User: analytics counts by lastLoginAt and createdAt
CREATE INDEX IF NOT EXISTS "User_lastLoginAt_idx" ON "User"("lastLoginAt");
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");

-- Enrollment: dashboard filters (schoolId + isActive, schoolId + createdAt for trends)
CREATE INDEX IF NOT EXISTS "Enrollment_schoolId_isActive_idx" ON "Enrollment"("schoolId", "isActive");
CREATE INDEX IF NOT EXISTS "Enrollment_schoolId_createdAt_idx" ON "Enrollment"("schoolId", "createdAt");

-- Class: school admin dashboard (schoolId + type + isActive)
CREATE INDEX IF NOT EXISTS "Class_schoolId_type_isActive_idx" ON "Class"("schoolId", "type", "isActive");

-- AcademicSession: active session lookup by school
CREATE INDEX IF NOT EXISTS "AcademicSession_schoolId_status_idx" ON "AcademicSession"("schoolId", "status");

-- School: analytics distribution by isActive + createdAt
CREATE INDEX IF NOT EXISTS "School_isActive_createdAt_idx" ON "School"("isActive", "createdAt");
