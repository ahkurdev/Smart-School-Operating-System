-- CreateTable
CREATE TABLE "Device" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "roomId" UUID,
    "assetId" UUID,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "battery" INTEGER,
    "signal" INTEGER,
    "firmware" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceTelemetry" (
    "id" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "unit" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceTelemetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "condition" JSONB,
    "action" TEXT NOT NULL,
    "actionConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" UUID NOT NULL,
    "schoolId" UUID,
    "event" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceId_key" ON "Device"("deviceId");

-- CreateIndex
CREATE INDEX "Device_schoolId_status_idx" ON "Device"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Device_schoolId_kind_idx" ON "Device"("schoolId", "kind");

-- CreateIndex
CREATE INDEX "DeviceTelemetry_deviceId_recordedAt_idx" ON "DeviceTelemetry"("deviceId", "recordedAt");

-- CreateIndex
CREATE INDEX "AutomationRule_schoolId_event_idx" ON "AutomationRule"("schoolId", "event");

-- CreateIndex
CREATE INDEX "EventLog_schoolId_event_createdAt_idx" ON "EventLog"("schoolId", "event", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_schoolId_severity_createdAt_idx" ON "Alert"("schoolId", "severity", "createdAt");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceTelemetry" ADD CONSTRAINT "DeviceTelemetry_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
