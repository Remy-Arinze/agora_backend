-- Cleanup orphan draft/archived sessions with no terms
DELETE FROM "AcademicSession" s
WHERE s.status IN ('DRAFT', 'ARCHIVED')
AND NOT EXISTS (SELECT 1 FROM "Term" t WHERE t."academicSessionId" = s.id);

-- Rename duplicate sessions so unique constraint can be applied (keep canonical row per group)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "schoolId", name, COALESCE("schoolType", '__NULL__')
      ORDER BY
        CASE status WHEN 'ACTIVE' THEN 0 WHEN 'COMPLETED' THEN 1 WHEN 'DRAFT' THEN 2 ELSE 3 END,
        "startDate" DESC,
        "createdAt" DESC
    ) AS rn
  FROM "AcademicSession"
)
UPDATE "AcademicSession" s
SET name = s.name || ' (legacy ' || SUBSTRING(s.id FROM 1 FOR 8) || ')'
FROM ranked r
WHERE s.id = r.id AND r.rn > 1;

-- Remaining draft/archived sessions become completed
UPDATE "AcademicSession"
SET status = 'COMPLETED'
WHERE status IN ('DRAFT', 'ARCHIVED');

-- Replace SessionStatus enum: drop DRAFT and ARCHIVED
CREATE TYPE "SessionStatus_new" AS ENUM ('ACTIVE', 'COMPLETED');

ALTER TABLE "AcademicSession"
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE "SessionStatus_new"
    USING (status::text::"SessionStatus_new");

ALTER TABLE "AcademicSession" ALTER COLUMN status SET DEFAULT 'ACTIVE';

DROP TYPE "SessionStatus";
ALTER TYPE "SessionStatus_new" RENAME TO "SessionStatus";

-- Restore unique session name per school type
DROP INDEX IF EXISTS "AcademicSession_schoolId_name_schoolType_idx";
CREATE UNIQUE INDEX "AcademicSession_schoolId_name_schoolType_key"
  ON "AcademicSession"("schoolId", name, "schoolType");
