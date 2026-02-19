-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "classLevelId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "schoolType" TEXT;

-- CreateTable
CREATE TABLE "SubjectTeacher" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubjectTeacher_subjectId_idx" ON "SubjectTeacher"("subjectId");

-- CreateIndex
CREATE INDEX "SubjectTeacher_teacherId_idx" ON "SubjectTeacher"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectTeacher_subjectId_teacherId_key" ON "SubjectTeacher"("subjectId", "teacherId");

-- CreateIndex
CREATE INDEX "Subject_schoolType_idx" ON "Subject"("schoolType");

-- CreateIndex
CREATE INDEX "Subject_classLevelId_idx" ON "Subject"("classLevelId");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_classLevelId_fkey" FOREIGN KEY ("classLevelId") REFERENCES "ClassLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectTeacher" ADD CONSTRAINT "SubjectTeacher_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectTeacher" ADD CONSTRAINT "SubjectTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
