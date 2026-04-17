/*
  Warnings:

  - You are about to drop the column `parsedContent` on the `AgoraCurriculumSource` table. All the data in the column will be lost.
  - You are about to drop the column `parsedContent` on the `SchoolCurriculumDoc` table. All the data in the column will be lost.
  - Added the required column `title` to the `AgoraCurriculumTopic` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "AgoraCurriculumSourceStatus" ADD VALUE 'FAILED';

-- AlterEnum
ALTER TYPE "SchemeOfWorkStatus" ADD VALUE 'FAILED';

-- AlterEnum
ALTER TYPE "SchoolCurriculumDocStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "AgoraCurriculumSource" DROP COLUMN "parsedContent",
ADD COLUMN     "parsedData" JSONB;

-- AlterTable
ALTER TABLE "AgoraCurriculumTopic" ADD COLUMN     "description" TEXT,
ADD COLUMN     "title" TEXT NOT NULL,
ALTER COLUMN "topic" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SchoolCurriculumDoc" DROP COLUMN "parsedContent",
ADD COLUMN     "parsedData" JSONB;
