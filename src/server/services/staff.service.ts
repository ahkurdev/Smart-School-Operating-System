import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Staff service. Non-teaching staff members (administration, finance, library,
 * support). Staff are a lighter record than teachers: no subject assignments,
 * no homeroom. All reads are tenant-scoped; all writes are gated by the
 * `staff.*` permission and audited.
 *
 * Note: the Staff model carries `department` as a free-text string (not a FK),
 * because non-teaching staff departments do not necessarily map to the academic
 * Department table used by subjects and teachers.
 */

export type StaffStatusFilter = "ACTIVE" | "ON_LEAVE" | "INACTIVE" | "TERMINATED";

export type ListStaffParams = {
  search?: string;
  status?: StaffStatusFilter;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 20;

export async function listStaff(actor: Actor, params: ListStaffParams = {}) {
  authorize(actor, "staff.read");
  const tenantId = requireTenantId(actor);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  const where = {
    tenantId,
    ...(params.status ? { status: params.status } : {}),
    ...(params.search
      ? {
          OR: [
            { fullName: { contains: params.search, mode: "insensitive" as const } },
            { employeeNumber: { contains: params.search, mode: "insensitive" as const } },
            { position: { contains: params.search, mode: "insensitive" as const } },
            { department: { contains: params.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.staff.findMany({
      where,
      select: {
        id: true,
        employeeNumber: true,
        fullName: true,
        position: true,
        department: true,
        email: true,
        phone: true,
        joinDate: true,
        status: true,
        userId: true,
      },
      orderBy: [{ fullName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.staff.count({ where }),
  ]);

  return {
    items: rows.map((s) => ({
      id: s.id,
      employeeNumber: s.employeeNumber,
      fullName: s.fullName,
      position: s.position,
      department: s.department,
      email: s.email,
      phone: s.phone,
      joinDate: s.joinDate,
      status: s.status,
      hasAccount: Boolean(s.userId),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getStaffMember(actor: Actor, staffId: string) {
  authorize(actor, "staff.read");
  const tenantId = requireTenantId(actor);
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, tenantId },
    select: {
      id: true,
      employeeNumber: true,
      fullName: true,
      position: true,
      department: true,
      email: true,
      phone: true,
      joinDate: true,
      status: true,
      userId: true,
      createdAt: true,
    },
  });
  if (!staff) throw Errors.notFound("That staff member was not found.");
  return staff;
}

export type CreateStaffInput = {
  fullName: string;
  employeeNumber?: string;
  position: string;
  department?: string;
  email?: string;
  phone?: string;
  joinDate?: Date;
  status?: StaffStatusFilter;
  /** Link an existing login account by user id (optional). */
  userId?: string;
};

/** Generate the next sequential staff employee number for the tenant (E-0009). */
async function nextStaffNumber(tenantId: string): Promise<string> {
  const last = await prisma.staff.findFirst({
    where: { tenantId, employeeNumber: { startsWith: "E-" } },
    orderBy: { employeeNumber: "desc" },
    select: { employeeNumber: true },
  });
  const n = last ? Number(last.employeeNumber.replace(/^E-/, "")) : 0;
  const next = Number.isFinite(n) ? n + 1 : 1;
  return `E-${String(next).padStart(4, "0")}`;
}

export async function createStaff(actor: Actor, input: CreateStaffInput) {
  authorize(actor, "staff.manage");
  const tenantId = requireTenantId(actor);

  const employeeNumber =
    input.employeeNumber?.trim() || (await nextStaffNumber(tenantId));

  const clash = await prisma.staff.findFirst({
    where: { tenantId, employeeNumber },
    select: { id: true },
  });
  if (clash) throw Errors.conflict("A staff member with that employee number already exists.");

  if (input.userId) {
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
    if (!user) throw Errors.validation("That login account was not found.", { userId: ["Unknown account."] });
  }

  const staff = await prisma.staff.create({
    data: {
      tenantId,
      employeeNumber,
      fullName: input.fullName.trim(),
      position: input.position.trim(),
      department: input.department?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      phone: input.phone?.trim() || null,
      joinDate: input.joinDate ?? null,
      status: input.status ?? "ACTIVE",
      userId: input.userId ?? null,
    },
    select: { id: true, employeeNumber: true, fullName: true },
  });

  await recordAudit({
    actor,
    action: "staff.create",
    resource: "Staff",
    resourceId: staff.id,
    after: { employeeNumber: staff.employeeNumber, fullName: staff.fullName },
  });

  return staff;
}

export type UpdateStaffInput = Partial<CreateStaffInput>;

export async function updateStaff(actor: Actor, staffId: string, input: UpdateStaffInput) {
  authorize(actor, "staff.manage");
  const tenantId = requireTenantId(actor);

  const existing = await prisma.staff.findFirst({
    where: { id: staffId, tenantId },
    select: { id: true, employeeNumber: true },
  });
  if (!existing) throw Errors.notFound("That staff member was not found.");

  if (input.employeeNumber && input.employeeNumber !== existing.employeeNumber) {
    const clash = await prisma.staff.findFirst({
      where: { tenantId, employeeNumber: input.employeeNumber, id: { not: staffId } },
      select: { id: true },
    });
    if (clash) throw Errors.conflict("A staff member with that employee number already exists.");
  }

  if (input.userId) {
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
    if (!user) throw Errors.validation("That login account was not found.", { userId: ["Unknown account."] });
  }

  const data: Record<string, unknown> = {};
  const assign = <K extends keyof UpdateStaffInput>(key: K, column: string) => {
    if (input[key] !== undefined) {
      const v = input[key];
      data[column] = typeof v === "string" ? v.trim() || null : v;
    }
  };
  assign("fullName", "fullName");
  assign("employeeNumber", "employeeNumber");
  assign("position", "position");
  assign("department", "department");
  assign("email", "email");
  assign("phone", "phone");
  assign("joinDate", "joinDate");
  assign("status", "status");
  assign("userId", "userId");

  await prisma.staff.update({ where: { id: staffId }, data });

  await recordAudit({
    actor,
    action: "staff.update",
    resource: "Staff",
    resourceId: staffId,
    after: Object.keys(data),
  });
}

/** Soft-remove a staff member by marking them terminated (no deletedAt column). */
export async function archiveStaff(actor: Actor, staffId: string) {
  authorize(actor, "staff.manage");
  const tenantId = requireTenantId(actor);
  const existing = await prisma.staff.findFirst({
    where: { id: staffId, tenantId },
    select: { id: true },
  });
  if (!existing) throw Errors.notFound();

  await prisma.staff.update({ where: { id: staffId }, data: { status: "TERMINATED" } });
  await recordAudit({
    actor,
    action: "staff.archive",
    resource: "Staff",
    resourceId: staffId,
  });
}
