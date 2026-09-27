import { prisma } from "@/server/db/client";
import { requireTenantId } from "@/server/db/tenant";
import type { Actor } from "@/types/actor";

/**
 * Role-aware dashboards (Phases 56-58).
 *
 * Each function returns exactly what that persona needs on landing, computed
 * from real data:
 *  - teacher: the classes they teach, today's timetable, sessions to take
 *  - student: today's timetable, their attendance rate, upcoming work
 *  - parent:  a card per child with today's attendance and recent results
 *
 * The teacher/student/parent rows are resolved from the actor's own user id, so
 * one person sees only their own day — never another family's child.
 */

const DAY_INDEX = new Date().getDay(); // 0=Sun..6=Sat

function todayRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

async function teacherForActor(tenantId: string, userId: string) {
  return prisma.teacher.findFirst({
    where: { tenantId, userId, deletedAt: null },
    select: { id: true, fullName: true },
  });
}

// ---------------------------------------------------------------------------
// Teacher dashboard (Phase 56)
// ---------------------------------------------------------------------------

export type TeacherDashboard = {
  teacherName: string;
  todayClasses: {
    id: string;
    startTime: string;
    endTime: string;
    subject: string;
    classroom: string;
    sessionStatus: string | null;
  }[];
  sessionsToTake: { id: string; classroom: string; subject: string | null; scheduledFor: Date | null; status: string }[];
  classesCount: number;
};

export async function getTeacherDashboard(actor: Actor): Promise<TeacherDashboard | null> {
  const tenantId = requireTenantId(actor);
  const teacher = await teacherForActor(tenantId, actor.userId);
  if (!teacher) return null;

  const year = await prisma.academicYear.findFirst({ where: { tenantId, isCurrent: true }, select: { id: true } });

  const slots = year
    ? await prisma.timetableEntry.findMany({
        where: { tenantId, teacherId: teacher.id, academicYearId: year.id, dayOfWeek: DAY_INDEX },
        orderBy: { startTime: "asc" },
        include: {
          subject: { select: { name: true } },
          classroom: { select: { id: true, name: true } },
        },
      })
    : [];

  // Match today's slots to any attendance session the teacher already opened.
  const { start } = todayRange();
  const sessions = await prisma.attendanceSession.findMany({
    where: { tenantId, teacherId: teacher.id, sessionDate: { gte: start } },
    select: { id: true, classroomId: true, subjectId: true, status: true },
  });

  const todayClasses = slots.map((s) => {
    const match = sessions.find((x) => x.classroomId === s.classroomId && x.subjectId === s.subjectId);
    return {
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      subject: s.subject.name,
      classroom: s.classroom.name,
      sessionStatus: match?.status ?? null,
    };
  });

  const sessionsToTake = await prisma.attendanceSession.findMany({
    where: { tenantId, teacherId: teacher.id, status: { in: ["SCHEDULED", "OPEN"] } },
    orderBy: { sessionDate: "asc" },
    take: 8,
    include: { classroom: { select: { name: true } }, subject: { select: { name: true } } },
  });

  const classesCount = await prisma.timetableEntry.count({
    where: { tenantId, teacherId: teacher.id, ...(year ? { academicYearId: year.id } : {}) },
  });

  return {
    teacherName: teacher.fullName,
    todayClasses,
    sessionsToTake: sessionsToTake.map((s) => ({
      id: s.id,
      classroom: s.classroom?.name ?? "Unassigned",
      subject: s.subject?.name ?? null,
      scheduledFor: s.sessionDate,
      status: s.status,
    })),
    classesCount,
  };
}

// ---------------------------------------------------------------------------
// Student dashboard (Phase 57)
// ---------------------------------------------------------------------------

export type StudentDashboard = {
  studentName: string;
  className: string | null;
  todayClasses: { startTime: string; endTime: string; subject: string; teacher: string | null; room: string | null }[];
  attendance: { present: number; late: number; absent: number; rate: number | null };
  upcomingWork: { id: string; title: string; dueAt: Date | null; type: string }[];
};

/** Resolve the student record owned by this user (shared with the portal). */
export async function studentForActor(tenantId: string, userId: string) {
  return prisma.student.findFirst({
    where: { tenantId, userId, deletedAt: null },
    select: { id: true, fullName: true, studentNumber: true },
  });
}

