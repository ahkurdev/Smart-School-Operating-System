import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize, can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Assignments + learning materials (Phases 59-60).
 *
 * Teachers create assignments for a class (title, instructions, due date,
 * attachment, max score) and publish them. Students submit work (text and/or a
 * file) and teachers grade with feedback. A teacher only ever sees and manages
 * the classes they teach; a student only sees their own submissions.
 */

async function teacherFor(tenantId: string, userId: string) {
  return prisma.teacher.findFirst({ where: { tenantId, userId, deletedAt: null }, select: { id: true } });
}

/** Class ids the actor is allowed to manage as a teacher. */
async function taughtClassIds(tenantId: string, userId: string): Promise<string[]> {
  const teacher = await teacherFor(tenantId, userId);
  if (!teacher) return [];
  const [entries, homerooms] = await Promise.all([
    prisma.timetableEntry.findMany({ where: { tenantId, teacherId: teacher.id }, select: { classroomId: true }, distinct: ["classroomId"] }),
    prisma.classroom.findMany({ where: { tenantId, homeroomTeacherId: teacher.id, deletedAt: null }, select: { id: true } }),
  ]);
  return [...new Set([...entries.map((e) => e.classroomId), ...homerooms.map((c) => c.id)])];
}

export async function listAssignments(actor: Actor, opts: { classroomId?: string } = {}) {
  authorize(actor, "assignment.read");
  const tenantId = requireTenantId(actor);
  // A teacher with manage rights is limited to their own classes.
  let classroomFilter: string[] | undefined;
  if (can(actor, "assignment.manage") && !can(actor, "grade.approve")) {
    classroomFilter = await taughtClassIds(tenantId, actor.userId);
  }
  return prisma.assignment.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(opts.classroomId ? { classroomId: opts.classroomId } : {}),
      ...(classroomFilter ? { classroomId: { in: classroomFilter } } : {}),
    },
    orderBy: [{ dueAt: "desc" }, { createdAt: "desc" }],
    include: {
      subject: { select: { name: true } },
      classroom: { select: { name: true } },
      _count: { select: { submissions: true } },
    },
  });
}

export async function createAssignment(
  actor: Actor,
  input: {
    classroomId: string;
    subjectId: string;
    title: string;
    instructions?: string;
    attachmentFileId?: string;
    dueAt?: Date;
    maxScore?: number;
    allowResubmission?: boolean;
  },
) {
  authorize(actor, "assignment.manage");
  const tenantId = requireTenantId(actor);
  if (!input.title.trim()) throw Errors.validation("A title is required.");
  if (input.maxScore !== undefined && input.maxScore <= 0) throw Errors.validation("Max score must be positive.");

  const [classroom, subject] = await Promise.all([
    prisma.classroom.findFirst({ where: { id: input.classroomId, tenantId, deletedAt: null } }),
    prisma.subject.findFirst({ where: { id: input.subjectId, tenantId } }),
  ]);
  if (!classroom) throw Errors.notFound("Class not found.");
  if (!subject) throw Errors.notFound("Subject not found.");

  // A teacher may only create work for classes they teach.
  if (!can(actor, "grade.approve")) {
    const taught = await taughtClassIds(tenantId, actor.userId);
    if (!taught.includes(input.classroomId)) throw Errors.forbidden("You do not teach this class.");
  }

  const teacher = await teacherFor(tenantId, actor.userId);
  const assignment = await prisma.assignment.create({
    data: {
      tenantId,
      classroomId: input.classroomId,
      subjectId: input.subjectId,
      teacherId: teacher?.id ?? null,
      title: input.title.trim(),
      instructions: input.instructions?.trim() || null,
      attachmentFileId: input.attachmentFileId || null,
      dueAt: input.dueAt ?? null,
      maxScore: input.maxScore ?? 100,
      allowResubmission: input.allowResubmission ?? false,
      status: "DRAFT",
    },
  });
  await recordAudit({ actor, action: "assignment.create", resource: "Assignment", resourceId: assignment.id });
  return assignment;
}

