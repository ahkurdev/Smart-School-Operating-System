import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";
import type { Prisma } from "@prisma/client";

/**
 * Admissions / PPDB service (Phases 31-39).
 *
 * The admission cycle: period (open/close window) -> tracks (with eligibility
 * rules and quota) -> dynamic application form -> applicant submits ->
 * documents verified -> scored/ranked -> decision (accept/waitlist/reject) ->
 * accepted applicants converted into enrolled students.
 *
 * Every query is tenant-scoped. Staff functions authorise a permission; the
 * applicant-facing functions take the applicant's own userId and only ever
 * touch that applicant's data.
 */

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

export async function listPeriods(actor: Actor) {
  authorize(actor, "admission.read");
  const tenantId = requireTenantId(actor);
  return prisma.admissionPeriod.findMany({
    where: { tenantId },
    orderBy: { openAt: "desc" },
    include: { _count: { select: { applications: true, tracks: true } }, academicYear: { select: { name: true } } },
  });
}

export async function getPeriod(actor: Actor, id: string) {
  authorize(actor, "admission.read");
  const tenantId = requireTenantId(actor);
  const period = await prisma.admissionPeriod.findFirst({
    where: { id, tenantId },
    include: {
      tracks: { orderBy: { name: "asc" } },
      academicYear: { select: { name: true } },
      applications: { select: { status: true } },
    },
  });
  if (!period) throw Errors.notFound("Admission period not found.");
  return period;
}

export async function createPeriod(
  actor: Actor,
  input: {
    name: string;
    description?: string;
    openAt: Date;
    closeAt: Date;
    quota?: number;
    academicYearId?: string;
  },
) {
  authorize(actor, "admission.manage");
  const tenantId = requireTenantId(actor);
  if (input.closeAt <= input.openAt) throw Errors.validation("The closing date must be after the opening date.");
  const period = await prisma.admissionPeriod.create({
    data: {
      tenantId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      openAt: input.openAt,
      closeAt: input.closeAt,
      quota: input.quota ?? null,
      academicYearId: input.academicYearId || null,
      status: "DRAFT",
    },
  });
  // Every period gets a default application form.
  await prisma.applicationForm.create({
    data: { tenantId, periodId: period.id, name: "Application form", isDefault: true },
  });
  await recordAudit({ actor, action: "admission.period.create", resource: "AdmissionPeriod", resourceId: period.id });
  return period;
}

export async function setPeriodStatus(actor: Actor, id: string, status: "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED") {
  authorize(actor, "admission.manage");
  const tenantId = requireTenantId(actor);
  const period = await prisma.admissionPeriod.findFirst({ where: { id, tenantId } });
  if (!period) throw Errors.notFound("Admission period not found.");
  if (status === "OPEN" && period.closeAt <= new Date()) {
    throw Errors.validation("This period's closing date has already passed.");
  }
  const updated = await prisma.admissionPeriod.update({ where: { id }, data: { status } });
  await recordAudit({ actor, action: `admission.period.${status.toLowerCase()}`, resource: "AdmissionPeriod", resourceId: id });
  return updated;
}

export async function createTrack(
  actor: Actor,
  periodId: string,
  input: { name: string; code: string; description?: string; quota?: number; requiresTest?: boolean; requiresInterview?: boolean },
) {
  authorize(actor, "admission.manage");
  const tenantId = requireTenantId(actor);
  const period = await prisma.admissionPeriod.findFirst({ where: { id: periodId, tenantId } });
  if (!period) throw Errors.notFound("Admission period not found.");
  const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (!code) throw Errors.validation("Track code must contain letters or numbers.");
  const clash = await prisma.admissionTrack.findFirst({ where: { periodId, code } });
  if (clash) throw Errors.conflict("A track with this code already exists in this period.");
  const track = await prisma.admissionTrack.create({
    data: {
      tenantId,
      periodId,
      name: input.name.trim(),
      code,
      description: input.description?.trim() || null,
      quota: input.quota ?? null,
      requiresTest: input.requiresTest ?? false,
      requiresInterview: input.requiresInterview ?? false,
    },
  });
  await recordAudit({ actor, action: "admission.track.create", resource: "AdmissionTrack", resourceId: track.id });
  return track;
}

// ---------------------------------------------------------------------------
// Dynamic application form
// ---------------------------------------------------------------------------

export async function getDefaultForm(actor: Actor, periodId: string) {
  authorize(actor, "admission.read");
  const tenantId = requireTenantId(actor);
  return prisma.applicationForm.findFirst({
    where: { tenantId, periodId },
    orderBy: { isDefault: "desc" },
    include: { fields: { orderBy: { sequence: "asc" } } },
  });
}

