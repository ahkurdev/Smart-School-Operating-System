import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize, can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Student service. Student records hold sensitive personal information, so:
 *  - every read is tenant-scoped (requireTenantId + tenantId in every where),
 *  - sensitive fields (medical, special-ed) are only selected when the actor
 *    holds `student.read_sensitive`; otherwise they are omitted, never blanked
 *    silently into the same shape,
 *  - writes are audited.
 */

export type StudentStatusFilter = "ACTIVE" | "INACTIVE" | "GRADUATED" | "TRANSFERRED" | "WITHDRAWN" | "APPLICANT";

export type ListStudentsParams = {
  search?: string;
  status?: StudentStatusFilter;
  campusId?: string;
  classroomId?: string;
  academicYearId?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 20;

export async function listStudents(actor: Actor, params: ListStudentsParams = {}) {
  authorize(actor, "student.read");
  const tenantId = requireTenantId(actor);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  const where = {
    tenantId,
    deletedAt: null,
    ...(params.status ? { status: params.status } : {}),
    ...(params.campusId ? { campusId: params.campusId } : {}),
    ...(params.search
      ? {
          OR: [
            { fullName: { contains: params.search, mode: "insensitive" as const } },
            { studentNumber: { contains: params.search, mode: "insensitive" as const } },
            { nationalId: { contains: params.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(params.classroomId || params.academicYearId
      ? {
          enrollments: {
            some: {
              ...(params.classroomId ? { classroomId: params.classroomId } : {}),
              ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
            },
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.student.findMany({
      where,
      select: {
        id: true,
        studentNumber: true,
        fullName: true,
        preferredName: true,
        photoFileId: true,
        gender: true,
        status: true,
        email: true,
        phone: true,
        campus: { select: { id: true, name: true } },
        enrollments: {
          where: { status: "ACTIVE" },
          select: {
            classroom: { select: { id: true, name: true } },
            academicYear: { select: { id: true, name: true } },
          },
          orderBy: { enrolledAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ fullName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.student.count({ where }),
  ]);

  return {
    items: rows.map((s) => ({
      id: s.id,
      studentNumber: s.studentNumber,
      fullName: s.fullName,
      preferredName: s.preferredName,
      photoFileId: s.photoFileId,
      gender: s.gender,
      status: s.status,
      email: s.email,
      phone: s.phone,
      campus: s.campus,
      currentClass: s.enrollments[0]?.classroom?.name ?? null,
      academicYear: s.enrollments[0]?.academicYear?.name ?? null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/** Full student detail, with sensitive fields gated by permission. */
export async function getStudent(actor: Actor, studentId: string) {
  authorize(actor, "student.read");
  const tenantId = requireTenantId(actor);
  const includeSensitive = can(actor, "student.read_sensitive");

  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId, deletedAt: null },
    select: {
      id: true,
      studentNumber: true,
      nationalId: includeSensitive,
      fullName: true,
      preferredName: true,
      photoFileId: true,
      gender: true,
      birthDate: true,
      birthPlace: true,
      nationality: true,
      religion: true,
      address: true,
      city: true,
      region: true,
      country: true,
      postalCode: true,
      email: true,
      phone: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      medicalNotes: includeSensitive,
      specialEdNotes: includeSensitive,
      admissionDate: true,
      graduationDate: true,
      status: true,
      customFields: true,
      createdAt: true,
      campus: { select: { id: true, name: true } },
      guardians: {
        select: {
          relationship: true,
          isPrimary: true,
          canPickup: true,
          guardian: {
            select: { id: true, fullName: true, phone: true, email: true },
          },
        },
      },
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        select: {
          id: true,
          status: true,
          rollNumber: true,
          classroom: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!student) throw Errors.notFound("That student was not found.");

  // When the actor lacks `student.read_sensitive`, sensitive columns are not
  // selected by Prisma (a `false` select omits the field). We still surface
  // those keys as null plus a flag so the UI can explain the redaction.
  if (!includeSensitive) {
    return {
      ...student,
      nationalId: null,
      medicalNotes: null,
      specialEdNotes: null,
      sensitiveRedacted: true as const,
    };
  }
  return { ...student, sensitiveRedacted: false as const };
}

export type CreateStudentInput = {
  fullName: string;
  preferredName?: string;
  studentNumber?: string;
  nationalId?: string;
  gender?: string;
  birthDate?: Date;
  birthPlace?: string;
  nationality?: string;
  religion?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  email?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalNotes?: string;
  specialEdNotes?: string;
  campusId?: string;
  status?: StudentStatusFilter;
  admissionDate?: Date;
  /** Optional: provision a login account for the student. */
  createAccount?: boolean;
  password?: string;
};

/** Generate the next sequential student number for the tenant (e.g. S-0009). */
async function nextStudentNumber(tenantId: string): Promise<string> {
  const last = await prisma.student.findFirst({
    where: { tenantId, studentNumber: { startsWith: "S-" } },
    orderBy: { studentNumber: "desc" },
    select: { studentNumber: true },
  });
  const n = last ? Number(last.studentNumber.replace(/^S-/, "")) : 0;
  const next = Number.isFinite(n) ? n + 1 : 1;
  return `S-${String(next).padStart(4, "0")}`;
}

export async function createStudent(actor: Actor, input: CreateStudentInput) {
  authorize(actor, "student.create");
  const tenantId = requireTenantId(actor);

  // Sensitive-field writes require the sensitive permission.
  if ((input.medicalNotes || input.specialEdNotes) && !can(actor, "student.read_sensitive")) {
    throw Errors.forbidden("You cannot set sensitive student notes.");
  }

  const studentNumber = input.studentNumber?.trim() || (await nextStudentNumber(tenantId));

  const clash = await prisma.student.findFirst({
    where: { tenantId, studentNumber },
    select: { id: true },
  });
  if (clash) throw Errors.conflict("A student with that number already exists.");

  const student = await prisma.student.create({
    data: {
      tenantId,
      studentNumber,
      fullName: input.fullName.trim(),
      preferredName: input.preferredName?.trim() || null,
      nationalId: input.nationalId?.trim() || null,
      gender: input.gender || null,
      birthDate: input.birthDate ?? null,
      birthPlace: input.birthPlace?.trim() || null,
      nationality: input.nationality?.trim() || null,
      religion: input.religion?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      region: input.region?.trim() || null,
      country: input.country?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      phone: input.phone?.trim() || null,
      emergencyContactName: input.emergencyContactName?.trim() || null,
      emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
      medicalNotes: input.medicalNotes?.trim() || null,
      specialEdNotes: input.specialEdNotes?.trim() || null,
      campusId: input.campusId ?? null,
      status: input.status ?? "ACTIVE",
      admissionDate: input.admissionDate ?? new Date(),
    },
    select: { id: true, studentNumber: true, fullName: true },
  });

  await recordAudit({
    actor,
    action: "student.create",
    resource: "Student",
    resourceId: student.id,
    after: { studentNumber: student.studentNumber, fullName: student.fullName },
  });

  return student;
}

export type UpdateStudentInput = Partial<CreateStudentInput>;

export async function updateStudent(
  actor: Actor,
  studentId: string,
  input: UpdateStudentInput,
) {
  authorize(actor, "student.update");
  const tenantId = requireTenantId(actor);

  const existing = await prisma.student.findFirst({
    where: { id: studentId, tenantId, deletedAt: null },
    select: { id: true, studentNumber: true },
  });
  if (!existing) throw Errors.notFound("That student was not found.");

  if ((input.medicalNotes || input.specialEdNotes) && !can(actor, "student.read_sensitive")) {
    throw Errors.forbidden("You cannot change sensitive student notes.");
  }

  if (input.studentNumber && input.studentNumber !== existing.studentNumber) {
    const clash = await prisma.student.findFirst({
      where: { tenantId, studentNumber: input.studentNumber, id: { not: studentId } },
      select: { id: true },
    });
    if (clash) throw Errors.conflict("A student with that number already exists.");
  }

  const data: Record<string, unknown> = {};
  const assign = <K extends keyof UpdateStudentInput>(key: K, column: string) => {
    if (input[key] !== undefined) {
      const v = input[key];
      data[column] = typeof v === "string" ? v.trim() || null : v;
    }
  };
  assign("fullName", "fullName");
  assign("preferredName", "preferredName");
  assign("studentNumber", "studentNumber");
  assign("nationalId", "nationalId");
  assign("gender", "gender");
  assign("birthDate", "birthDate");
  assign("birthPlace", "birthPlace");
  assign("nationality", "nationality");
  assign("religion", "religion");
  assign("address", "address");
  assign("city", "city");
  assign("region", "region");
  assign("country", "country");
  assign("postalCode", "postalCode");
  assign("email", "email");
  assign("phone", "phone");
  assign("emergencyContactName", "emergencyContactName");
  assign("emergencyContactPhone", "emergencyContactPhone");
  assign("medicalNotes", "medicalNotes");
  assign("specialEdNotes", "specialEdNotes");
  assign("campusId", "campusId");
  assign("status", "status");
  assign("admissionDate", "admissionDate");

  await prisma.student.update({ where: { id: studentId }, data });

  await recordAudit({
    actor,
    action: "student.update",
    resource: "Student",
    resourceId: studentId,
    after: Object.keys(data),
  });
}

/** Soft-delete (archive) a student, keeping history. */
export async function archiveStudent(actor: Actor, studentId: string) {
  authorize(actor, "student.delete");
  const tenantId = requireTenantId(actor);
  const existing = await prisma.student.findFirst({
    where: { id: studentId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw Errors.notFound();

  await prisma.student.update({
    where: { id: studentId },
    data: { deletedAt: new Date(), status: "WITHDRAWN" },
  });
  await recordAudit({
    actor,
    action: "student.archive",
    resource: "Student",
    resourceId: studentId,
  });
}
