-- CreateEnum
CREATE TYPE "ScholarshipStatus" AS ENUM ('APPLIED', 'VERIFIED', 'REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('GOOD', 'NEEDS_REPAIR', 'DAMAGED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "EmployeeKind" AS ENUM ('TEACHER', 'STAFF');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ScholarshipProgram" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "criteria" JSONB,
    "quota" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ScholarshipProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScholarshipApplication" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "ScholarshipStatus" NOT NULL DEFAULT 'APPLIED',
    "documents" JSONB,
    "reviewNotes" TEXT,
    "decidedBy" UUID,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ScholarshipApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "serialNumber" TEXT,
    "roomId" UUID,
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "purchaseDate" DATE,
    "value" DECIMAL(14,2),
    "vendor" TEXT,
    "warrantyUntil" DATE,
    "qrPayload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMaintenance" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cost" DECIMAL(12,2),
    "handledBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AssetMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "userId" UUID,
    "nip" TEXT,
    "kind" "EmployeeKind" NOT NULL DEFAULT 'TEACHER',
    "fullName" TEXT NOT NULL,
    "position" TEXT,
    "department" TEXT,
    "qualification" TEXT,
    "certification" TEXT,
    "joinedAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLeave" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeLeave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScholarshipProgram_schoolId_name_period_key" ON "ScholarshipProgram"("schoolId", "name", "period");

-- CreateIndex
CREATE INDEX "ScholarshipApplication_status_idx" ON "ScholarshipApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ScholarshipApplication_programId_studentId_key" ON "ScholarshipApplication"("programId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_code_key" ON "Asset"("code");

-- CreateIndex
CREATE INDEX "Asset_schoolId_category_idx" ON "Asset"("schoolId", "category");

-- CreateIndex
CREATE INDEX "Asset_schoolId_condition_idx" ON "Asset"("schoolId", "condition");

-- CreateIndex
CREATE INDEX "AssetMaintenance_assetId_idx" ON "AssetMaintenance"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_nip_key" ON "Employee"("nip");

-- CreateIndex
CREATE INDEX "Employee_schoolId_kind_idx" ON "Employee"("schoolId", "kind");

-- CreateIndex
CREATE INDEX "EmployeeLeave_employeeId_idx" ON "EmployeeLeave"("employeeId");

-- AddForeignKey
ALTER TABLE "ScholarshipProgram" ADD CONSTRAINT "ScholarshipProgram_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScholarshipApplication" ADD CONSTRAINT "ScholarshipApplication_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ScholarshipProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScholarshipApplication" ADD CONSTRAINT "ScholarshipApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeave" ADD CONSTRAINT "EmployeeLeave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