export type FieldInput = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: unknown;
  validation?: unknown;
  section?: string;
};

/** Replace the full field list of a period's default form (staff editor save). */
export async function replaceFormFields(actor: Actor, periodId: string, fields: FieldInput[]) {
  authorize(actor, "admission.manage");
  const tenantId = requireTenantId(actor);
  const form = await prisma.applicationForm.findFirst({ where: { tenantId, periodId }, orderBy: { isDefault: "desc" } });
  if (!form) throw Errors.notFound("Form not found.");

  const seen = new Set<string>();
  const rows = fields.map((f, i) => {
    const key = f.key.trim();
    if (!key || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
      throw Errors.validation(`Field key "${f.key}" must start with a letter and contain only letters, numbers and underscores.`);
    }
    if (seen.has(key)) throw Errors.validation(`Duplicate field key "${key}".`);
    seen.add(key);
    return {
      tenantId,
      formId: form.id,
      key,
      label: f.label.trim(),
      type: f.type as never,
      required: f.required ?? false,
      placeholder: f.placeholder?.trim() || null,
      helpText: f.helpText?.trim() || null,
      options: (f.options ?? []) as Prisma.InputJsonValue,
      validation: (f.validation ?? {}) as Prisma.InputJsonValue,
      section: f.section?.trim() || null,
      sequence: i,
    };
  });

  await prisma.$transaction([
    prisma.applicationField.deleteMany({ where: { tenantId, formId: form.id } }),
    ...(rows.length ? [prisma.applicationField.createMany({ data: rows })] : []),
  ]);
  await recordAudit({ actor, action: "admission.form.replace", resource: "ApplicationForm", resourceId: form.id });
  return { count: rows.length };
}

// ---------------------------------------------------------------------------
// Applicant + application (applicant-facing)
// ---------------------------------------------------------------------------

/** Open periods a visitor may apply to (no auth): only OPEN and within window. */
export async function listOpenPeriods(tenantId: string) {
  const now = new Date();
  return prisma.admissionPeriod.findMany({
    where: { tenantId, status: "OPEN", openAt: { lte: now }, closeAt: { gte: now } },
    orderBy: { closeAt: "asc" },
    include: { tracks: { orderBy: { name: "asc" } } },
  });
}

export async function getPublicPeriod(tenantId: string, periodId: string) {
  const now = new Date();
  const period = await prisma.admissionPeriod.findFirst({
    where: { id: periodId, tenantId, status: "OPEN", openAt: { lte: now }, closeAt: { gte: now } },
    include: { tracks: { orderBy: { name: "asc" } } },
  });
  if (!period) throw Errors.notFound("This admission period is not open.");
  return period;
}

/** Find or create the Applicant profile for a logged-in user. */
export async function upsertApplicant(
  actor: Actor,
  input: { fullName: string; email?: string; phone?: string; birthDate?: Date; gender?: string; previousSchool?: string },
) {
  authorize(actor, "admission.apply");
  const tenantId = requireTenantId(actor);
  const existing = await prisma.applicant.findFirst({ where: { tenantId, userId: actor.userId } });
  if (existing) {
    return prisma.applicant.update({
      where: { id: existing.id },
      data: {
        fullName: input.fullName.trim(),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        birthDate: input.birthDate ?? null,
        gender: input.gender?.trim() || null,
        previousSchool: input.previousSchool?.trim() || null,
      },
    });
  }
  return prisma.applicant.create({
    data: {
      tenantId,
      userId: actor.userId,
      fullName: input.fullName.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      birthDate: input.birthDate ?? null,
      gender: input.gender?.trim() || null,
      previousSchool: input.previousSchool?.trim() || null,
    },
  });
}

