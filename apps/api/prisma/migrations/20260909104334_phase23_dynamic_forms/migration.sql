-- CreateTable
CREATE TABLE "DynamicForm" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "schema" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DynamicForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormResponse" (
    "id" UUID NOT NULL,
    "formId" UUID NOT NULL,
    "submittedBy" UUID,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DynamicForm_schoolId_isActive_idx" ON "DynamicForm"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "FormResponse_formId_createdAt_idx" ON "FormResponse"("formId", "createdAt");

-- AddForeignKey
ALTER TABLE "DynamicForm" ADD CONSTRAINT "DynamicForm_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_formId_fkey" FOREIGN KEY ("formId") REFERENCES "DynamicForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
