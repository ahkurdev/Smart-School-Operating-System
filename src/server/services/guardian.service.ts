import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Guardian service. A guardian is a parent/carer who may be linked to one or
 * more students (a many-to-many relation through `StudentGuardian`). Guardians
 * hold sensitive personal data (national id, contact details, pickup rights), so:
 *  - every read is tenant-scoped,
 *  - every write is permission-gated (`guardian.*`) and audited,
 *  - link writes additionally require `guardian.link`,
 *  - only one guardian per student may be flagged primary (enforced on write),
 *  - soft-delete (archive) keeps history on the link rows' invoices etc.
 */

export type ListGuardiansParams = {
  search?: string;
  relationship?: string;
  /** Only guardians linked to this student. */
  studentId?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 20;

export async function listGuardians(actor: Actor, params: ListGuardiansParams = {}) {
  authorize(actor, "guardian.read");
  const tenantId = requireTenantId(actor);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  const where = {
    tenantId,
    deletedAt: null,
    ...(params.relationship ? { relationship: params.relationship } : {}),
    ...(params.studentId ? { students: { some: { studentId: params.studentId } } } : {}),
    ...(params.search
      ? {
          OR: [
            { fullName: { contains: params.search, mode: "insensitive" as const } },
            { phone: { contains: params.search, mode: "insensitive" as const } },
            { email: { contains: params.search, mode: "insensitive" as const } },
            { occupation: { contains: params.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.guardian.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        relationship: true,
        occupation: true,
        phone: true,
        email: true,
        userId: true,
        createdAt: true,
        students: {
          select: {
            isPrimary: true,
            student: { select: { id: true, fullName: true, studentNumber: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ fullName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.guardian.count({ where }),
  ]);

  return {
    items: rows.map((g) => ({
      id: g.id,
      fullName: g.fullName,
      relationship: g.relationship,
      occupation: g.occupation,
      phone: g.phone,
      email: g.email,
      hasPortalAccess: g.students.some((s) => s.isPrimary) || Boolean(g.userId),
      linkedStudents: g.students.map((s) => ({
        id: s.student.id,
        fullName: s.student.fullName,
        studentNumber: s.student.studentNumber,
        isPrimary: s.isPrimary,
      })),
      studentCount: g.students.length,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/** Guardian detail, including the linked students and their portal rights. */
export async function getGuardian(actor: Actor, guardianId: string) {
  authorize(actor, "guardian.read");
  const tenantId = requireTenantId(actor);

  const guardian = await prisma.guardian.findFirst({
    where: { id: guardianId, tenantId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      relationship: true,
      nationalId: true,
      occupation: true,
      phone: true,
      email: true,
      address: true,
      userId: true,
      createdAt: true,
      students: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          relationship: true,
          isPrimary: true,
          canPickup: true,
          hasPortalAccess: true,
          student: {
            select: {
              id: true,
              fullName: true,
              studentNumber: true,
              status: true,
              campus: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!guardian) throw Errors.notFound("That guardian was not found.");
  return guardian;
}

export type CreateGuardianInput = {
  fullName: string;
  relationship: string;
  nationalId?: string;
  occupation?: string;
  phone?: string;
  email?: string;
  address?: string;
};

export async function createGuardian(actor: Actor, input: CreateGuardianInput) {
  authorize(actor, "guardian.create");
  const tenantId = requireTenantId(actor);

  const guardian = await prisma.guardian.create({
    data: {
      tenantId,
      fullName: input.fullName.trim(),
      relationship: input.relationship.trim(),
      nationalId: input.nationalId?.trim() || null,
      occupation: input.occupation?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      address: input.address?.trim() || null,
    },
    select: { id: true, fullName: true, relationship: true },
  });

  await recordAudit({
    actor,
    action: "guardian.create",
    resource: "Guardian",
    resourceId: guardian.id,
    after: { fullName: guardian.fullName, relationship: guardian.relationship },
  });

  return guardian;
}

export type UpdateGuardianInput = Partial<CreateGuardianInput>;

export async function updateGuardian(
  actor: Actor,
  guardianId: string,
  input: UpdateGuardianInput,
) {
  authorize(actor, "guardian.update");
  const tenantId = requireTenantId(actor);

  const existing = await prisma.guardian.findFirst({
    where: { id: guardianId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw Errors.notFound("That guardian was not found.");

  const data: Record<string, unknown> = {};
  const assign = <K extends keyof UpdateGuardianInput>(key: K, column: string) => {
    if (input[key] !== undefined) {
      const v = input[key];
      data[column] = typeof v === "string" ? v.trim() || null : v;
    }
  };
  assign("fullName", "fullName");
  assign("relationship", "relationship");
  assign("nationalId", "nationalId");
  assign("occupation", "occupation");
  assign("phone", "phone");
  assign("email", "email");
  assign("address", "address");

  await prisma.guardian.update({ where: { id: guardianId }, data });

  await recordAudit({
    actor,
    action: "guardian.update",
    resource: "Guardian",
    resourceId: guardianId,
    after: Object.keys(data),
  });
}

/** Soft-delete (archive) a guardian, keeping the link/invoice history. */
export async function archiveGuardian(actor: Actor, guardianId: string) {
  authorize(actor, "guardian.delete");
  const tenantId = requireTenantId(actor);
  const existing = await prisma.guardian.findFirst({
    where: { id: guardianId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw Errors.notFound();

  await prisma.guardian.update({
    where: { id: guardianId },
    data: { deletedAt: new Date() },
  });
  await recordAudit({
    actor,
    action: "guardian.archive",
    resource: "Guardian",
    resourceId: guardianId,
  });
}

// --- Student links ----------------------------------------------------------

/**
 * Students in the tenant who are not yet linked to this guardian. Used to
 * populate the "link student" picker. Reads only; tenant-scoped.
 */
export async function listStudentsAvailableForGuardian(actor: Actor, guardianId: string) {
  authorize(actor, "guardian.read");
  const tenantId = requireTenantId(actor);

  const rows = await prisma.student.findMany({
    where: {
      tenantId,
      deletedAt: null,
      guardians: { none: { guardianId } },
    },
    select: { id: true, fullName: true, studentNumber: true },
    orderBy: { fullName: "asc" },
    take: 500,
  });
  return rows;
}

export type LinkGuardianInput = {
  guardianId: string;
  studentId: string;
  relationship?: string;
  isPrimary?: boolean;
  canPickup?: boolean;
  hasPortalAccess?: boolean;
};

/**
 * Link a guardian to a student. When `isPrimary` is set, any other primary
 * guardian on that student is demoted in the same transaction so a student never
 * has two primary guardians.
 */
export async function linkGuardianToStudent(actor: Actor, input: LinkGuardianInput) {
  authorize(actor, "guardian.link");
  const tenantId = requireTenantId(actor);

  const [guardian, student] = await Promise.all([
    prisma.guardian.findFirst({
      where: { id: input.guardianId, tenantId, deletedAt: null },
      select: { id: true, relationship: true, fullName: true },
    }),
    prisma.student.findFirst({
      where: { id: input.studentId, tenantId, deletedAt: null },
      select: { id: true, fullName: true },
    }),
  ]);
  if (!guardian) throw Errors.notFound("That guardian was not found.");
  if (!student) throw Errors.notFound("That student was not found.");

  const existingLink = await prisma.studentGuardian.findUnique({
    where: { studentId_guardianId: { studentId: input.studentId, guardianId: input.guardianId } },
    select: { studentId: true },
  });
  if (existingLink) {
    throw Errors.conflict("That guardian is already linked to this student.");
  }

  const isPrimary = input.isPrimary ?? false;

  await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.studentGuardian.updateMany({
        where: { studentId: input.studentId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    await tx.studentGuardian.create({
      data: {
        studentId: input.studentId,
        guardianId: input.guardianId,
        relationship: input.relationship?.trim() || guardian.relationship,
        isPrimary,
        canPickup: input.canPickup ?? true,
        hasPortalAccess: input.hasPortalAccess ?? true,
      },
    });
  });

  await recordAudit({
    actor,
    action: "guardian.link",
    resource: "StudentGuardian",
    resourceId: `${input.studentId}:${input.guardianId}`,
    after: {
      student: student.fullName,
      guardian: guardian.fullName,
      isPrimary,
    },
  });
}

/** Update the rights/relationship on an existing link. */
export async function updateGuardianLink(
  actor: Actor,
  input: {
    guardianId: string;
    studentId: string;
    relationship?: string;
    isPrimary?: boolean;
    canPickup?: boolean;
    hasPortalAccess?: boolean;
  },
) {
  authorize(actor, "guardian.link");
  const tenantId = requireTenantId(actor);

  // Both ends must belong to this tenant.
  const [guardian, student, link] = await Promise.all([
    prisma.guardian.findFirst({
      where: { id: input.guardianId, tenantId },
      select: { id: true },
    }),
    prisma.student.findFirst({
      where: { id: input.studentId, tenantId },
      select: { id: true },
    }),
    prisma.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId: input.studentId, guardianId: input.guardianId } },
      select: { isPrimary: true },
    }),
  ]);
  if (!guardian || !student || !link) throw Errors.notFound("That guardian link was not found.");

  await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.studentGuardian.updateMany({
        where: { studentId: input.studentId, isPrimary: true, guardianId: { not: input.guardianId } },
        data: { isPrimary: false },
      });
    }
    await tx.studentGuardian.update({
      where: { studentId_guardianId: { studentId: input.studentId, guardianId: input.guardianId } },
      data: {
        ...(input.relationship !== undefined ? { relationship: input.relationship.trim() } : {}),
        ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
        ...(input.canPickup !== undefined ? { canPickup: input.canPickup } : {}),
        ...(input.hasPortalAccess !== undefined ? { hasPortalAccess: input.hasPortalAccess } : {}),
      },
    });
  });

  await recordAudit({
    actor,
    action: "guardian.link_update",
    resource: "StudentGuardian",
    resourceId: `${input.studentId}:${input.guardianId}`,
    after: input,
  });
}

/** Remove a guardian link from a student. */
export async function unlinkGuardianFromStudent(
  actor: Actor,
  input: { guardianId: string; studentId: string },
) {
  authorize(actor, "guardian.link");
  const tenantId = requireTenantId(actor);

  const [guardian, student] = await Promise.all([
    prisma.guardian.findFirst({ where: { id: input.guardianId, tenantId }, select: { id: true } }),
    prisma.student.findFirst({ where: { id: input.studentId, tenantId }, select: { id: true } }),
  ]);
  if (!guardian || !student) throw Errors.notFound("That guardian link was not found.");

  const link = await prisma.studentGuardian.findUnique({
    where: { studentId_guardianId: { studentId: input.studentId, guardianId: input.guardianId } },
    select: { studentId: true },
  });
  if (!link) throw Errors.notFound();

  await prisma.studentGuardian.delete({
    where: { studentId_guardianId: { studentId: input.studentId, guardianId: input.guardianId } },
  });

  await recordAudit({
    actor,
    action: "guardian.unlink",
    resource: "StudentGuardian",
    resourceId: `${input.studentId}:${input.guardianId}`,
  });
}
