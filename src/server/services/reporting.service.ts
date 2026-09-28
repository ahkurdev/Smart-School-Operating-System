import { prisma } from "@/server/db/client";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import type { Actor } from "@/types/actor";

/**
 * Reporting, analytics & academic risk (Phases 81-83).
 *
 * Aggregations run over the tenant's own data only. Everything here is a plain
 * read model - no mutation - so the same functions back the analytics dashboard,
 * the reporting engine, and (via the AI tool layer) the assistant.
 *
 * IMPORTANT: academic "risk" is an indicator, never a prediction or a diagnosis.
 * Output always names the contributing factors and the data period so a human
 * can review it, per the risk-analytics rule.
 */

// --- Attendance analytics ----------------------------------------------------

export async function attendanceTrend(actor: Actor, opts: { from: Date; to: Date; classroomId?: string }) {
  authorize(actor, "reporting.read");
  const tenantId = requireTenantId(actor);
  const records = await prisma.attendanceRecord.findMany({
    where: {
      tenantId,
      session: { ...(opts.classroomId ? { classroomId: opts.classroomId } : {}), sessionDate: { gte: opts.from, lte: opts.to } },
    },
    select: { status: true, session: { select: { sessionDate: true } } },
  });

  const byDay = new Map<string, { total: number; present: number }>();
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;
  for (const r of records) {
    const day = r.session.sessionDate.toISOString().slice(0, 10);
    const entry = byDay.get(day) ?? { total: 0, present: 0 };
    entry.total++;
    if (r.status === "PRESENT" || r.status === "LATE") entry.present++;
    byDay.set(day, entry);

    if (r.status === "PRESENT") present++;
    else if (r.status === "LATE") late++;
    else if (r.status === "ABSENT") absent++;
    else if (r.status === "EXCUSED" || r.status === "SICK" || r.status === "LEAVE") excused++;
  }

  const series = [...byDay.entries()]
    .map(([date, v]) => ({ date, rate: v.total ? Math.round((v.present / v.total) * 1000) / 10 : 0, total: v.total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const total = records.length;
  return {
    period: { from: opts.from.toISOString().slice(0, 10), to: opts.to.toISOString().slice(0, 10) },
    total,
    present,
    late,
    absent,
    excused,
    rate: total ? Math.round(((present + late) / total) * 1000) / 10 : 0,
    series,
  };
}

// --- Enrollment analytics ----------------------------------------------------

export async function enrollmentByGrade(actor: Actor, academicYearId?: string) {
  authorize(actor, "reporting.read");
  const tenantId = requireTenantId(actor);
  const enrollments = await prisma.enrollment.findMany({
    where: { tenantId, status: "ACTIVE", ...(academicYearId ? { academicYearId } : {}) },
    select: { classroom: { select: { gradeLevel: { select: { id: true, name: true } } } } },
  });
  const byGrade = new Map<string, { name: string; count: number }>();
  for (const e of enrollments) {
    const g = e.classroom.gradeLevel;
    if (!g) continue;
    const entry = byGrade.get(g.id) ?? { name: g.name, count: 0 };
    entry.count++;
    byGrade.set(g.id, entry);
  }
  return { total: enrollments.length, byGrade: [...byGrade.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

// --- Admissions funnel -------------------------------------------------------

export async function admissionsFunnel(actor: Actor, periodId?: string) {
  authorize(actor, "reporting.read");
  const tenantId = requireTenantId(actor);
  const apps = await prisma.application.findMany({
    where: { tenantId, ...(periodId ? { periodId } : {}) },
    select: { status: true },
  });
  const counts: Record<string, number> = {};
  for (const a of apps) counts[a.status] = (counts[a.status] ?? 0) + 1;
  return { total: apps.length, byStatus: counts };
}

// --- Finance trend -----------------------------------------------------------

export async function financeTrend(actor: Actor) {
  authorize(actor, "reporting.read");
  const tenantId = requireTenantId(actor);
  const invoices = await prisma.invoice.findMany({ where: { tenantId }, select: { total: true, paidAmount: true, status: true, issueDate: true } });
  const byMonth = new Map<string, { billed: number; collected: number }>();
  for (const inv of invoices) {
    if (inv.status === "CANCELLED" || inv.status === "REFUNDED") continue;
    const m = inv.issueDate.toISOString().slice(0, 7);
    const entry = byMonth.get(m) ?? { billed: 0, collected: 0 };
    entry.billed += inv.total;
    entry.collected += inv.paidAmount;
    byMonth.set(m, entry);
  }
  return [...byMonth.entries()]
    .map(([month, v]) => ({ month, billed: Math.round(v.billed), collected: Math.round(v.collected) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// --- Teacher workload --------------------------------------------------------

export async function teacherWorkload(actor: Actor) {
  authorize(actor, "reporting.read");
  const tenantId = requireTenantId(actor);
  const assignments = await prisma.teacherAssignment.findMany({
    where: { tenantId },
    select: { teacherId: true, teacher: { select: { fullName: true } } },
  });
  const byTeacher = new Map<string, { name: string; classes: number }>();
  for (const a of assignments) {
    const entry = byTeacher.get(a.teacherId) ?? { name: a.teacher.fullName, classes: 0 };
    entry.classes++;
    byTeacher.set(a.teacherId, entry);
  }
  return [...byTeacher.values()].sort((a, b) => b.classes - a.classes);
}

// --- Library usage -----------------------------------------------------------

export async function libraryUsage(actor: Actor) {
  authorize(actor, "reporting.read");
  const tenantId = requireTenantId(actor);
  const [loans, active, overdue] = await Promise.all([
    prisma.libraryLoan.count({ where: { tenantId } }),
    prisma.libraryLoan.count({ where: { tenantId, status: "ACTIVE" } }),
    prisma.libraryLoan.count({ where: { tenantId, status: "ACTIVE", dueAt: { lt: new Date() } } }),
  ]);
  return { totalLoans: loans, activeLoans: active, overdue };
}

// --- Unified dashboard summary ----------------------------------------------

export async function reportingSummary(actor: Actor) {
  authorize(actor, "reporting.read");
  const tenantId = requireTenantId(actor);
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);

  const [students, teachers, attendance, enrollment, admissions, finance, library, workload] = await Promise.all([
    prisma.student.count({ where: { tenantId, deletedAt: null } }),
    prisma.teacher.count({ where: { tenantId, deletedAt: null } }),
    attendanceTrend(actor, { from, to: now }),
    enrollmentByGrade(actor),
    admissionsFunnel(actor),
    financeTrend(actor),
    libraryUsage(actor),
    teacherWorkload(actor),
  ]);

  return {
    counts: { students, teachers },
    attendance: { rate: attendance.rate, absent: attendance.absent, late: attendance.late, series: attendance.series },
    enrollment,
    admissions,
    finance,
    library,
    workload,
  };
}

// --- Academic risk indicators (Phase 83) -------------------------------------

export type RiskIndicator = {
  studentId: string;
  fullName: string;
  studentNumber: string;
  level: "low" | "watch" | "elevated";
  score: number;
  /** Plainly-named contributing factors with the underlying numbers. */
  factors: { label: string; detail: string }[];
  period: { from: string; to: string };
  /** Always true: this is an indicator for human review, not a prediction. */
  requiresReview: true;
};

/**
 * Compute attendance/assignment-based risk indicators for a class or the whole
 * school. Deliberately deterministic and explainable: each factor is a counted
 * fact, and the level is a transparent threshold - never an ML "score".
 */
export async function academicRiskIndicators(
  actor: Actor,
  opts: { classroomId?: string; days?: number } = {},
): Promise<{ period: { from: string; to: string }; indicators: RiskIndicator[] }> {
  authorize(actor, "reporting.read");
  const tenantId = requireTenantId(actor);
  const days = Math.min(120, Math.max(7, opts.days ?? 30));
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const students = await prisma.student.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(opts.classroomId
        ? { enrollments: { some: { classroomId: opts.classroomId, status: "ACTIVE" } } }
        : {}),
    },
    select: { id: true, fullName: true, studentNumber: true },
    take: 500,
  });
  const ids = students.map((s) => s.id);
  if (ids.length === 0) {
    return { period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }, indicators: [] };
  }

  const [attendance, grades, submissions] = await Promise.all([
    prisma.attendanceRecord.groupBy({
      by: ["studentId", "status"],
      where: { tenantId, studentId: { in: ids }, session: { sessionDate: { gte: from, lte: to } } },
      _count: { _all: true },
    }),
    prisma.grade.findMany({
      where: { tenantId, studentId: { in: ids }, status: "PUBLISHED", assessment: { scheduledAt: { gte: from, lte: to } } },
      select: { studentId: true, score: true, assessment: { select: { maxScore: true } } },
    }),
    prisma.assignmentSubmission.findMany({
      where: { tenantId, studentId: { in: ids }, status: { in: ["SUBMITTED", "GRADED", "LATE"] as never }, createdAt: { gte: from, lte: to } },
      select: { studentId: true },
    }),
  ]);

  // Aggregate per student.
  const attByStudent = new Map<string, { total: number; bad: number; late: number }>();
  for (const row of attendance) {
    if (!row.studentId) continue;
    const entry = attByStudent.get(row.studentId) ?? { total: 0, bad: 0, late: 0 };
    const n = row._count._all;
    entry.total += n;
    if (row.status === "ABSENT" || row.status === "EXCUSED" || row.status === "SICK" || row.status === "LEAVE") entry.bad += n;
    if (row.status === "LATE") entry.late += n;
    attByStudent.set(row.studentId, entry);
  }

  const pctByStudent = new Map<string, number[]>();
  for (const g of grades) {
    if (g.score === null) continue;
    const pct = g.assessment.maxScore > 0 ? (g.score / g.assessment.maxScore) * 100 : 0;
    const arr = pctByStudent.get(g.studentId) ?? [];
    arr.push(pct);
    pctByStudent.set(g.studentId, arr);
  }

  const subCount = new Map<string, number>();
  for (const s of submissions) subCount.set(s.studentId, (subCount.get(s.studentId) ?? 0) + 1);

  const indicators: RiskIndicator[] = [];
  for (const s of students) {
    const att = attByStudent.get(s.id);
    const pcts = pctByStudent.get(s.id) ?? [];
    const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
    const absenceRate = att && att.total ? att.bad / att.total : 0;
    const lateCount = att?.late ?? 0;

    const factors: RiskIndicator["factors"] = [];
    let score = 0;

    if (att && att.total > 0) {
      if (absenceRate >= 0.15) {
        score += 2;
        factors.push({ label: "Absence rate", detail: `${Math.round(absenceRate * 100)}% of ${att.total} sessions missed` });
      } else if (absenceRate >= 0.08) {
        score += 1;
        factors.push({ label: "Absence rate", detail: `${Math.round(absenceRate * 100)}% of ${att.total} sessions missed` });
      }
      if (lateCount >= 3) {
        score += 1;
        factors.push({ label: "Lateness", detail: `${lateCount} late arrivals in period` });
      }
    }
    if (avg !== null && avg < 60) {
      score += 2;
      factors.push({ label: "Average grade", detail: `Average ${Math.round(avg)}% across ${pcts.length} assessed items` });
    } else if (avg !== null && avg < 70) {
      score += 1;
      factors.push({ label: "Average grade", detail: `Average ${Math.round(avg)}% across ${pcts.length} assessed items` });
    }

    if (score === 0) continue;
    const level: RiskIndicator["level"] = score >= 4 ? "elevated" : score >= 2 ? "watch" : "low";
    indicators.push({
      studentId: s.id,
      fullName: s.fullName,
      studentNumber: s.studentNumber,
      level,
      score,
      factors,
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      requiresReview: true,
    });
  }

  indicators.sort((a, b) => b.score - a.score);
  return { period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }, indicators };
}
