/*
  Warnings:

  - A unique constraint covering the columns `[publicId]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "publicId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Student_publicId_key" ON "Student"("publicId");

-- CreateIndex
CREATE INDEX "Student_publicId_idx" ON "Student"("publicId");
