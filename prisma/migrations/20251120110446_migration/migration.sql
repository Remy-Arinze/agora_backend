/*
  Warnings:

  - A unique constraint covering the columns `[schoolId]` on the table `School` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('PRINCIPAL', 'BURSAR', 'GUIDANCE_COUNSELOR', 'VICE_PRINCIPAL', 'ADMINISTRATOR');

-- DropIndex
DROP INDEX "SchoolAdmin_schoolId_key";

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "schoolId" TEXT;

-- AlterTable
ALTER TABLE "SchoolAdmin" ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'ADMINISTRATOR';

-- CreateIndex
CREATE UNIQUE INDEX "School_schoolId_key" ON "School"("schoolId");

-- CreateIndex
CREATE INDEX "School_schoolId_idx" ON "School"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolAdmin_schoolId_idx" ON "SchoolAdmin"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolAdmin_role_idx" ON "SchoolAdmin"("role");
