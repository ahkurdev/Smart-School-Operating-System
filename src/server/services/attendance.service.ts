import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize, can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";
import type { AttendanceStatus } from "@prisma/client";

/**
 * Attendance service. All timestamps are authoritative on the server; the client
 * never supplies "now". Sessions move SCHEDULED -> OPEN -> CLOSED and once a
 * record exists it is immutable except by an authorised override, which is
 * always audited with actor + reason + before/after values.
 */

export type CreateSessionInput = {
  classroomId: string;
  subjectId?: string;
  academicYearId?: string;
  teacherId?: string;
  roomId?: string;
  title?: string;
  sessionDate: Date;
  startAt: Date;
  endAt: Date;
  gracePeriodMinutes?: number;
};

export async function createSession(actor: Actor, input: CreateSessionInput) {
  authorize(actor, "attendance.manage");
  const tenantId = requireTenantId(actor);
  if (input.endAt <= input.startAt) {
    throw Errors.validation("The session must end after it starts.");
  }
  const klass = await prisma.classroom.findFirst({
    where: { id: input.classroomId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!klass) throw Errors.notFound("That class was not found.");

  const session = await prisma.attendanceSession.create({
    data: {
      tenantId,
      classroomId: input.classroomId,
      subjectId: input.subjectId || null,
      academicYearId: input.academicYearId || null,
      teacherId: input.teacherId || null,
      roomId: input.roomId || null,
      title: input.title?.trim() || null,
      sessionDate: input.sessionDate,
      startAt: input.startAt,
      endAt: input.endAt,
      gracePeriodMinutes: input.gracePeriodMinutes ?? 10,
      status: "SCHEDULED",
    },
    select: { id: true, title: true },
  });
  await recordAudit({ actor, action: "attendance.session.create", resource: "AttendanceSession", resourceId: session.id });
  return session;
}

export async function openSession(actor: Actor, sessionId: string) {
  authorize(actor, "attendance.manage");
  const tenantId = requireTenantId(actor);
  const session = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, tenantId },
    select: { id: true, status: true },
  });
  if (!session) throw Errors.notFound();
  if (session.status === "OPEN") return;
  if (session.status === "CLOSED" || session.status === "CANCELLED") {
    throw Errors.conflict(`This session is ${session.status.toLowerCase()} and cannot be reopened.`);
  }
  await prisma.attendanceSession.update({ where: { id: sessionId }, data: { status: "OPEN" } });
  await recordAudit({ actor, action: "attendance.session.open", resource: "AttendanceSession", resourceId: sessionId });
}

export async function closeSession(actor: Actor, sessionId: string) {
  authorize(actor, "attendance.manage");
  const tenantId = requireTenantId(actor);
  const session = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, tenantId },
    select: { id: true, status: true, classroomId: true },
  });
  if (!session) throw Errors.notFound();
  await prisma.attendanceSession.update({ where: { id: sessionId }, data: { status: "CLOSED" } });
  await recordAudit({ actor, action: "attendance.session.close", resource: "AttendanceSession", resourceId: sessionId });
}

export async function cancelSession(actor: Actor, sessionId: string) {
  authorize(actor, "attendance.manage");
  const tenantId = requireTenantId(actor);
  const session = await prisma.attendanceSession.findFirst({ where: { id: sessionId, tenantId }, select: { id: true } });
  if (!session) throw Errors.notFound();
  await prisma.attendanceSession.update({ where: { id: sessionId }, data: { status: "CANCELLED" } });
  await recordAudit({ actor, action: "attendance.session.cancel", resource: "AttendanceSession", resourceId: sessionId });
}

/** Sessions for a given day (default today, server time), for the admin list. */
export async function listSessions(actor: Actor, params: { date?: Date; classroomId?: string; status?: string } = {}) {
  authorize(actor, "attendance.read");
  const tenantId = requireTenantId(actor);
  const day = params.date ?? new Date();
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return prisma.attendanceSession.findMany({
    where: {
      tenantId,
      sessionDate: { gte: dayStart, lt: dayEnd },
      ...(params.classroomId ? { classroomId: params.classroomId } : {}),
      ...(params.status ? { status: params.status as "SCHEDULED" | "OPEN" | "CLOSED" | "CANCELLED" } : {}),
    },
    select: {
      id: true,
      title: true,
      sessionDate: true,
      startAt: true,
      endAt: true,
      status: true,
      gracePeriodMinutes: true,
      classroom: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, fullName: true } },
      _count: { select: { records: true } },
    },
    orderBy: { startAt: "asc" },
  });
}

export async function getSession(actor: Actor, sessionId: string) {
  authorize(actor, "attendance.read");
  const tenantId = requireTenantId(actor);
  const session = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, tenantId },
    select: {
      id: true,
      title: true,
      status: true,
      sessionDate: true,
      startAt: true,
      endAt: true,
      gracePeriodMinutes: true,
      classroom: { select: { id: true, name: true, code: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, fullName: true } },
      academicYear: { select: { id: true, name: true } },
    },
  });
  if (!session) throw Errors.notFound();
  return session;
}

/**
 * Roster with attendance state for a session: every enrolled student, annotated
 * with whether they are present (and their record) or not yet marked.
 */
