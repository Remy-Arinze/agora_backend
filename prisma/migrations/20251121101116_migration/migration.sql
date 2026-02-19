/*
  Warnings:

  - A unique constraint covering the columns `[publicId]` on the table `SchoolAdmin` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,schoolId]` on the table `SchoolAdmin` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[publicId]` on the table `Teacher` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,schoolId]` on the table `Teacher` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `publicId` to the `SchoolAdmin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `publicId` to the `Teacher` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "SchoolAdmin_userId_key";

-- DropIndex
DROP INDEX "Teacher_userId_key";

-- AlterTable
ALTER TABLE "SchoolAdmin" ADD COLUMN     "publicId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "publicId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SchoolAdmin_publicId_key" ON "SchoolAdmin"("publicId");

-- CreateIndex
CREATE INDEX "SchoolAdmin_publicId_idx" ON "SchoolAdmin"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolAdmin_userId_schoolId_key" ON "SchoolAdmin"("userId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_publicId_key" ON "Teacher"("publicId");

-- CreateIndex
CREATE INDEX "Teacher_publicId_idx" ON "Teacher"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_userId_schoolId_key" ON "Teacher"("userId", "schoolId");
