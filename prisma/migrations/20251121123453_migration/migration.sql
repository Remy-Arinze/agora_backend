/*
  Warnings:

  - The `role` column on the `SchoolAdmin` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "SchoolAdmin" DROP COLUMN "role",
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'Administrator';

-- DropEnum
DROP TYPE "AdminRole";

-- CreateIndex
CREATE INDEX "SchoolAdmin_role_idx" ON "SchoolAdmin"("role");