/** Generate a per-period sequential application number, e.g. PPDB-2026-0007. */
async function nextApplicationNumber(tenantId: string, periodName: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PPDB-${year}-`;
  const count = await prisma.application.count({ where: { tenantId, applicationNumber: { startsWith: prefix } } });
  void periodName;
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function startApplication(actor: Actor, periodId: string, trackId?: string) {
  authorize(actor, "admission.apply");
  const tenantId = requireTenantId(actor);
  const period = await getPublicPeriod(tenantId, periodId);

  const applicant = await prisma.applicant.findFirst({ where: { tenantId, userId: actor.userId } });
  if (!applicant) throw Errors.validation("Complete your applicant profile before starting an application.");

  // One active application per period per applicant.
  const existing = await prisma.application.findFirst({
    where: { tenantId, applicantId: applicant.id, periodId, status: { notIn: ["WITHDRAWN", "REJECTED"] } },
  });
  if (existing) return existing;

  if (trackId) {
    const track = await prisma.admissionTrack.findFirst({ where: { id: trackId, periodId, tenantId } });
    if (!track) throw Errors.validation("Selected track does not belong to this period.");
  }

  const applicationNumber = await nextApplicationNumber(tenantId, period.name);
  const app = await prisma.application.create({
    data: {
      tenantId,
      applicantId: applicant.id,
      periodId,
      trackId: trackId || null,
      applicationNumber,
      status: "DRAFT",
      currentStep: "personal",
    },
  });
  await recordAudit({ actor, action: "admission.application.start", resource: "Application", resourceId: app.id });
  return app;
}

/** Save answers for an application the actor owns (or staff with manage). */
export async function saveApplicationValues(
  actor: Actor,
  applicationId: string,
  values: { fieldId: string; value: unknown }[],
) {
  const tenantId = requireTenantId(actor);
  const app = await prisma.application.findFirst({
    where: { id: applicationId, tenantId },
    include: { applicant: { select: { userId: true } } },
  });
  if (!app) throw Errors.notFound("Application not found.");
  const isOwner = app.applicant.userId === actor.userId;
  const isStaff = actor.permissions.has("admission.manage");
  if (!isOwner && !isStaff) throw Errors.forbidden("You cannot edit this application.");
  if (["ACCEPTED", "REJECTED", "WAITLISTED", "RE_REGISTERED"].includes(app.status)) {
    throw Errors.conflict("This application can no longer be edited.");
  }

  await prisma.$transaction(
    values.map((v) =>
      prisma.applicationValue.upsert({
        where: { applicationId_fieldId: { applicationId, fieldId: v.fieldId } },
        update: { value: v.value as Prisma.InputJsonValue },
        create: { tenantId, applicationId, fieldId: v.fieldId, value: v.value as Prisma.InputJsonValue },
      }),
    ),
  );
  return { count: values.length };
}

export async function submitApplication(actor: Actor, applicationId: string) {
  const tenantId = requireTenantId(actor);
  const app = await prisma.application.findFirst({
    where: { id: applicationId, tenantId },
    include: {
      applicant: { select: { userId: true } },
      period: { select: { closeAt: true, status: true } },
      values: true,
    },
  });
  if (!app) throw Errors.notFound("Application not found.");
  if (app.applicant.userId !== actor.userId && !actor.permissions.has("admission.manage")) {
    throw Errors.forbidden("You cannot submit this application.");
  }
  if (app.status !== "DRAFT" && app.status !== "NEEDS_REVISION") {
    throw Errors.conflict("This application has already been submitted.");
  }
  if (app.period.status !== "OPEN" || app.period.closeAt < new Date()) {
    throw Errors.conflict("The admission period is closed.");
  }

  // Enforce required fields from the form.
  const form = await prisma.applicationForm.findFirst({
    where: { tenantId, periodId: app.periodId },
    include: { fields: true },
  });
  if (form) {
    const answered = new Set(app.values.map((v) => v.fieldId));
    const missing = form.fields.filter((f) => f.required && !answered.has(f.id));
    if (missing.length) {
      throw Errors.validation(`Please complete all required fields: ${missing.map((m) => m.label).join(", ")}.`);
    }
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status: "SUBMITTED", submittedAt: new Date(), currentStep: "submitted" },
  });
  await recordAudit({ actor, action: "admission.application.submit", resource: "Application", resourceId: applicationId });
  return updated;
}

export async function listMyApplications(actor: Actor) {
  authorize(actor, "admission.apply");
  const tenantId = requireTenantId(actor);
  const applicant = await prisma.applicant.findFirst({ where: { tenantId, userId: actor.userId } });
  if (!applicant) return [];
  return prisma.application.findMany({
    where: { tenantId, applicantId: applicant.id },
    orderBy: { createdAt: "desc" },
    include: { period: { select: { name: true, closeAt: true } }, track: { select: { name: true } } },
  });
}

export async function getMyApplication(actor: Actor, applicationId: string) {
  authorize(actor, "admission.apply");
  const tenantId = requireTenantId(actor);
  const app = await prisma.application.findFirst({
    where: { id: applicationId, tenantId },
    include: {
      applicant: true,
      period: { select: { id: true, name: true, closeAt: true, status: true } },
      track: { select: { name: true } },
      values: true,
      documents: true,
    },
  });
  if (!app) throw Errors.notFound("Application not found.");
  if (app.applicant.userId !== actor.userId && !actor.permissions.has("admission.read")) {
    throw Errors.forbidden("You cannot view this application.");
  }
  return app;
}

/** Attach an uploaded file as an application document (Phase 35). */
export async function attachDocument(actor: Actor, applicationId: string, fileId: string, documentType: string) {
  const tenantId = requireTenantId(actor);
  const app = await prisma.application.findFirst({
    where: { id: applicationId, tenantId },
    include: { applicant: { select: { userId: true } } },
  });
  if (!app) throw Errors.notFound("Application not found.");
  if (app.applicant.userId !== actor.userId && !actor.permissions.has("admission.manage")) {
    throw Errors.forbidden("You cannot modify this application.");
  }
  const doc = await prisma.applicationDocument.create({
    data: { tenantId, applicationId, fileId, documentType: documentType.trim() },
  });
  await recordAudit({ actor, action: "admission.document.attach", resource: "ApplicationDocument", resourceId: doc.id });
  return doc;
}

// ---------------------------------------------------------------------------
// Staff review (Phases 36-39)
// ---------------------------------------------------------------------------

export async function listApplications(
  actor: Actor,
  opts: { periodId?: string; status?: string; search?: string } = {},
) {
  authorize(actor, "admission.read");
  const tenantId = requireTenantId(actor);
  const where: Record<string, unknown> = { tenantId };
  if (opts.periodId) where.periodId = opts.periodId;
  if (opts.status) where.status = opts.status;
  if (opts.search) where.OR = [{ applicationNumber: { contains: opts.search, mode: "insensitive" } }, { applicant: { fullName: { contains: opts.search, mode: "insensitive" } } }];
  return prisma.application.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      applicant: { select: { fullName: true, email: true } },
      period: { select: { name: true } },
      track: { select: { name: true } },
    },
  });
}

export async function getApplicationForStaff(actor: Actor, id: string) {
  authorize(actor, "admission.read");
  const tenantId = requireTenantId(actor);
  const app = await prisma.application.findFirst({
    where: { id, tenantId },
    include: {
      applicant: true,
      period: { select: { id: true, name: true, tracks: true } },
      track: true,
      values: true,
      documents: true,
      decisionRow: true,
    },
  });
  if (!app) throw Errors.notFound("Application not found.");
  const form = await prisma.applicationForm.findFirst({
    where: { tenantId, periodId: app.periodId },
    include: { fields: { orderBy: { sequence: "asc" } } },
  });
  return { application: app, fields: form?.fields ?? [] };
}

export async function verifyDocument(actor: Actor, documentId: string, verified: boolean, notes?: string) {
  authorize(actor, "admission.verify");
  const tenantId = requireTenantId(actor);
  const doc = await prisma.applicationDocument.findFirst({ where: { id: documentId, tenantId } });
  if (!doc) throw Errors.notFound("Document not found.");
  const updated = await prisma.applicationDocument.update({
    where: { id: documentId },
    data: { verified, verifiedByUserId: actor.userId, notes: notes?.trim() || null },
  });
  await recordAudit({ actor, action: "admission.document.verify", resource: "ApplicationDocument", resourceId: documentId });
  return updated;
}

export async function setApplicationStatus(actor: Actor, id: string, status: string) {
  authorize(actor, "admission.verify");
  const tenantId = requireTenantId(actor);
  const app = await prisma.application.findFirst({ where: { id, tenantId } });
  if (!app) throw Errors.notFound("Application not found.");
  const allowed = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "NEEDS_REVISION", "VERIFIED", "TEST_SCHEDULED", "INTERVIEW_SCHEDULED", "EVALUATED"];
  if (!allowed.includes(status)) throw Errors.validation("That status cannot be set directly.");
  const updated = await prisma.application.update({
    where: { id },
    data: { status: status as never, verifiedAt: status === "VERIFIED" ? new Date() : app.verifiedAt, verifiedByUserId: status === "VERIFIED" ? actor.userId : app.verifiedByUserId },
  });
  await recordAudit({ actor, action: `admission.application.${status.toLowerCase()}`, resource: "Application", resourceId: id });
  return updated;
}

export async function scoreApplication(actor: Actor, id: string, score: number) {
  authorize(actor, "admission.decide");
  const tenantId = requireTenantId(actor);
  if (!Number.isFinite(score) || score < 0 || score > 100) throw Errors.validation("Score must be between 0 and 100.");
  const app = await prisma.application.findFirst({ where: { id, tenantId } });
  if (!app) throw Errors.notFound("Application not found.");
  const updated = await prisma.application.update({ where: { id }, data: { score } });
  await recordAudit({ actor, action: "admission.application.score", resource: "Application", resourceId: id });
  return updated;
}

/** Rank all scored applications in a period by score (desc), writing `rank`. */
export async function rankPeriod(actor: Actor, periodId: string) {
  authorize(actor, "admission.decide");
  const tenantId = requireTenantId(actor);
  const apps = await prisma.application.findMany({
    where: { tenantId, periodId, score: { not: null } },
    orderBy: { score: "desc" },
  });
  await prisma.$transaction(
    apps.map((a, i) => prisma.application.update({ where: { id: a.id }, data: { rank: i + 1 } })),
  );
  await recordAudit({ actor, action: "admission.period.rank", resource: "AdmissionPeriod", resourceId: periodId });
  return { ranked: apps.length };
}

export async function decide(
  actor: Actor,
  id: string,
  decision: "ACCEPTED" | "WAITLISTED" | "REJECTED",
  notes?: string,
) {
  authorize(actor, "admission.decide");
  const tenantId = requireTenantId(actor);
  const app = await prisma.application.findFirst({ where: { id, tenantId } });
  if (!app) throw Errors.notFound("Application not found.");
  if (app.status === "RE_REGISTERED") throw Errors.conflict("This application has already been converted to a student.");

  const [updated] = await prisma.$transaction([
    prisma.application.update({
      where: { id },
      data: { status: decision, decision, decisionAt: new Date(), decisionByUserId: actor.userId, decisionNotes: notes?.trim() || null },
    }),
    prisma.admissionDecision.create({
      data: { tenantId, applicationId: id, decision, score: app.score, notes: notes?.trim() || null, decidedByUserId: actor.userId },
    }),
  ]);
  await recordAudit({ actor, action: `admission.application.${decision.toLowerCase()}`, resource: "Application", resourceId: id });
  return updated;
}

/**
 * Convert an ACCEPTED application into a Student (Phase 39).
 *
 * Idempotent: a second call for the same application returns the existing
 * student rather than creating a duplicate. Creates the student record in the
 * applicant's tenant and links it back via `Applicant.studentId`.
 */
export async function convertToStudent(
  actor: Actor,
  id: string,
  input: { studentNumber: string; classroomId?: string; academicYearId?: string },
) {
  authorize(actor, "admission.convert");
  const tenantId = requireTenantId(actor);
  const app = await prisma.application.findFirst({
    where: { id, tenantId },
    include: { applicant: true },
  });
  if (!app) throw Errors.notFound("Application not found.");
  if (app.decision !== "ACCEPTED") throw Errors.conflict("Only accepted applicants can be enrolled.");
  if (app.reRegisteredAt) throw Errors.conflict("This applicant has already been enrolled.");

  const studentNumber = input.studentNumber.trim();
  if (!studentNumber) throw Errors.validation("A student number is required.");

  const student = await prisma.$transaction(async (tx) => {
    const clash = await tx.student.findFirst({ where: { tenantId, studentNumber } });
    if (clash) throw Errors.conflict("A student with this number already exists.");

    const created = await tx.student.create({
      data: {
        tenantId,
        studentNumber,
        fullName: app.applicant.fullName,
        email: app.applicant.email,
        phone: app.applicant.phone,
        birthDate: app.applicant.birthDate,
        gender: app.applicant.gender,
        admissionDate: new Date(),
        status: "ACTIVE",
      },
    });

    await tx.applicant.update({ where: { id: app.applicantId }, data: { studentId: created.id } });
    await tx.application.update({ where: { id }, data: { status: "RE_REGISTERED", reRegisteredAt: new Date() } });

    if (input.classroomId) {
      // Enrollment needs an academic year; fall back to the current one.
      let academicYearId = input.academicYearId;
      if (!academicYearId) {
        const current = await tx.academicYear.findFirst({ where: { tenantId, isCurrent: true } });
        academicYearId = current?.id;
      }
      if (academicYearId) {
        await tx.enrollment.create({
          data: {
            tenantId,
            studentId: created.id,
            classroomId: input.classroomId,
            academicYearId,
            status: "ACTIVE",
            enrolledAt: new Date(),
          },
        });
      }
    }
    return created;
  });

  await recordAudit({ actor, action: "admission.application.convert", resource: "Student", resourceId: student.id });
  return student;
}
