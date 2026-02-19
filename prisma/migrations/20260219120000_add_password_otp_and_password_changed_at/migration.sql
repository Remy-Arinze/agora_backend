-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "PasswordOtpType" AS ENUM ('CHANGE_PASSWORD', 'RESET_PASSWORD');

-- CreateTable
CREATE TABLE "PasswordOtp" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "PasswordOtpType" NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "otpCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordOtp_sessionId_key" ON "PasswordOtp"("sessionId");

-- CreateIndex
CREATE INDEX "PasswordOtp_userId_idx" ON "PasswordOtp"("userId");

-- CreateIndex
CREATE INDEX "PasswordOtp_email_idx" ON "PasswordOtp"("email");

-- CreateIndex
CREATE INDEX "PasswordOtp_sessionId_idx" ON "PasswordOtp"("sessionId");

-- CreateIndex
CREATE INDEX "PasswordOtp_type_idx" ON "PasswordOtp"("type");

-- CreateIndex
CREATE INDEX "PasswordOtp_expiresAt_idx" ON "PasswordOtp"("expiresAt");

-- AddForeignKey
ALTER TABLE "PasswordOtp" ADD CONSTRAINT "PasswordOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
