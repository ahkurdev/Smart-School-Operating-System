-- CreateEnum
CREATE TYPE "PpdbStatus" AS ENUM ('REGISTERED', 'VERIFIED', 'SELECTED', 'ACCEPTED', 'REJECTED', 'ENROLLED');

-- CreateTable
CREATE TABLE "PpdbRegistration" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "regNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nisn" TEXT,
    "gender" "Gender" NOT NULL,
    "birthPlace" TEXT,
    "birthDate" DATE,
    "address" TEXT,
    "phone" TEXT,
    "parentName" TEXT,
    "parentPhone" TEXT,
    "originSchool" TEXT,
    "status" "PpdbStatus" NOT NULL DEFAULT 'REGISTERED',
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMP(3),
    "decidedBy" UUID,
    "decidedAt" TIMESTAMP(3),
    "enrolledStudentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PpdbRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PpdbRegistration_regNumber_key" ON "PpdbRegistration"("regNumber");

-- CreateIndex
CREATE INDEX "PpdbRegistration_schoolId_status_idx" ON "PpdbRegistration"("schoolId", "status");

-- CreateIndex
CREATE INDEX "PpdbRegistration_fullName_idx" ON "PpdbRegistration"("fullName");

-- AddForeignKey
ALTER TABLE "PpdbRegistration" ADD CONSTRAINT "PpdbRegistration_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
