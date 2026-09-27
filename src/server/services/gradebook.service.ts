import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize, can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Assessment + gradebook (Phases 61-65).
 *
 * Columns are `Assessment` rows (a quiz, exam, project… with a max score and a
 * weight). Cells are `Grade` rows. Grades move through
 * DRAFT -> SUBMITTED -> APPROVED -> PUBLISHED so nothing reaches a family until
 * it has been reviewed. Students and parents only ever see PUBLISHED grades.
 */

/**
 * Letter grade from a percentage. Configurable later; sensible default now.
 */
export function letterGrade(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

// ---------------------------------------------------------------------------
// Assessments (columns)
// ---------------------------------------------------------------------------

export async function listAssessments(actor: Actor, opts: { classroomId?: string; subjectId?: string; termId?: string } = {}) {
  authorize(actor, "grade.read");
  const tenantId = requireTenantId(actor);
  return prisma.assessment.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(opts.classroomId ? { classroomId: opts.classroomId } : {}),
      ...(opts.subjectId ? { subjectId: opts.subjectId } : {}),
      ...(opts.termId ? { termId: opts.termId } : {}),
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    include: {
      subject: { select: { name: true } },
      classroom: { select: { name: true } },
      _count: { select: { grades: true } },
    },
  });
}

export async function createAssessment(
  actor: Actor,
  input: { academicYearId: string; classroomId: string; subjectId: string; title: string; type?: string; maxScore?: number; weight?: number; termId?: string; scheduledAt?: Date },
) {
  authorize(actor, "grade.write");
  const tenantId = requireTenantId(actor);
  if (!input.title.trim()) throw Errors.validation("A title is required.");
  if (input.maxScore !== undefined && input.maxScore <= 0) throw Errors.validation("Max score must be positive.");
  if (input.weight !== undefined && input.weight < 0) throw Errors.validation("Weight cannot be negative.");

  const assessment = await prisma.assessment.create({
    data: {
      tenantId,
      academicYearId: input.academicYearId,
      classroomId: input.classroomId,
      subjectId: input.subjectId,
      termId: input.termId || null,
      title: input.title.trim(),
      type: (input.type as never) ?? "EXAM",
      maxScore: input.maxScore ?? 100,
      weight: input.weight ?? 1,
      scheduledAt: input.scheduledAt ?? null,
      status: "DRAFT",
    },
  });
  await recordAudit({ actor, action: "grade.assessment.create", resource: "Assessment", resourceId: assessment.id });
  return assessment;
}

// ---------------------------------------------------------------------------
// Gradebook (grid)
// ---------------------------------------------------------------------------

export type GradebookRow = {
  studentId: string;
  studentName: string;
  studentNumber: string;
  cells: Record<string, { gradeId: string | null; score: number | null; status: string }>;
  weightedAverage: number | null;
  letter: string | null;
};

/**
 * The gradebook for one class + term: every enrolled student (rows) against
 * every assessment (columns), with a weighted average per student. Weighted
 * average ignores ungraded cells so a partial term still shows a fair figure.
 */
