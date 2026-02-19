/*
  Warnings:

  - A unique constraint covering the columns `[adminId]` on the table `SchoolAdmin` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[teacherId]` on the table `Teacher` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `adminId` to the `SchoolAdmin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `teacherId` to the `Teacher` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SchoolAdmin" ADD COLUMN     "adminId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "teacherId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SchoolAdmin_adminId_key" ON "SchoolAdmin"("adminId");

-- CreateIndex
CREATE INDEX "SchoolAdmin_adminId_idx" ON "SchoolAdmin"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_teacherId_key" ON "Teacher"("teacherId");

-- CreateIndex
CREATE INDEX "Teacher_teacherId_idx" ON "Teacher"("teacherId");
