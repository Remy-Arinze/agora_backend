CREATE TABLE IF NOT EXISTS "InAppNotification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "schoolId" TEXT,
  "role" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "link" TEXT,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InAppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "InAppNotification_userId_readAt_createdAt_idx" ON "InAppNotification"("userId", "readAt", "createdAt");
CREATE INDEX IF NOT EXISTS "InAppNotification_userId_createdAt_idx" ON "InAppNotification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "InAppNotification_schoolId_createdAt_idx" ON "InAppNotification"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "InAppNotification_type_idx" ON "InAppNotification"("type");

CREATE TABLE IF NOT EXISTS "WebPushSubscription" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "WebPushSubscription_userId_idx" ON "WebPushSubscription"("userId");
