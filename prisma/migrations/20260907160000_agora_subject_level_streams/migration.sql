-- AlterTable
ALTER TABLE "NerdcSubject" ADD COLUMN "levelStreams" TEXT[] DEFAULT ARRAY[]::TEXT[];