export async function getStudentDashboard(actor: Actor): Promise<StudentDashboard | null> {
  const tenantId = requireTenantId(actor);
  const student = await studentForActor(tenantId, actor.userId);
  if (!student) return null;

  const enrollment = await prisma.enrollment.findFirst({
    where: { tenantId, studentId: student.id, status: "ACTIVE" },
    include: { classroom: { select: { id: true, name: true } } },
  });
  const classroomId = enrollment?.classroomId ?? null;

  const year = await prisma.academicYear.findFirst({ where: { tenantId, isCurrent: true }, select: { id: true } });

  const slots =
    classroomId && year
      ? await prisma.timetableEntry.findMany({
          where: { tenantId, classroomId, academicYearId: year.id, dayOfWeek: DAY_INDEX },
          orderBy: { startTime: "asc" },
          include: {
            subject: { select: { name: true } },
            teacher: { select: { user: { select: { fullName: true } } } },
            room: { select: { name: true } },
          },
        })
      : [];

  const records = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    where: { tenantId, studentId: student.id },
    _count: { _all: true },
  });
  const byStatus = new Map(records.map((r) => [r.status, r._count._all]));
  const present = byStatus.get("PRESENT") ?? 0;
  const late = byStatus.get("LATE") ?? 0;
  const absent =
    (byStatus.get("ABSENT") ?? 0) + (byStatus.get("EXCUSED") ?? 0) + (byStatus.get("SICK") ?? 0) + (byStatus.get("LEAVE") ?? 0);
  const total = present + late + absent;

  const upcomingWork = await prisma.assignment.findMany({
    where: {
      tenantId,
      ...(classroomId ? { classroomId } : {}),
      status: "PUBLISHED",
      OR: [{ dueAt: { gte: new Date() } }, { dueAt: null }],
    },
    orderBy: { dueAt: "asc" },
    take: 6,
    select: { id: true, title: true, dueAt: true },
  });

  return {
    studentName: student.fullName,
    className: enrollment?.classroom.name ?? null,
    todayClasses: slots.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      subject: s.subject.name,
      teacher: s.teacher?.user?.fullName ?? null,
      room: s.room?.name ?? null,
    })),
    attendance: { present, late, absent, rate: total > 0 ? Math.round(((present + late) / total) * 100) : null },
    upcomingWork: upcomingWork.map((a) => ({ id: a.id, title: a.title, dueAt: a.dueAt, type: "ASSIGNMENT" })),
  };
}

// ---------------------------------------------------------------------------
// Parent dashboard (Phase 58)
// ---------------------------------------------------------------------------

export type ParentDashboard = {
  children: {
    id: string;
    name: string;
    studentNumber: string;
    className: string | null;
    attendanceRate: number | null;
    recentGrade: { title: string; score: number | null; maxScore: number | null } | null;
  }[];
};

export async function getParentDashboard(actor: Actor): Promise<ParentDashboard> {
  const tenantId = requireTenantId(actor);
  // The parent user's guardian profile links to children.
  const guardian = await prisma.guardian.findFirst({
    where: { tenantId, userId: actor.userId, deletedAt: null },
    select: { id: true },
  });
  if (!guardian) return { children: [] };

  const links = await prisma.studentGuardian.findMany({
    where: { guardianId: guardian.id },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          studentNumber: true,
          enrollments: {
            where: { status: "ACTIVE" },
            take: 1,
            include: { classroom: { select: { name: true } } },
          },
        },
      },
    },
  });

  const children = await Promise.all(
    links.map(async (link) => {
      const studentId = link.student.id;
      const records = await prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { tenantId, studentId },
        _count: { _all: true },
      });
      const byStatus = new Map(records.map((r) => [r.status, r._count._all]));
      const p = byStatus.get("PRESENT") ?? 0;
      const l = byStatus.get("LATE") ?? 0;
      const a =
        (byStatus.get("ABSENT") ?? 0) + (byStatus.get("EXCUSED") ?? 0) + (byStatus.get("SICK") ?? 0) + (byStatus.get("LEAVE") ?? 0);
      const total = p + l + a;

      const grade = await prisma.grade.findFirst({
        where: { tenantId, studentId },
        orderBy: { createdAt: "desc" },
        select: { score: true, assessment: { select: { title: true, maxScore: true } } },
      });

      return {
        id: studentId,
        name: link.student.fullName,
        studentNumber: link.student.studentNumber,
        className: link.student.enrollments[0]?.classroom.name ?? null,
        attendanceRate: total > 0 ? Math.round(((p + l) / total) * 100) : null,
        recentGrade: grade ? { title: grade.assessment.title, score: grade.score, maxScore: grade.assessment.maxScore } : null,
      };
    }),
  );

  return { children };
}

/** Pick the dashboard a landing user should see based on their roles/permissions. */
export async function getLandingDashboard(actor: Actor) {
  const tenantId = requireTenantId(actor);

  const [teacher, student] = await Promise.all([
    actor.permissions.has("attendance.manage") ? teacherForActor(tenantId, actor.userId) : Promise.resolve(null),
    studentForActor(tenantId, actor.userId),
  ]);
  if (teacher) return { kind: "teacher" as const, data: await getTeacherDashboard(actor) };
  if (student) return { kind: "student" as const, data: await getStudentDashboard(actor) };
  const parent = await getParentDashboard(actor);
  if (parent.children.length) return { kind: "parent" as const, data: parent };
  return { kind: "admin" as const, data: null };
}
