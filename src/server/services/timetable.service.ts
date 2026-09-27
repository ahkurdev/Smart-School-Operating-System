import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Timetable service (Phases 51-55).
 *
 * A weekly recurring schedule: each `TimetableEntry` places one subject, with a
 * teacher and room, into a class on a given weekday and time range. Before any
 * insert the service validates COLLISIONS (Phase 53): a teacher cannot be in two
 * places at once, a room cannot host two classes at once, and a class cannot
 * have two subjects at once. Overlaps are detected on time ranges, not just on
 * exact start times.
 */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri

/** "HH:MM" -> minutes since midnight; NaN if malformed. */
function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return NaN;
  return h * 60 + min;
}

export function assertValidTimeRange(startTime: string, endTime: string): void {
  const s = toMinutes(startTime);
  const e = toMinutes(endTime);
  if (Number.isNaN(s) || Number.isNaN(e)) throw Errors.validation("Times must be in HH:MM format.");
  if (e <= s) throw Errors.validation("The end time must be after the start time.");
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export type CollisionKind = "teacher" | "room" | "class";

/** Find any entry that would collide with the candidate, for one day. */
export async function findCollisions(
  tenantId: string,
  candidate: {
    id?: string;
    academicYearId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    classroomId: string;
    teacherId?: string | null;
    roomId?: string | null;
  },
): Promise<{ kind: CollisionKind; entry: { id: string; startTime: string; endTime: string } }[]> {
  const sameDay = await prisma.timetableEntry.findMany({
    where: {
      tenantId,
      academicYearId: candidate.academicYearId,
      dayOfWeek: candidate.dayOfWeek,
      ...(candidate.id ? { id: { not: candidate.id } } : {}),
      OR: [
        { classroomId: candidate.classroomId },
        ...(candidate.teacherId ? [{ teacherId: candidate.teacherId }] : []),
        ...(candidate.roomId ? [{ roomId: candidate.roomId }] : []),
      ],
    },
    select: { id: true, startTime: true, endTime: true, classroomId: true, teacherId: true, roomId: true },
  });

  const cs = toMinutes(candidate.startTime);
  const ce = toMinutes(candidate.endTime);
  const collisions: { kind: CollisionKind; entry: { id: string; startTime: string; endTime: string } }[] = [];
  for (const e of sameDay) {
    const es = toMinutes(e.startTime);
    const ee = toMinutes(e.endTime);
    if (!overlaps(cs, ce, es, ee)) continue;
    const ref = { id: e.id, startTime: e.startTime, endTime: e.endTime };
    if (e.classroomId === candidate.classroomId) collisions.push({ kind: "class", entry: ref });
    if (candidate.teacherId && e.teacherId === candidate.teacherId) collisions.push({ kind: "teacher", entry: ref });
    if (candidate.roomId && e.roomId === candidate.roomId) collisions.push({ kind: "room", entry: ref });
  }
  return collisions;
}

export async function listSchedulePeriods(actor: Actor) {
  authorize(actor, "timetable.read");
  const tenantId = requireTenantId(actor);
  return prisma.schedulePeriod.findMany({ where: { tenantId }, orderBy: { sequence: "asc" } });
}

export async function getTimetable(actor: Actor, opts: { academicYearId: string; classroomId?: string; teacherId?: string }) {
  authorize(actor, "timetable.read");
  const tenantId = requireTenantId(actor);
  return prisma.timetableEntry.findMany({
    where: {
      tenantId,
      academicYearId: opts.academicYearId,
      ...(opts.classroomId ? { classroomId: opts.classroomId } : {}),
      ...(opts.teacherId ? { teacherId: opts.teacherId } : {}),
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    include: {
      subject: { select: { id: true, name: true, code: true } },
      classroom: { select: { id: true, name: true } },
      teacher: { select: { id: true, user: { select: { fullName: true } } } },
      room: { select: { id: true, name: true } },
    },
  });
}

export async function createEntry(
  actor: Actor,
  input: {
    academicYearId: string;
    classroomId: string;
    subjectId: string;
    teacherId?: string;
    roomId?: string;
    periodId?: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  },
) {
  authorize(actor, "timetable.manage");
  const tenantId = requireTenantId(actor);
  if (input.dayOfWeek < 0 || input.dayOfWeek > 6) throw Errors.validation("Invalid day of week.");
  assertValidTimeRange(input.startTime, input.endTime);

  // Validate referenced rows belong to this tenant.
  const [classroom, subject] = await Promise.all([
    prisma.classroom.findFirst({ where: { id: input.classroomId, tenantId }, select: { id: true } }),
    prisma.subject.findFirst({ where: { id: input.subjectId, tenantId }, select: { id: true } }),
  ]);
  if (!classroom) throw Errors.notFound("Class not found.");
  if (!subject) throw Errors.notFound("Subject not found.");

  const collisions = await findCollisions(tenantId, {
    academicYearId: input.academicYearId,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    classroomId: input.classroomId,
    teacherId: input.teacherId,
    roomId: input.roomId,
  });
  if (collisions.length) {
    const kinds = [...new Set(collisions.map((c) => c.kind))].join(", ");
    throw Errors.conflict(`Time conflict (${kinds}). This slot overlaps an existing entry.`);
  }

  const entry = await prisma.timetableEntry.create({
    data: {
      tenantId,
      academicYearId: input.academicYearId,
      classroomId: input.classroomId,
      subjectId: input.subjectId,
      teacherId: input.teacherId || null,
      roomId: input.roomId || null,
      periodId: input.periodId || null,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
    },
  });
  await recordAudit({ actor, action: "timetable.entry.create", resource: "TimetableEntry", resourceId: entry.id });
  return entry;
}

export async function deleteEntry(actor: Actor, id: string) {
  authorize(actor, "timetable.manage");
  const tenantId = requireTenantId(actor);
  const entry = await prisma.timetableEntry.findFirst({ where: { id, tenantId } });
  if (!entry) throw Errors.notFound("Timetable entry not found.");
  await prisma.timetableEntry.delete({ where: { id } });
  await recordAudit({ actor, action: "timetable.entry.delete", resource: "TimetableEntry", resourceId: id });
}

/** Validate an entire proposed week at once (used by the grid editor save). */
export async function validateWeek(
  actor: Actor,
  entries: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    classroomId: string;
    teacherId?: string | null;
    roomId?: string | null;
  }[],
): Promise<{ index: number; kinds: CollisionKind[] }[]> {
  authorize(actor, "timetable.manage");
  const problems: { index: number; kinds: CollisionKind[] }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i]!;
    assertValidTimeRange(a.startTime, a.endTime);
    const aS = toMinutes(a.startTime);
    const aE = toMinutes(a.endTime);
    const kinds = new Set<CollisionKind>();
    for (let j = 0; j < entries.length; j++) {
      if (i === j) continue;
      const b = entries[j]!;
      if (b.dayOfWeek !== a.dayOfWeek) continue;
      if (!overlaps(aS, aE, toMinutes(b.startTime), toMinutes(b.endTime))) continue;
      if (a.classroomId === b.classroomId) kinds.add("class");
      if (a.teacherId && a.teacherId === b.teacherId) kinds.add("teacher");
      if (a.roomId && a.roomId === b.roomId) kinds.add("room");
    }
    if (kinds.size) problems.push({ index: i, kinds: [...kinds] });
  }
  return problems;
}

export function dayName(day: number): string {
  return DAY_NAMES[day] ?? "—";
}
