-- AlterTable
ALTER TABLE "School" ADD COLUMN     "hasPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasSecondary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasTertiary" BOOLEAN NOT NULL DEFAULT false;
