-- CreateEnum
CREATE TYPE "PermissionResource" AS ENUM ('OVERVIEW', 'ANALYTICS', 'SUBSCRIPTIONS', 'STUDENTS', 'STAFF', 'CLASSES', 'SUBJECTS', 'TIMETABLES', 'CALENDAR', 'ADMISSIONS', 'SESSIONS', 'EVENTS');

-- CreateEnum
CREATE TYPE "PermissionType" AS ENUM ('READ', 'WRITE', 'ADMIN');

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "resource" "PermissionResource" NOT NULL,
    "type" "PermissionType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPermission" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Permission_resource_idx" ON "Permission"("resource");

-- CreateIndex
CREATE INDEX "Permission_type_idx" ON "Permission"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_resource_type_key" ON "Permission"("resource", "type");

-- CreateIndex
CREATE INDEX "StaffPermission_adminId_idx" ON "StaffPermission"("adminId");

-- CreateIndex
CREATE INDEX "StaffPermission_permissionId_idx" ON "StaffPermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPermission_adminId_permissionId_key" ON "StaffPermission"("adminId", "permissionId");

-- AddForeignKey
ALTER TABLE "StaffPermission" ADD CONSTRAINT "StaffPermission_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "SchoolAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPermission" ADD CONSTRAINT "StaffPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