export async function getGradebook(
  actor: Actor,
  opts: { classroomId: string; termId?: string; subjectId?: string },
): Promise<{ assessments: { id: string; title: string; maxScore: number; weight: number; type: string; status: string }[]; rows: GradebookRow[] }> {
  authorize(actor, "grade.read");
  const tenantId = requireTenantId(actor);

  const assessments = await prisma.assessment.findMany({
    where: {
      tenantId,
      deletedAt: null,
      classroomId: opts.classroomId,
      ...(opts.termId ? { termId: opts.termId } : {}),
      ...(opts.subjectId ? { subjectId: opts.subjectId } : {}),
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, maxScore: true, weight: true, type: true, status: true },
  });

  const enrollments = await prisma.enrollment.findMany({
    where: { tenantId, classroomId: opts.classroomId, status: "ACTIVE" },
    include: { student: { select: { id: true, fullName: true, studentNumber: true } } },
    orderBy: { student: { fullName: "asc" } },
  });

  const grades = await prisma.grade.findMany({
    where: { tenantId, assessmentId: { in: assessments.map((a) => a.id) } },
    select: { id: true, assessmentId: true, studentId: true, score: true, status: true },
  });
  const gradeIndex = new Map(grades.map((g) => [`${g.assessmentId}:${g.studentId}`, g]));

  const rows: GradebookRow[] = enrollments.map((e) => {
    const cells: GradebookRow["cells"] = {};
    let weightedSum = 0;
    let weightTotal = 0;
    for (const a of assessments) {
      const g = gradeIndex.get(`${a.id}:${e.student.id}`);
      cells[a.id] = { gradeId: g?.id ?? null, score: g?.score ?? null, status: g?.status ?? "NONE" };
      if (g?.score != null && a.maxScore > 0 && g.status !== "DRAFT") {
        const pct = g.score / a.maxScore;
        weightedSum += pct * a.weight;
        weightTotal += a.weight;
      }
    }
    const avg = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 10000) / 100 : null;
    return {
      studentId: e.student.id,
      studentName: e.student.fullName,
      studentNumber: e.student.studentNumber,
      cells,
      weightedAverage: avg,
      letter: avg != null ? letterGrade(avg) : null,
    };
  });

  return { assessments, rows };
}

/** Create or update one cell. Teachers enter DRAFT grades. */
export async function setGrade(actor: Actor, input: { assessmentId: string; studentId: string; score: number | null; remarks?: string }) {
  authorize(actor, "grade.write");
  const tenantId = requireTenantId(actor);
  const assessment = await prisma.assessment.findFirst({ where: { id: input.assessmentId, tenantId, deletedAt: null } });
  if (!assessment) throw Errors.notFound("Assessment not found.");
  if (input.score != null && (input.score < 0 || input.score > assessment.maxScore)) {
    throw Errors.validation(`Score must be between 0 and ${assessment.maxScore}.`);
  }
  const letter = input.score != null ? letterGrade((input.score / assessment.maxScore) * 100) : null;

  const grade = await prisma.grade.upsert({
    where: { assessmentId_studentId: { assessmentId: input.assessmentId, studentId: input.studentId } },
    update: { score: input.score, letterGrade: letter, remarks: input.remarks?.trim() || null, enteredByUserId: actor.userId },
    create: {
      tenantId,
      assessmentId: input.assessmentId,
      studentId: input.studentId,
      score: input.score,
      letterGrade: letter,
      remarks: input.remarks?.trim() || null,
      enteredByUserId: actor.userId,
      status: "DRAFT",
    },
  });
  return grade;
}

/** Bulk save a whole column's worth of cells (gradebook column save). */
export async function setGradesBulk(actor: Actor, assessmentId: string, entries: { studentId: string; score: number | null }[]) {
  authorize(actor, "grade.write");
  const tenantId = requireTenantId(actor);
  const assessment = await prisma.assessment.findFirst({ where: { id: assessmentId, tenantId, deletedAt: null } });
  if (!assessment) throw Errors.notFound("Assessment not found.");
  for (const e of entries) {
    if (e.score != null && (e.score < 0 || e.score > assessment.maxScore)) {
      throw Errors.validation(`A score is out of range (max ${assessment.maxScore}).`);
    }
  }
  await prisma.$transaction(
    entries.map((e) => {
      const letter = e.score != null ? letterGrade((e.score / assessment.maxScore) * 100) : null;
      return prisma.grade.upsert({
        where: { assessmentId_studentId: { assessmentId, studentId: e.studentId } },
        update: { score: e.score, letterGrade: letter, enteredByUserId: actor.userId },
        create: { tenantId, assessmentId, studentId: e.studentId, score: e.score, letterGrade: letter, enteredByUserId: actor.userId, status: "DRAFT" },
      });
    }),
  );
  await recordAudit({ actor, action: "grade.bulk_save", resource: "Assessment", resourceId: assessmentId });
  return { count: entries.length };
}

// ---------------------------------------------------------------------------
// Workflow: submit -> approve -> publish (Phases 63)
// ---------------------------------------------------------------------------