export async function setAssignmentStatus(actor: Actor, id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  authorize(actor, "assignment.manage");
  const tenantId = requireTenantId(actor);
  const assignment = await prisma.assignment.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!assignment) throw Errors.notFound("Assignment not found.");
  const updated = await prisma.assignment.update({
    where: { id },
    data: { status, publishedAt: status === "PUBLISHED" ? (assignment.publishedAt ?? new Date()) : assignment.publishedAt },
  });
  await recordAudit({ actor, action: `assignment.${status.toLowerCase()}`, resource: "Assignment", resourceId: id });
  return updated;
}

export async function getAssignment(actor: Actor, id: string) {
  authorize(actor, "assignment.read");
  const tenantId = requireTenantId(actor);
  const assignment = await prisma.assignment.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      subject: { select: { name: true } },
      classroom: { select: { id: true, name: true } },
      submissions: {
        include: { student: { select: { id: true, fullName: true, studentNumber: true } } },
        orderBy: { submittedAt: "desc" },
      },
    },
  });
  if (!assignment) throw Errors.notFound("Assignment not found.");
  return assignment;
}

/** The actor's own submission for an assignment (student view), if any. */
export async function getMySubmission(actor: Actor, assignmentId: string) {
  authorize(actor, "assignment.read");
  const tenantId = requireTenantId(actor);
  const student = await prisma.student.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null }, select: { id: true } });
  if (!student) return null;
  return prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
    select: { id: true, status: true, score: true },
  });
}

/** Student submits (or resubmits) work for an assignment in their class. */
export async function submitAssignment(
  actor: Actor,
  assignmentId: string,
  input: { content?: string; fileId?: string },
) {
  authorize(actor, "assignment.submit");
  const tenantId = requireTenantId(actor);
  const student = await prisma.student.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null } });
  if (!student) throw Errors.forbidden("Only students can submit work.");

  const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, tenantId, deletedAt: null } });
  if (!assignment) throw Errors.notFound("Assignment not found.");
  if (assignment.status !== "PUBLISHED") throw Errors.conflict("This assignment is not open for submissions.");

  // The student must be enrolled in the assignment's class.
  const enrolled = await prisma.enrollment.findFirst({
    where: { tenantId, studentId: student.id, classroomId: assignment.classroomId, status: "ACTIVE" },
  });
  if (!enrolled) throw Errors.forbidden("You are not enrolled in this class.");

  const existing = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
  });
  if (existing && !assignment.allowResubmission && existing.status !== "RETURNED") {
    throw Errors.conflict("You have already submitted. Resubmission is not allowed.");
  }

  const late = assignment.dueAt ? new Date() > assignment.dueAt : false;
  const status = existing ? "RESUBMITTED" : late ? "LATE" : "SUBMITTED";

  const submission = await prisma.assignmentSubmission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
    update: { content: input.content?.trim() || null, fileId: input.fileId || null, submittedAt: new Date(), status },
    create: {
      tenantId,
      assignmentId,
      studentId: student.id,
      content: input.content?.trim() || null,
      fileId: input.fileId || null,
      status,
    },
  });
  await recordAudit({ actor, action: "assignment.submit", resource: "AssignmentSubmission", resourceId: submission.id });
  return submission;
}

/** Teacher grades a submission. */
export async function gradeSubmission(
  actor: Actor,
  submissionId: string,
  input: { score: number; feedback?: string },
) {
  authorize(actor, "assignment.manage");
  const tenantId = requireTenantId(actor);
  const submission = await prisma.assignmentSubmission.findFirst({
    where: { id: submissionId, tenantId },
    include: { assignment: { select: { maxScore: true } } },
  });
  if (!submission) throw Errors.notFound("Submission not found.");
  if (input.score < 0 || input.score > submission.assignment.maxScore) {
    throw Errors.validation(`Score must be between 0 and ${submission.assignment.maxScore}.`);
  }
  const updated = await prisma.assignmentSubmission.update({
    where: { id: submissionId },
    data: {
      score: input.score,
      feedback: input.feedback?.trim() || null,
      status: "GRADED",
      gradedAt: new Date(),
      gradedByUserId: actor.userId,
    },
  });
  await recordAudit({ actor, action: "assignment.grade", resource: "AssignmentSubmission", resourceId: submissionId });
  return updated;
}

