-- SchemeOfWork.archivedAt/archivedBy/activeKey were added in
-- 20260907140000_curriculum_spine_and_bud, but ARCHIVED was never
-- added to the Postgres enum. Queries with status <> 'ARCHIVED' then fail.

ALTER TYPE "SchemeOfWorkStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
