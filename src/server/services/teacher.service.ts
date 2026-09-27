import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Teacher service. Teachers are staff with teaching duties. The records hold
 * personal data, so:
 *  - every read is tenant-scoped (requireTenantId + tenantId in every where),
 *  - every write is permission-gated (`teacher.*`) and audited,
 *  - soft-delete (archive) keeps history: teacher assignments, attendance and
 *    timetable rows that reference the teacher stay intact.
 *
 * A teacher may optionally be linked to a login account (`userId`). The account
 * is created by the user service; here we only store the reference so a teacher
 * record can exist before (or without) a login.
 */

export type TeacherStatusFilter = "ACTIVE" | "ON_LEAVE" | "INACTIVE" | "TERMINATED";
export type TeacherEmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "VOLUNTEER" | "SUBSTITUTE";

export type ListTeachersParams = {
  search?: string;
  status?: TeacherStatusFilter;
  employmentType?: TeacherEmploymentType;
  campusId?: string;
  departmentId?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 20;

export async function listTeachers(actor: Actor, params: ListTeachersParams = {}) {
  authorize(actor, "teacher.read");
  const tenantId = requireTenantId(actor);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  const where = {
    tenantId,
    deletedAt: null,
    ...(params.status ? { status: params.status } : {}),
    ...(params.employmentType ? { employmentType: params.employmentType } : {}),
    ...(params.campusId ? { campusId: params.campusId } : {}),
    ...(params.departmentId ? { departmentId: params.departmentId } : {}),
    ...(params.search
      ? {
          OR: [
            { fullName: { contains: params.search, mode: "insensitive" as const } },
            { employeeNumber: { contains: params.search, mode: "insensitive" as const } },
            { email: { contains: params.search, mode: "insensitive" as const } },
            { specialization: { contains: params.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      select: {
        id: true,
        employeeNumber: true,
        fullName: true,
        photoFileId: true,
        gender: true,
        status: true,
        employmentType: true,
        email: true,
        phone: true,
        specialization: true,
        userId: true,
        campus: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        _count: { select: { assignments: true, homeroomClasses: true } },
      },
      orderBy: [{ fullName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.teacher.count({ where }),
  ]);

  return {
    items: rows.map((t) => ({
      id: t.id,
      employeeNumber: t.employeeNumber,
      fullName: t.fullName,
      photoFileId: t.photoFileId,
      gender: t.gender,
      status: t.status,
      employmentType: t.employmentType,
      email: t.email,
      phone: t.phone,
      specialization: t.specialization,
      hasAccount: Boolean(t.userId),
      campus: t.campus,
      department: t.department,
      assignmentCount: t._count.assignments,
      homeroomCount: t._count.homeroomClasses,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/** Teacher detail, including current subject assignments and homeroom classes. */
export async function getTeacher(actor: Actor, teacherId: string) {
  authorize(actor, "teacher.read");
  const tenantId = requireTenantId(actor);

  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, tenantId, deletedAt: null },
    select: {
      id: true,
      employeeNumber: true,
      fullName: true,
      photoFileId: true,
      gender: true,
      qualification: true,
      specialization: true,
      employmentType: true,
      joinDate: true,
      exitDate: true,
      email: true,
      phone: true,
      address: true,
      status: true,
      customFields: true,
      userId: true,
      createdAt: true,
      campus: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      assignments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          isPrimary: true,
          subject: { select: { id: true, name: true, code: true } },
          classroom: { select: { id: true, name: true } },
          academicYearId: true,
        },
      },
      homeroomClasses: {
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!teacher) throw Errors.notFound("That teacher was not found.");
  return teacher;
}

export type CreateTeacherInput = {
  fullName: string;
  employeeNumber?: string;
  gender?: string;
  qualification?: string;
  specialization?: string;
  employmentType?: TeacherEmploymentType;
  joinDate?: Date;
  exitDate?: Date;
  email?: string;
  phone?: string;
  address?: string;
  campusId?: string;
  departmentId?: string;
  status?: TeacherStatusFilter;
  /** Link an existing login account by user id (optional). */
  userId?: string;
};

/** Generate the next sequential teacher employee number for the tenant (T-0009). */
async function nextEmployeeNumber(tenantId: string): Promise<string> {
  const last = await prisma.teacher.findFirst({
    where: { tenantId, employeeNumber: { startsWith: "T-" } },
    orderBy: { employeeNumber: "desc" },
    select: { employeeNumber: true },
  });
  const n = last ? Number(last.employeeNumber.replace(/^T-/, "")) : 0;
  const next = Number.isFinite(n) ? n + 1 : 1;
  return `T-${String(next).padStart(4, "0")}`;
}

export async function createTeacher(actor: Actor, input: CreateTeacherInput) {
  authorize(actor, "teacher.create");
  const tenantId = requireTenantId(actor);

  const employeeNumber =
    input.employeeNumber?.trim() || (await nextEmployeeNumber(tenantId));

  const clash = await prisma.teacher.findFirst({
    where: { tenantId, employeeNumber },
    select: { id: true },
  });
  if (clash) throw Errors.conflict("A teacher with that employee number already exists.");

  // A linked account must be a user id that actually exists.
  if (input.userId) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!user) throw Errors.validation("That login account was not found.", { userId: ["Unknown account."] });
  }

  const teacher = await prisma.teacher.create({
    data: {
      tenantId,
      employeeNumber,
      fullName: input.fullName.trim(),
      gender: input.gender || null,
      qualification: input.qualification?.trim() || null,
      specialization: input.specialization?.trim() || null,
      employmentType: input.employmentType ?? "FULL_TIME",
      joinDate: input.joinDate ?? null,
      exitDate: input.exitDate ?? null,
      email: input.email?.trim().toLowerCase() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      campusId: input.campusId ?? null,
      departmentId: input.departmentId ?? null,
      status: input.status ?? "ACTIVE",
      userId: input.userId ?? null,
    },
    select: { id: true, employeeNumber: true, fullName: true },
  });

  await recordAudit({
    actor,
    action: "teacher.create",
    resource: "Teacher",
    resourceId: teacher.id,
    after: { employeeNumber: teacher.employeeNumber, fullName: teacher.fullName },
  });

  return teacher;
}

export type UpdateTeacherInput = Partial<CreateTeacherInput>;

export async function updateTeacher(
  actor: Actor,
  teacherId: string,
  input: UpdateTeacherInput,
) {
  authorize(actor, "teacher.update");
  const tenantId = requireTenantId(actor);

  const existing = await prisma.teacher.findFirst({
    where: { id: teacherId, tenantId, deletedAt: null },
    select: { id: true, employeeNumber: true },
  });
  if (!existing) throw Errors.notFound("That teacher was not found.");

  if (input.employeeNumber && input.employeeNumber !== existing.employeeNumber) {
    const clash = await prisma.teacher.findFirst({
      where: { tenantId, employeeNumber: input.employeeNumber, id: { not: teacherId } },
      select: { id: true },
    });
    if (clash) throw Errors.conflict("A teacher with that employee number already exists.");
  }

  if (input.userId) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!user) throw Errors.validation("That login account was not found.", { userId: ["Unknown account."] });
  }

  const data: Record<string, unknown> = {};
  const assign = <K extends keyof UpdateTeacherInput>(key: K, column: string) => {
    if (input[key] !== undefined) {
      const v = input[key];
      data[column] = typeof v === "string" ? v.trim() || null : v;
    }
  };
  assign("fullName", "fullName");
  assign("employeeNumber", "employeeNumber");
  assign("gender", "gender");
  assign("qualification", "qualification");
  assign("specialization", "specialization");
  assign("employmentType", "employmentType");
  assign("joinDate", "joinDate");
  assign("exitDate", "exitDate");
  assign("email", "email");
  assign("phone", "phone");
  assign("address", "address");
  assign("campusId", "campusId");
  assign("departmentId", "departmentId");
  assign("status", "status");
  assign("userId", "userId");

  await prisma.teacher.update({ where: { id: teacherId }, data });

  await recordAudit({
    actor,
    action: "teacher.update",
    resource: "Teacher",
    resourceId: teacherId,
    after: Object.keys(data),
  });
}

/** Soft-delete (archive) a teacher, keeping history. */
export async function archiveTeacher(actor: Actor, teacherId: string) {
  authorize(actor, "teacher.delete");
  const tenantId = requireTenantId(actor);
  const existing = await prisma.teacher.findFirst({
    where: { id: teacherId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw Errors.notFound();

  await prisma.teacher.update({
    where: { id: teacherId },
    data: { deletedAt: new Date(), status: "TERMINATED" },
  });
  await recordAudit({
    actor,
    action: "teacher.archive",
    resource: "Teacher",
    resourceId: teacherId,
  });
}