/** A student's own assignment views (what is due, what they submitted). */
export async function listMyAssignments(actor: Actor) {
  authorize(actor, "assignment.read");
  const tenantId = requireTenantId(actor);
  const student = await prisma.student.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null } });
  if (!student) return [];
  const enrollments = await prisma.enrollment.findMany({ where: { tenantId, studentId: student.id, status: "ACTIVE" }, select: { classroomId: true } });
  return prisma.assignment.findMany({
    where: { tenantId, deletedAt: null, status: "PUBLISHED", classroomId: { in: enrollments.map((e) => e.classroomId) } },
    orderBy: { dueAt: "asc" },
    include: {
      subject: { select: { name: true } },
      submissions: { where: { studentId: student.id }, select: { id: true, status: true, score: true, submittedAt: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Learning materials (Phase 60)
// ---------------------------------------------------------------------------

export async function listMaterials(actor: Actor, opts: { subjectId?: string; classroomId?: string } = {}) {
  authorize(actor, "material.read");
  const tenantId = requireTenantId(actor);
  return prisma.learningMaterial.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(opts.subjectId ? { subjectId: opts.subjectId } : {}),
      ...(opts.classroomId ? { classroomId: opts.classroomId } : {}),
      // Students only see published materials.
      ...(can(actor, "material.manage") ? {} : { status: "PUBLISHED" as const }),
    },
    orderBy: { updatedAt: "desc" },
    include: { subject: { select: { name: true } } },
  });
}

export async function createMaterial(
  actor: Actor,
  input: { subjectId: string; classroomId?: string; title: string; description?: string; type?: string; url?: string; fileId?: string; unit?: string; topic?: string },
) {
  authorize(actor, "material.manage");
  const tenantId = requireTenantId(actor);
  if (!input.title.trim()) throw Errors.validation("A title is required.");
  const subject = await prisma.subject.findFirst({ where: { id: input.subjectId, tenantId } });
  if (!subject) throw Errors.notFound("Subject not found.");
  const teacher = await teacherFor(tenantId, actor.userId);
  const material = await prisma.learningMaterial.create({
    data: {
      tenantId,
      subjectId: input.subjectId,
      classroomId: input.classroomId || null,
      teacherId: teacher?.id ?? null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      type: (input.type as never) ?? "DOCUMENT",
      url: input.url?.trim() || null,
      fileId: input.fileId || null,
      unit: input.unit?.trim() || null,
      topic: input.topic?.trim() || null,
      status: "DRAFT",
    },
  });
  await recordAudit({ actor, action: "material.create", resource: "LearningMaterial", resourceId: material.id });
  return material;
}

export async function setMaterialStatus(actor: Actor, id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  authorize(actor, "material.manage");
  const tenantId = requireTenantId(actor);
  const material = await prisma.learningMaterial.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!material) throw Errors.notFound("Material not found.");
  const updated = await prisma.learningMaterial.update({ where: { id }, data: { status } });
  await recordAudit({ actor, action: `material.${status.toLowerCase()}`, resource: "LearningMaterial", resourceId: id });
  return updated;
}

export async function deleteMaterial(actor: Actor, id: string) {
  authorize(actor, "material.manage");
  const tenantId = requireTenantId(actor);
  const material = await prisma.learningMaterial.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!material) throw Errors.notFound("Material not found.");
  await prisma.learningMaterial.update({ where: { id }, data: { deletedAt: new Date() } });
  await recordAudit({ actor, action: "material.delete", resource: "LearningMaterial", resourceId: id });
}
