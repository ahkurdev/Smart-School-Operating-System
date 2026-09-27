/**
 * Timetable collision test (Phase 53).
 *
 * Proves the scheduling guard rails: a teacher, room or class cannot be
 * double-booked, and times must be sane. Uses the real service against the dev
 * database and cleans up after itself.
 *
 * Run: node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/timetable-collision-test.ts
 */
import { prisma } from "../src/server/db/client";
import { isAppError } from "../src/server/errors";
import type { Actor } from "../src/types/actor";
import type { Permission } from "../src/lib/permissions";
import { createEntry, validateWeek, assertValidTimeRange } from "../src/server/services/timetable.service";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}`);
  }
}
function actor(tenantId: string, userId: string): Actor {
  return {
    userId,
    tenantId,
    isPlatform: false,
    roleKeys: [],
    permissions: new Set<Permission>(["timetable.read", "timetable.manage"]),
    ip: null,
    userAgent: null,
  };
}

async function main() {
  const suffix = Date.now().toString(36);
  const tenant = await prisma.tenant.create({ data: { slug: `tt-${suffix}`, name: "TT" }, select: { id: true } });
  const tenantId = tenant.id;
  const adminId = `tt-admin-${suffix}`;
  await prisma.user.create({
    data: { id: adminId, email: `tt-${suffix}@e2e.local`, fullName: "TT Admin", status: "ACTIVE", passwordHash: "$2b$12$0000000000000000000000000000000000000000000000000000" },
  });
  const a = actor(tenantId, adminId);

  try {
    const year = await prisma.academicYear.create({
      data: { tenantId, name: "2026", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), isCurrent: true },
    });
    const grade = await prisma.gradeLevel.create({ data: { tenantId, name: "Grade 1", code: "G1", sequence: 1 } });
    const subjectA = await prisma.subject.create({ data: { tenantId, name: "Math", code: "MATH" } });
    const subjectB = await prisma.subject.create({ data: { tenantId, name: "Science", code: "SCI" } });
    const c1 = await prisma.classroom.create({ data: { tenantId, academicYearId: year.id, gradeLevelId: grade.id, name: "1A", code: "1A" } });
    const c2 = await prisma.classroom.create({ data: { tenantId, academicYearId: year.id, gradeLevelId: grade.id, name: "1B", code: "1B" } });
    const teacherA = await prisma.teacher.create({ data: { tenantId, fullName: "Teacher A", employeeNumber: `TA-${suffix}` } });
    const room = await prisma.room.create({ data: { tenantId, code: "R1", name: "Room 1" } });

    // Valid entry.
    await createEntry(a, {
      academicYearId: year.id,
      classroomId: c1.id,
      subjectId: subjectA.id,
      teacherId: teacherA.id,
      roomId: room.id,
      dayOfWeek: 1,
      startTime: "07:00",
      endTime: "07:45",
    });
    check("valid entry created", true);

    // Same class, overlapping time -> blocked.
    async function blocked(label: string, input: Parameters<typeof createEntry>[1]) {
      let blockedErr = false;
      try {
        await createEntry(a, input);
      } catch (e) {
        blockedErr = isAppError(e);
      }
      check(label, blockedErr);
    }

    await blocked("class double-booking blocked", {
      academicYearId: year.id,
      classroomId: c1.id,
      subjectId: subjectB.id,
      dayOfWeek: 1,
      startTime: "07:30",
      endTime: "08:15",
    });

    await blocked("teacher double-booking blocked", {
      academicYearId: year.id,
      classroomId: c2.id,
      subjectId: subjectB.id,
      teacherId: teacherA.id,
      dayOfWeek: 1,
      startTime: "07:15",
      endTime: "07:50",
    });

    await blocked("room double-booking blocked", {
      academicYearId: year.id,
      classroomId: c2.id,
      subjectId: subjectB.id,
      roomId: room.id,
      dayOfWeek: 1,
      startTime: "07:15",
      endTime: "07:50",
    });

    // Non-overlapping back-to-back slot allowed.
    await createEntry(a, {
      academicYearId: year.id,
      classroomId: c1.id,
      subjectId: subjectB.id,
      teacherId: teacherA.id,
      dayOfWeek: 1,
      startTime: "07:45",
      endTime: "08:30",
    });
    check("back-to-back slot allowed", true);

    // Same slot on a different day is fine.
    await createEntry(a, {
      academicYearId: year.id,
      classroomId: c1.id,
      subjectId: subjectA.id,
      teacherId: teacherA.id,
      dayOfWeek: 3,
      startTime: "07:00",
      endTime: "07:45",
    });
    check("same slot on another day allowed", true);

    // Time sanity.
    let badRange = false;
    try {
      assertValidTimeRange("09:00", "08:00");
    } catch {
      badRange = true;
    }
    check("end-before-start rejected", badRange);

    let badFormat = false;
    try {
      assertValidTimeRange("9am", "10am");
    } catch {
      badFormat = true;
    }
    check("malformed time rejected", badFormat);

    // Whole-week validator flags the clash between two proposed entries.
    const problems = await validateWeek(a, [
      { dayOfWeek: 2, startTime: "08:00", endTime: "09:00", classroomId: c1.id, teacherId: teacherA.id },
      { dayOfWeek: 2, startTime: "08:30", endTime: "09:30", classroomId: c2.id, teacherId: teacherA.id },
    ]);
    check("week validator finds teacher clash", problems.some((p) => p.kinds.includes("teacher")));

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: adminId } }).catch(() => {});
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