export async function submitGrades(actor: Actor, assessmentId: string) {
  authorize(actor, "grade.submit");
  const tenantId = requireTenantId(actor);
  const assessment = await prisma.assessment.findFirst({ where: { id: assessmentId, tenantId, deletedAt: null } });
  if (!assessment) throw Errors.notFound("Assessment not found.");
  const res = await prisma.grade.updateMany({
    where: { tenantId, assessmentId, status: "DRAFT" },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  await recordAudit({ actor, action: "grade.submit", resource: "Assessment", resourceId: assessmentId });
  return { count: res.count };
}

export async function approveGrades(actor: Actor, assessmentId: string) {
  authorize(actor, "grade.approve");
  const tenantId = requireTenantId(actor);
  const assessment = await prisma.assessment.findFirst({ where: { id: assessmentId, tenantId, deletedAt: null } });
  if (!assessment) throw Errors.notFound("Assessment not found.");
  const res = await prisma.grade.updateMany({
    where: { tenantId, assessmentId, status: "SUBMITTED" },
    data: { status: "APPROVED", approvedByUserId: actor.userId },
  });
  await recordAudit({ actor, action: "grade.approve", resource: "Assessment", resourceId: assessmentId });
  return { count: res.count };
}

export async function publishGrades(actor: Actor, assessmentId: string) {
  authorize(actor, "grade.publish");
  const tenantId = requireTenantId(actor);
  const assessment = await prisma.assessment.findFirst({ where: { id: assessmentId, tenantId, deletedAt: null } });
  if (!assessment) throw Errors.notFound("Assessment not found.");
  const res = await prisma.grade.updateMany({
    where: { tenantId, assessmentId, status: { in: ["SUBMITTED", "APPROVED"] } },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  // Publishing grades makes the assessment visible to families.
  await prisma.assessment.update({ where: { id: assessmentId }, data: { status: "PUBLISHED" } });
  await recordAudit({ actor, action: "grade.publish", resource: "Assessment", resourceId: assessmentId });
  return { count: res.count };
}

/**
 * A student's own published grades + weighted average (Phase 64 groundwork).
 * Only PUBLISHED rows are ever returned, so nothing leaks early.
 */
export async function getMyGrades(actor: Actor) {
  authorize(actor, "grade.read_own");
  const tenantId = requireTenantId(actor);
  const student = await prisma.student.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null } });
  if (!student) return { grades: [], average: null as number | null };

  const grades = await prisma.grade.findMany({
    where: { tenantId, studentId: student.id, status: "PUBLISHED" },
    include: { assessment: { select: { title: true, type: true, maxScore: true, weight: true, subject: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  let weightedSum = 0;
  let weightTotal = 0;
  for (const g of grades) {
    if (g.score != null && g.assessment.maxScore > 0) {
      weightedSum += (g.score / g.assessment.maxScore) * g.assessment.weight;
      weightTotal += g.assessment.weight;
    }
  }
  const average = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 10000) / 100 : null;

  return {
    grades: grades.map((g) => ({
      id: g.id,
      title: g.assessment.title,
      type: g.assessment.type,
      subject: g.assessment.subject.name,
      score: g.score,
      maxScore: g.assessment.maxScore,
      letter: g.letterGrade,
    })),
    average,
  };
}

/** A parent's view of a child's published grades. */
export async function getChildGrades(actor: Actor, studentId: string) {
  authorize(actor, "grade.read_own");
  const tenantId = requireTenantId(actor);
  // Only a linked guardian may read a child's grades.
  const guardian = await prisma.guardian.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null }, select: { id: true } });
  if (guardian) {
    const link = await prisma.studentGuardian.findFirst({ where: { guardianId: guardian.id, studentId } });
    if (!link && !can(actor, "grade.read")) throw Errors.forbidden("You are not linked to this student.");
  } else if (!can(actor, "grade.read")) {
    throw Errors.forbidden("You cannot view these grades.");
  }

  const grades = await prisma.grade.findMany({
    where: { tenantId, studentId, status: "PUBLISHED" },
    include: { assessment: { select: { title: true, maxScore: true, weight: true, subject: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return grades.map((g) => ({
    id: g.id,
    title: g.assessment.title,
    subject: g.assessment.subject.name,
    score: g.score,
    maxScore: g.assessment.maxScore,
    letter: g.letterGrade,
  }));
}
