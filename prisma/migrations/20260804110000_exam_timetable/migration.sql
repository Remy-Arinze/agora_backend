-- Exam timetable slots + term publish metadata
ALTER TABLE "Term" ADD COLUMN IF NOT EXISTS "examTimetablePublishedAt" TIMESTAMP(3);
ALTER TABLE "Term" ADD COLUMN IF NOT EXISTS "examTimetablePublishedBy" TEXT;

CREATE TABLE IF NOT EXISTS "ExamTimetableSlot" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT,
    "classArmId" TEXT,
    "teacherId" TEXT,
    "roomId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamTimetableSlot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExamTimetableSlot_termId_idx" ON "ExamTimetableSlot"("termId");
CREATE INDEX IF NOT EXISTS "ExamTimetableSlot_examDate_idx" ON "ExamTimetableSlot"("examDate");
CREATE INDEX IF NOT EXISTS "ExamTimetableSlot_subjectId_idx" ON "ExamTimetableSlot"("subjectId");
CREATE INDEX IF NOT EXISTS "ExamTimetableSlot_classArmId_idx" ON "ExamTimetableSlot"("classArmId");
CREATE INDEX IF NOT EXISTS "ExamTimetableSlot_classId_idx" ON "ExamTimetableSlot"("classId");

ALTER TABLE "ExamTimetableSlot" ADD CONSTRAINT "ExamTimetableSlot_termId_fkey"
    FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamTimetableSlot" ADD CONSTRAINT "ExamTimetableSlot_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamTimetableSlot" ADD CONSTRAINT "ExamTimetableSlot_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamTimetableSlot" ADD CONSTRAINT "ExamTimetableSlot_classArmId_fkey"
    FOREIGN KEY ("classArmId") REFERENCES "ClassArm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamTimetableSlot" ADD CONSTRAINT "ExamTimetableSlot_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExamTimetableSlot" ADD CONSTRAINT "ExamTimetableSlot_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
