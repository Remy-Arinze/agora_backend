-- AlterTable: Add profileImage and publicId to User (missing from add_image_fields migration)
-- IF NOT EXISTS so migration is idempotent when columns were added manually or by a previous run
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileImage" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "publicId" TEXT;
