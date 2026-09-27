import { prisma } from "@/server/db/client";
import { requireTenantId } from "@/server/db/tenant";
import { can } from "@/server/policies";
import type { Actor } from "@/types/actor";

/**
 * Admin dashboard data. Every figure is computed from the database for the
 * actor's tenant; nothing is fabricated. Sections are gated by permission so a
 * user never sees numbers for data they cannot open.
 */

export type DashboardData = {
  counts: {
    students: number;
    teachers: number;
    classes: number;
  };
  attendanceToday: {
    present: number;
    late: number;
    absent: number;
    total: number;
    rate: number | null;
  } | null;
  admissions: {
    pendingVerification: number;
    submitted: number;
  } | null;
  upcomingEvents: {
    id: string;
    title: string;
    startAt: Date;
    location: string | null;
  }[];
  announcements: {
    id: string;
    title: string;
    publishAt: Date | null;
  }[];
};

function startOfTodayUtc(tzOffsetMinutes = 0): Date {
  const now = new Date();
  const shifted = new Date(now.getTime() + tzOffsetMinutes * 60_000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - tzOffsetMinutes * 60_000);
}

export async function getDashboardData(actor: Actor): Promise<DashboardData> {
  const tenantId = requireTenantId(actor);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true, featureFlags: true },
  });
  const flags = (tenant?.featureFlags as Record<string, boolean> | null) ?? {};

  const [students, teachers, classes] = await Promise.all([
    can(actor, "student.read")
      ? prisma.student.count({ where: { tenantId, deletedAt: null, status: "ACTIVE" } })
      : Promise.resolve(0),
    can(actor, "teacher.read")
      ? prisma.teacher.count({ where: { tenantId, deletedAt: null, status: { not: "INACTIVE" } } })
      : Promise.resolve(0),
    can(actor, "class.read")
      ? prisma.classroom.count({ where: { tenantId, deletedAt: null } })
      : Promise.resolve(0),
  ]);

  // Attendance today (server-authoritative day boundary; best-effort tz shift).
  let attendanceToday: DashboardData["attendanceToday"] = null;
  if (can(actor, "attendance.read")) {
    const dayStart = startOfTodayUtc();
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const records = await prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { tenantId, createdAt: { gte: dayStart, lt: dayEnd } },
      _count: { _all: true },
    });
    const byStatus = new Map(records.map((r) => [r.status, r._count._all]));
    const present = byStatus.get("PRESENT") ?? 0;
    const late = byStatus.get("LATE") ?? 0;
    const absent =
      (byStatus.get("ABSENT") ?? 0) +
      (byStatus.get("EXCUSED") ?? 0) +
      (byStatus.get("SICK") ?? 0) +
      (byStatus.get("LEAVE") ?? 0);
    const total = present + late + absent;
    attendanceToday = {
      present,
      late,
      absent,
      total,
      rate: total > 0 ? Math.round(((present + late) / total) * 100) : null,
    };
  }

  let admissions: DashboardData["admissions"] = null;
  if (can(actor, "admission.read") && flags.admission !== false) {
    const [pendingVerification, submitted] = await Promise.all([
      prisma.application.count({
        where: { tenantId, status: "SUBMITTED" },
      }),
      prisma.application.count({
        where: { tenantId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      }),
    ]);
    admissions = { pendingVerification, submitted };
  }

  const upcomingEvents = can(actor, "cms.read")
    ? await prisma.event.findMany({
        where: {
          tenantId,
          status: "PUBLISHED",
          startAt: { gte: new Date() },
        },
        select: { id: true, title: true, startAt: true, location: true },
        orderBy: { startAt: "asc" },
        take: 5,
      })
    : [];

  const announcements = can(actor, "announcement.read")
    ? await prisma.announcement.findMany({
        where: { tenantId, deletedAt: null, status: "PUBLISHED" },
        select: { id: true, title: true, publishAt: true },
        orderBy: { publishAt: "desc" },
        take: 5,
      })
    : [];

  return {
    counts: { students, teachers, classes },
    attendanceToday,
    admissions,
    upcomingEvents,
    announcements,
  };
}