export async function getSessionRoster(actor: Actor, sessionId: string) {
  authorize(actor, "attendance.read");
  const tenantId = requireTenantId(actor);
  const session = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, tenantId },
    select: { id: true, classroomId: true, academicYearId: true, status: true },
  });
  if (!session) throw Errors.notFound();
  if (!session.classroomId) return { students: [] };

  const enrollments = await prisma.enrollment.findMany({
    where: { tenantId, classroomId: session.classroomId, status: "ACTIVE" },
    select: { student: { select: { id: true, fullName: true, studentNumber: true } } },
    orderBy: { student: { fullName: "asc" } },
  });
  const studentIds = enrollments.map((e) => e.student.id);
  const records = await prisma.attendanceRecord.findMany({
    where: { tenantId, sessionId, studentId: { in: studentIds } },
    select: { studentId: true, status: true, method: true, scanTime: true, overrideReason: true },
  });
  const byStudent = new Map(records.map((r) => [r.studentId, r]));
  return {
    students: enrollments.map((e) => ({
      ...e.student,
      record: byStudent.get(e.student.id) ?? null,
    })),
  };
}

export type ManualMarkInput = {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  reason?: string;
};

/**
 * Manual mark / override. Requires attendance.manage. If a record already
 * exists, this is an override and must carry a reason; both the previous and the
 * new value are written to the audit trail.
 */
export async function manualMark(actor: Actor, input: ManualMarkInput) {
  authorize(actor, "attendance.manage");
  const tenantId = requireTenantId(actor);

  const [session, student] = await Promise.all([
    prisma.attendanceSession.findFirst({
      where: { id: input.sessionId, tenantId },
      select: { id: true, status: true, classroomId: true, academicYearId: true },
    }),
    prisma.student.findFirst({ where: { id: input.studentId, tenantId, deletedAt: null }, select: { id: true } }),
  ]);
  if (!session) throw Errors.notFound("That session was not found.");
  if (!student) throw Errors.notFound("That student was not found.");
  if (session.status === "CANCELLED") throw Errors.conflict("Cancelled sessions cannot be marked.");

  const existing = await prisma.attendanceRecord.findFirst({
    where: { sessionId: input.sessionId, studentId: input.studentId },
    select: { id: true, status: true },
  });
  if (existing && !input.reason?.trim()) {
    throw Errors.validation("An override reason is required when changing an existing record.", {
      reason: ["A reason is required for overrides."],
    });
  }

  const record = await prisma.$transaction(async (tx) => {
    if (existing) {
      return tx.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          method: "MANUAL",
          overriddenByUserId: actor.userId,
          overrideReason: input.reason!.trim(),
          overriddenAt: new Date(),
        },
        select: { id: true, status: true },
      });
    }
    return tx.attendanceRecord.create({
      data: {
        tenantId,
        sessionId: input.sessionId,
        studentId: input.studentId,
        status: input.status,
        method: "MANUAL",
      },
      select: { id: true, status: true },
    });
  });

  await recordAudit({
    actor,
    action: existing ? "attendance.override" : "attendance.manual_mark",
    resource: "AttendanceRecord",
    resourceId: record.id,
    before: existing ? { status: existing.status } : undefined,
    after: { status: input.status, reason: input.reason ?? null },
  });
  return record;
}

/** Attendance summary counts for a session. */
export async function getSessionSummary(actor: Actor, sessionId: string) {
  authorize(actor, "attendance.read");
  const tenantId = requireTenantId(actor);
  const grouped = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    where: { tenantId, sessionId },
    _count: { _all: true },
  });
  return grouped.map((g) => ({ status: g.status, count: g._count._all }));
}

/**
 * Attendance dashboard for a day: counts by status and a per-class breakdown.
 * Only computed for actors who may read attendance.
 */
export async function getAttendanceOverview(actor: Actor, date?: Date) {
  authorize(actor, "attendance.read");
  const tenantId = requireTenantId(actor);
  const day = date ?? new Date();
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const sessions = await prisma.attendanceSession.findMany({
    where: { tenantId, sessionDate: { gte: dayStart, lt: dayEnd } },
    select: {
      id: true,
      status: true,
      classroom: { select: { id: true, name: true } },
      _count: { select: { records: true } },
    },
  });

  const records = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    where: {
      tenantId,
      session: { sessionDate: { gte: dayStart, lt: dayEnd } },
    },
    _count: { _all: true },
  });

  const byStatus: Record<string, number> = {};
  for (const r of records) byStatus[r.status] = r._count._all;

  const totalMarked = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const present = (byStatus.PRESENT ?? 0) + (byStatus.LATE ?? 0);
  const attendanceRate = totalMarked > 0 ? Math.round((present / totalMarked) * 100) : null;

  return {
    date: dayStart,
    sessionsToday: sessions.length,
    openSessions: sessions.filter((s) => s.status === "OPEN").length,
    byStatus,
    totalMarked,
    attendanceRate,
    classBreakdown: sessions.map((s) => ({
      classroomId: s.classroom?.id ?? null,
      classroomName: s.classroom?.name ?? "Unassigned",
      marked: s._count.records,
      status: s.status,
    })),
    canOverride: can(actor, "attendance.manage"),
  };
}

/** A student's own attendance history (used by the student/parent portals). */
export async function getStudentAttendanceHistory(actor: Actor, studentId: string, limit = 30) {
  const tenantId = requireTenantId(actor);
  // Portal access: the actor may read their own student's records; staff need
  // attendance.read. The caller (portal) has already resolved `studentId` to a
  // student the actor is allowed to see.
  authorize(actor, "attendance.read");
  const records = await prisma.attendanceRecord.findMany({
    where: { tenantId, studentId },
    select: {
      id: true,
      status: true,
      method: true,
      scanTime: true,
      overrideReason: true,
      session: { select: { id: true, title: true, sessionDate: true, subject: { select: { name: true } } } },
    },
    orderBy: { scanTime: "desc" },
    take: limit,
  });
  const summary = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  return { records, summary };
}
