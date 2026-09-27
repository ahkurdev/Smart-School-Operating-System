import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId, assertSameTenant } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Enrollment engine. A student has at most one enrollment per academic year
 * (schema unique constraint). Promoting means creating next year's enrollment;
 * transferring means changing the class within the same year. Capacity is
 * enforced transactionally so two concurrent enrollments cannot overfill a class.
 */

export type EnrollInput = {
  studentId: string;
  classroomId: string;
  academicYearId: string;
  rollNumber?: number;
};

async function assertCapacityAvailable(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  tenantId: string,
  classroomId: string,
) {
  const klass = await tx.classroom.findFirst({
    where: { id: classroomId, tenantId, deletedAt: null },
    select: { id: true, capacity: true, name: true },
  });
  if (!klass) throw Errors.notFound("That class was not found.");
  const current = await tx.enrollment.count({ where: { classroomId, status: "ACTIVE" } });
  if (current >= klass.capacity) {
    throw Errors.conflict(`"${klass.name}" is full (${current}/${klass.capacity}).`);
  }
  return klass;
}

export async function enrollStudent(actor: Actor, input: EnrollInput) {
  authorize(actor, "enrollment.manage");
  const tenantId = requireTenantId(actor);

  const result = await prisma.$transaction(async (tx) => {
    const student = await tx.student.findFirst({
      where: { id: input.studentId, tenantId, deletedAt: null },
      select: { id: true, fullName: true, campusId: true },
    });
    if (!student) throw Errors.notFound("That student was not found.");

    const year = await tx.academicYear.findFirst({
      where: { id: input.academicYearId, tenantId },
      select: { id: true },
    });
    if (!year) throw Errors.notFound("That academic year was not found.");

    await assertCapacityAvailable(tx, tenantId, input.classroomId);

    const existing = await tx.enrollment.findFirst({
      where: { studentId: input.studentId, academicYearId: input.academicYearId },
      select: { id: true },
    });
    if (existing) {
      throw Errors.conflict("This student already has an enrollment for that year.");
    }

    return tx.enrollment.create({
      data: {
        tenantId,
        studentId: input.studentId,
        classroomId: input.classroomId,
        academicYearId: input.academicYearId,
        rollNumber: input.rollNumber ?? null,
        status: "ACTIVE",
      },
      select: { id: true, studentId: true, classroomId: true },
    });
  });

  await recordAudit({
    actor,
    action: "enrollment.create",
    resource: "Enrollment",
    resourceId: result.id,
    after: { studentId: input.studentId, classroomId: input.classroomId },
  });
  return result;
}

/** Move a student to a different class within the same academic year. */
export async function transferStudent(actor: Actor, enrollmentId: string, toClassroomId: string) {
  authorize(actor, "enrollment.manage");
  const tenantId = requireTenantId(actor);

  const result = await prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.findFirst({
      where: { id: enrollmentId, tenantId },
      select: { id: true, classroomId: true, studentId: true, status: true },
    });
    if (!enrollment) throw Errors.notFound();
    if (enrollment.status !== "ACTIVE") {
      throw Errors.conflict("Only active enrollments can be transferred.");
    }
    await assertCapacityAvailable(tx, tenantId, toClassroomId);
    return tx.enrollment.update({
      where: { id: enrollmentId },
      data: { classroomId: toClassroomId },
      select: { id: true, classroomId: true },
    });
  });

  await recordAudit({
    actor,
    action: "enrollment.transfer",
    resource: "Enrollment",
    resourceId: enrollmentId,
    after: { classroomId: toClassroomId },
  });
  return result;
}

export async function withdrawStudent(
  actor: Actor,
  enrollmentId: string,
  reason: string,
  status: "WITHDRAWN" | "TRANSFERRED" = "WITHDRAWN",
) {
  authorize(actor, "enrollment.manage");
  const tenantId = requireTenantId(actor);
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, tenantId },
    select: { id: true },
  });
  if (!enrollment) throw Errors.notFound();

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { status, leftAt: new Date(), leftReason: reason.trim() || null },
  });
  await recordAudit({
    actor,
    action: "enrollment.withdraw",
    resource: "Enrollment",
    resourceId: enrollmentId,
    after: { status, reason },
  });
}

/**
 * Bulk enroll many students into one class in a single transaction. Partial
 * failures abort the whole batch so the roster never ends up half-applied.
 */
export async function bulkEnroll(actor: Actor, classroomId: string, studentIds: string[], academicYearId: string) {
  authorize(actor, "enrollment.manage");
  const tenantId = requireTenantId(actor);
  if (studentIds.length === 0) return { enrolled: 0 };

  const count = await prisma.$transaction(async (tx) => {
    const klass = await assertCapacityAvailable(tx, tenantId, classroomId);
    const current = await tx.enrollment.count({ where: { classroomId, status: "ACTIVE" } });
    if (current + studentIds.length > klass.capacity) {
      throw Errors.conflict(
        `Only ${Math.max(0, klass.capacity - current)} seat(s) remain in "${klass.name}".`,
      );
    }
    // Reject if any student is already enrolled in this year.
    const already = await tx.enrollment.findMany({
      where: { academicYearId, studentId: { in: studentIds } },
      select: { studentId: true },
    });
    if (already.length > 0) {
      throw Errors.conflict(`${already.length} student(s) already have an enrollment for that year.`);
    }
    const res = await tx.enrollment.createMany({
      data: studentIds.map((studentId) => ({ tenantId, studentId, classroomId, academicYearId, status: "ACTIVE" })),
    });
    return res.count;
  });

  await recordAudit({
    actor,
    action: "enrollment.bulk_create",
    resource: "Classroom",
    resourceId: classroomId,
    after: { count },
  });
  return { enrolled: count };
}

/** Unassigned active students for the given year (candidates for enrollment). */
export async function listEnrollableStudents(actor: Actor, academicYearId: string, search?: string) {
  authorize(actor, "enrollment.read");
  const tenantId = requireTenantId(actor);
  return prisma.student.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: "ACTIVE",
      ...(search
        ? { OR: [{ fullName: { contains: search, mode: "insensitive" } }, { studentNumber: { contains: search, mode: "insensitive" } }] }
        : {}),
      enrollments: { none: { academicYearId, status: "ACTIVE" } },
    },
    select: { id: true, fullName: true, studentNumber: true },
    take: 25,
    orderBy: { fullName: "asc" },
  });
}

/** Verify a student's active enrollment (used by attendance and portals). */
export async function getActiveEnrollment(actor: Actor, studentId: string, academicYearId?: string) {
  const tenantId = requireTenantId(actor);
  assertSameTenant(actor, tenantId);
  return prisma.enrollment.findFirst({
    where: { tenantId, studentId, status: "ACTIVE", ...(academicYearId ? { academicYearId } : {}) },
    select: {
      id: true,
      rollNumber: true,
      academicYear: { select: { id: true, name: true, isCurrent: true } },
      classroom: { select: { id: true, name: true, code: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });
}
