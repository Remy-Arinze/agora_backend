-- Apply only the missing parts of 20241222120000_add_class_arms_optimization.
-- Run this ONCE against your DB (e.g. psql $DB_URL -f scripts/apply-missing-class-arms.sql)
-- Then run: npm run db:check-failed-migration (should all pass)
-- Then run: npm run db:resolve-failed-migration && npx prisma migrate deploy

-- 1. ClassResource.classLevelId column (idempotent: add if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ClassResource' AND column_name = 'classLevelId'
  ) THEN
    ALTER TABLE "ClassResource" ADD COLUMN "classLevelId" TEXT;
  END IF;
END $$;

-- 2. Index ClassResource_classLevelId_idx
CREATE INDEX IF NOT EXISTS "ClassResource_classLevelId_idx" ON "ClassResource"("classLevelId");

-- 3. FK ClassResource_classLevelId_fkey (only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_name = 'ClassResource_classLevelId_fkey'
  ) THEN
    ALTER TABLE "ClassResource"
      ADD CONSTRAINT "ClassResource_classLevelId_fkey"
      FOREIGN KEY ("classLevelId") REFERENCES "ClassLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Curriculum: drop old unique constraint, add new one (with classLevelId)
ALTER TABLE "Curriculum" DROP CONSTRAINT IF EXISTS "Curriculum_classId_subject_academicYear_termId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Curriculum_classId_classLevelId_subject_academicYear_termId_key"
  ON "Curriculum"("classId", "classLevelId", "subject", "academicYear", "termId");
