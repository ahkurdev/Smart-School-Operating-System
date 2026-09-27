import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize, can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import { letterGrade } from "@/server/services/gradebook.service";
import type { Actor } from "@/types/actor";

/**
 * Report cards (Phase 66).
 *
 * A report card is a frozen snapshot: when generated it copies each subject's
 * weighted average and the student's attendance summary into its JSON columns,
 * so later grade edits never silently rewrite an issued report. It moves
 * DRAFT -> REVIEW -> PUBLISHED, and only PUBLISHED cards are visible to the
 * student or their guardian.
 */

export type ReportLine = { subject: string; average: number | null; letter: string | null; remarks?: string };
export type AttendanceSummary = { present: number; absent: number; late: number; excused: number; rate: number | null };

async function studentVisibleToActor(actor: Actor, tenantId: string, studentId: string): Promise<boolean> {
  if (can(actor, "grade.publish") || can(actor, "reporting.read")) return true;
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId, deletedAt: null }, select: { userId: true } });
  if (student?.userId === actor.userId) return true;
  const guardian = await prisma.guardian.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null }, select: { id: true } });
  if (guardian) {
    const link = await prisma.studentGuardian.findFirst({ where: { guardianId: guardian.id, studentId } });
    if (link) return true;
  }
  return false;
}

/** Compute the data a report card should carry, from live grades + attendance. */
async function computeSnapshot(actor: Actor, tenantId: string, studentId: string, termId?: string | null, academicYearIdFilter?: string) {
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId, deletedAt: null }, select: { id: true, fullName: true, studentNumber: true } });
  if (!student) throw Errors.notFound("Student not found.");

  const grades = await prisma.grade.findMany({
    where: {
      tenantId,
      studentId,
      status: "PUBLISHED",
      assessment: { deletedAt: null, ...(termId ? { termId } : {}) },
    },
    include: { assessment: { select: { maxScore: true, weight: true, subject: { select: { name: true } } } } },
  });

  const bySubject = new Map<string, { sum: number; weight: number }>();
  for (const g of grades) {
    if (g.score == null || g.assessment.maxScore <= 0) continue;
    const name = g.assessment.subject.name;
    const bucket = bySubject.get(name) ?? { sum: 0, weight: 0 };
    bucket.sum += (g.score / g.assessment.maxScore) * g.assessment.weight;
    bucket.weight += g.assessment.weight;
    bySubject.set(name, bucket);
  }
  const lines: ReportLine[] = [...bySubject.entries()].map(([subject, b]) => {
    const avg = b.weight > 0 ? Math.round((b.sum / b.weight) * 10000) / 100 : null;
    return { subject, average: avg, letter: avg != null ? letterGrade(avg) : null };
  });

  const records = await prisma.attendanceRecord.findMany({
    where: { tenantId, studentId, session: { academicYearId: academicYearIdFilter } },
    select: { status: true },
  });
  const summary: AttendanceSummary = { present: 0, absent: 0, late: 0, excused: 0, rate: null };
  for (const r of records) {
    if (r.status === "PRESENT") summary.present++;
    else if (r.status === "ABSENT") summary.absent++;
    else if (r.status === "LATE") summary.late++;
    else if (r.status === "EXCUSED") summary.excused++;
  }
  const total = summary.present + summary.absent + summary.late + summary.excused;
  summary.rate = total > 0 ? Math.round(((summary.present + summary.late) / total) * 10000) / 100 : null;

  return { student, lines, summary };
}

export async function generateReportCard(
  actor: Actor,
  input: { studentId: string; academicYearId: string; termId?: string; classroomId?: string; teacherRemarks?: string },
) {
  authorize(actor, "grade.publish");
  const tenantId = requireTenantId(actor);
  const { lines, summary } = await computeSnapshot(actor, tenantId, input.studentId, input.termId, input.academicYearId);

  // termId is nullable, so the compound unique can't be used in an upsert;
  // find the existing draft/published card for this student+year+term instead.
  const existing = await prisma.reportCard.findFirst({
    where: { tenantId, studentId: input.studentId, academicYearId: input.academicYearId, termId: input.termId ?? null },
    select: { id: true },
  });
  const data = {
    grades: lines as never,
    attendanceSummary: summary as never,
    classroomId: input.classroomId ?? null,
    teacherRemarks: input.teacherRemarks?.trim() || null,
    status: "DRAFT" as const,
  };
  const card = existing
    ? await prisma.reportCard.update({ where: { id: existing.id }, data })
    : await prisma.reportCard.create({
        data: { tenantId, studentId: input.studentId, academicYearId: input.academicYearId, termId: input.termId ?? null, ...data },
      });
  await recordAudit({ actor, action: "reportcard.generate", resource: "ReportCard", resourceId: card.id });
  return card;
}

export async function setReportCardStatus(actor: Actor, id: string, status: "DRAFT" | "REVIEW" | "PUBLISHED") {
  authorize(actor, "grade.publish");
  const tenantId = requireTenantId(actor);
  const card = await prisma.reportCard.findFirst({ where: { id, tenantId } });
  if (!card) throw Errors.notFound("Report card not found.");
  const updated = await prisma.reportCard.update({
    where: { id },
    data: { status, publishedAt: status === "PUBLISHED" ? (card.publishedAt ?? new Date()) : card.publishedAt },
  });
  await recordAudit({ actor, action: `reportcard.${status.toLowerCase()}`, resource: "ReportCard", resourceId: id });
  return updated;
}

export async function listReportCards(actor: Actor, opts: { classroomId?: string; termId?: string } = {}) {
  authorize(actor, "grade.publish");
  const tenantId = requireTenantId(actor);
  return prisma.reportCard.findMany({
    where: { tenantId, ...(opts.classroomId ? { classroomId: opts.classroomId } : {}), ...(opts.termId ? { termId: opts.termId } : {}) },
    orderBy: { updatedAt: "desc" },
    include: { student: { select: { fullName: true, studentNumber: true } }, term: { select: { name: true } } },
  });
}

/** A student's or guardian's own report cards — published only. */
export async function getMyReportCards(actor: Actor) {
  authorize(actor, "grade.read_own");
  const tenantId = requireTenantId(actor);

  // A guardian sees all their children's published cards; a student sees their own.
  const children: string[] = [];
  const student = await prisma.student.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null }, select: { id: true } });
  if (student) children.push(student.id);
  const guardian = await prisma.guardian.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null }, select: { id: true } });
  if (guardian) {
    const links = await prisma.studentGuardian.findMany({ where: { guardianId: guardian.id }, select: { studentId: true } });
    children.push(...links.map((l) => l.studentId));
  }
  if (children.length === 0) return [];

  return prisma.reportCard.findMany({
    where: { tenantId, studentId: { in: children }, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: { student: { select: { fullName: true } }, term: { select: { name: true } } },
  });
}

export async function getReportCard(actor: Actor, id: string) {
  const tenantId = requireTenantId(actor);
  const card = await prisma.reportCard.findFirst({
    where: { id, tenantId },
    include: { student: { select: { id: true, fullName: true, studentNumber: true } }, term: { select: { name: true } } },
  });
  if (!card) throw Errors.notFound("Report card not found.");
  const visible = await studentVisibleToActor(actor, tenantId, card.student.id);
  if (!visible) throw Errors.forbidden("You cannot view this report card.");
  if (card.status !== "PUBLISHED" && !can(actor, "grade.publish")) throw Errors.forbidden("This report card is not published yet.");
  return card;
}
