-- School working days (instructional weekdays)
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "workingDays" "DayOfWeek"[] DEFAULT ARRAY['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY']::"DayOfWeek"[];

-- Term midterm assessment + end-of-term exam windows
ALTER TABLE "Term" ADD COLUMN IF NOT EXISTS "midtermStart" TIMESTAMP(3);
ALTER TABLE "Term" ADD COLUMN IF NOT EXISTS "midtermEnd" TIMESTAMP(3);
ALTER TABLE "Term" ADD COLUMN IF NOT EXISTS "examStart" TIMESTAMP(3);
ALTER TABLE "Term" ADD COLUMN IF NOT EXISTS "examEnd" TIMESTAMP(3);
