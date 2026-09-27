import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Academic structure service: academic years, terms, grade levels, classes,
 * departments, and subjects. All tenant-scoped; all writes permission-gated and
 * audited. Nothing about a specific country's system is hardcoded: labels live
 * on the tenant, and grade levels / streams are data, not enums.
 */

// --- Academic years ---------------------------------------------------------

export async function listAcademicYears(actor: Actor) {
  authorize(actor, "academic.read");
  const tenantId = requireTenantId(actor);
  return prisma.academicYear.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      isCurrent: true,
      status: true,
      _count: { select: { terms: true, classes: true, enrollments: true } },
      terms: {
        select: { id: true, name: true, type: true, sequence: true, isCurrent: true, startDate: true, endDate: true },
        orderBy: { sequence: "asc" },
      },
    },
    orderBy: { startDate: "desc" },
  });
}

export type CreateAcademicYearInput = {
  name: string;
  startDate: Date;
  endDate: Date;
  status?: "PLANNED" | "ACTIVE" | "CLOSED";
  /** Term names to auto-create, e.g. ["Term 1", "Term 2"]. */
  terms?: { name: string; type?: "SEMESTER" | "TRIMESTER" | "QUARTER" | "TERM" | "CUSTOM"; startDate: Date; endDate: Date }[];
};

export async function createAcademicYear(actor: Actor, input: CreateAcademicYearInput) {
  authorize(actor, "academic.manage");
  const tenantId = requireTenantId(actor);

  if (input.endDate <= input.startDate) {
    throw Errors.validation("The end date must be after the start date.", {
      endDate: ["End date must be after the start date."],
    });
  }
  const existing = await prisma.academicYear.findFirst({
    where: { tenantId, name: input.name },
    select: { id: true },
  });
  if (existing) throw Errors.conflict("An academic year with that name already exists.");

  const year = await prisma.$transaction(async (tx) => {
    const created = await tx.academicYear.create({
      data: {
        tenantId,
        name: input.name.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status ?? "PLANNED",
      },
      select: { id: true, name: true },
    });
    if (input.terms && input.terms.length) {
      await tx.academicTerm.createMany({
        data: input.terms.map((t, i) => ({
          academicYearId: created.id,
          name: t.name,
          type: t.type ?? "SEMESTER",
          startDate: t.startDate,
          endDate: t.endDate,
          sequence: i + 1,
          isCurrent: i === 0,
        })),
      });
    }
    return created;
  });

  await recordAudit({
    actor,
    action: "academic_year.create",
    resource: "AcademicYear",
    resourceId: year.id,
    after: { name: year.name },
  });
  return year;
}

/** Mark one academic year as the current one (clears others). */
export async function setCurrentAcademicYear(actor: Actor, yearId: string) {
  authorize(actor, "academic.manage");
  const tenantId = requireTenantId(actor);
  const year = await prisma.academicYear.findFirst({
    where: { id: yearId, tenantId },
    select: { id: true },
  });
  if (!year) throw Errors.notFound();

  await prisma.$transaction([
    prisma.academicYear.updateMany({ where: { tenantId }, data: { isCurrent: false } }),
    prisma.academicYear.update({
      where: { id: yearId },
      data: { isCurrent: true, status: "ACTIVE" },
    }),
  ]);
  await recordAudit({ actor, action: "academic_year.set_current", resource: "AcademicYear", resourceId: yearId });
}

/** Add a term to an academic year. */
export async function addTerm(
  actor: Actor,
  input: { academicYearId: string; name: string; type?: "SEMESTER" | "TRIMESTER" | "QUARTER" | "TERM" | "CUSTOM"; startDate: Date; endDate: Date },
) {
  authorize(actor, "academic.manage");
  const tenantId = requireTenantId(actor);
  const year = await prisma.academicYear.findFirst({
    where: { id: input.academicYearId, tenantId },
    select: { id: true, _count: { select: { terms: true } } },
  });
  if (!year) throw Errors.notFound();

  const term = await prisma.academicTerm.create({
    data: {
      academicYearId: input.academicYearId,
      name: input.name.trim(),
      type: input.type ?? "SEMESTER",
      startDate: input.startDate,
      endDate: input.endDate,
      sequence: year._count.terms + 1,
    },
    select: { id: true },
  });
  await recordAudit({ actor, action: "academic_term.create", resource: "AcademicTerm", resourceId: term.id });
  return term;
}

// --- Grade levels -----------------------------------------------------------

export async function listGradeLevels(actor: Actor) {
  authorize(actor, "academic.read");
  const tenantId = requireTenantId(actor);
  return prisma.gradeLevel.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      code: true,
      sequence: true,
      stage: true,
      isActive: true,
      _count: { select: { classes: true } },
    },
    orderBy: { sequence: "asc" },
  });
}

export async function createGradeLevel(
  actor: Actor,
  input: { name: string; code: string; sequence: number; stage?: string },
) {
  authorize(actor, "academic.manage");
  const tenantId = requireTenantId(actor);
  const existing = await prisma.gradeLevel.findFirst({
    where: { tenantId, code: input.code },
    select: { id: true },
  });
  if (existing) throw Errors.conflict("A grade level with that code already exists.");
  const gl = await prisma.gradeLevel.create({
    data: {
      tenantId,
      name: input.name.trim(),
      code: input.code.trim(),
      sequence: input.sequence,
      stage: input.stage?.trim() || null,
    },
    select: { id: true, name: true },
  });
  await recordAudit({ actor, action: "grade_level.create", resource: "GradeLevel", resourceId: gl.id });
  return gl;
}

// --- Departments ------------------------------------------------------------

export async function listDepartments(actor: Actor) {
  authorize(actor, "subject.read");
  const tenantId = requireTenantId(actor);
  return prisma.department.findMany({
    where: { tenantId },
    select: { id: true, name: true, code: true, description: true, _count: { select: { subjects: true, teachers: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createDepartment(actor: Actor, input: { name: string; code: string; description?: string }) {
  authorize(actor, "subject.manage");
  const tenantId = requireTenantId(actor);
  const existing = await prisma.department.findFirst({ where: { tenantId, code: input.code }, select: { id: true } });
  if (existing) throw Errors.conflict("A department with that code already exists.");
  const dept = await prisma.department.create({
    data: { tenantId, name: input.name.trim(), code: input.code.trim(), description: input.description?.trim() || null },
    select: { id: true, name: true },
  });
  await recordAudit({ actor, action: "department.create", resource: "Department", resourceId: dept.id });
  return dept;
}

// --- Subjects ---------------------------------------------------------------

export async function listSubjects(actor: Actor, params: { search?: string; page?: number; pageSize?: number } = {}) {
  authorize(actor, "subject.read");
  const tenantId = requireTenantId(actor);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const where = {
    tenantId,
    ...(params.search
      ? { OR: [{ name: { contains: params.search, mode: "insensitive" as const } }, { code: { contains: params.search, mode: "insensitive" as const } }] }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.subject.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        credits: true,
        isActive: true,
        department: { select: { id: true, name: true } },
        _count: { select: { teacherAssignments: true, assessments: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.subject.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export type CreateSubjectInput = {
  code: string;
  name: string;
  credits?: number;
  departmentId?: string;
  description?: string;
  learningObjectives?: string;
};

export async function createSubject(actor: Actor, input: CreateSubjectInput) {
  authorize(actor, "subject.manage");
  const tenantId = requireTenantId(actor);
  const existing = await prisma.subject.findFirst({ where: { tenantId, code: input.code }, select: { id: true } });
  if (existing) throw Errors.conflict("A subject with that code already exists.");
  const subject = await prisma.subject.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      credits: input.credits ?? 1,
      departmentId: input.departmentId || null,
      description: input.description?.trim() || null,
      learningObjectives: input.learningObjectives?.trim() || null,
    },
    select: { id: true, name: true },
  });
  await recordAudit({ actor, action: "subject.create", resource: "Subject", resourceId: subject.id });
  return subject;
}

export async function updateSubject(actor: Actor, subjectId: string, input: Partial<CreateSubjectInput> & { isActive?: boolean }) {
  authorize(actor, "subject.manage");
  const tenantId = requireTenantId(actor);
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, tenantId }, select: { id: true } });
  if (!subject) throw Errors.notFound();
  await prisma.subject.update({
    where: { id: subjectId },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.credits !== undefined ? { credits: input.credits } : {}),
      ...(input.departmentId !== undefined ? { departmentId: input.departmentId || null } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.learningObjectives !== undefined ? { learningObjectives: input.learningObjectives || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  await recordAudit({ actor, action: "subject.update", resource: "Subject", resourceId: subjectId });
}

// --- Classes ----------------------------------------------------------------

export async function listClasses(
  actor: Actor,
  params: { academicYearId?: string; gradeLevelId?: string; search?: string } = {},
) {
  authorize(actor, "class.read");
  const tenantId = requireTenantId(actor);
  return prisma.classroom.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
      ...(params.gradeLevelId ? { gradeLevelId: params.gradeLevelId } : {}),
      ...(params.search ? { name: { contains: params.search, mode: "insensitive" as const } } : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      stream: true,
      capacity: true,
      academicYear: { select: { id: true, name: true } },
      gradeLevel: { select: { id: true, name: true } },
      campus: { select: { id: true, name: true } },
      homeroomTeacher: { select: { id: true, fullName: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: [{ gradeLevel: { sequence: "asc" } }, { name: "asc" }],
  });
}

export type CreateClassInput = {
  name: string;
  code: string;
  academicYearId?: string;
  gradeLevelId?: string;
  campusId?: string;
  stream?: string;
  capacity?: number;
  homeroomTeacherId?: string;
};

export async function createClass(actor: Actor, input: CreateClassInput) {
  authorize(actor, "class.manage");
  const tenantId = requireTenantId(actor);
  const existing = await prisma.classroom.findFirst({ where: { tenantId, code: input.code }, select: { id: true } });
  if (existing) throw Errors.conflict("A class with that code already exists.");
  const klass = await prisma.classroom.create({
    data: {
      tenantId,
      name: input.name.trim(),
      code: input.code.trim(),
      academicYearId: input.academicYearId || null,
      gradeLevelId: input.gradeLevelId || null,
      campusId: input.campusId || null,
      stream: input.stream?.trim() || null,
      capacity: input.capacity ?? 30,
      homeroomTeacherId: input.homeroomTeacherId || null,
    },
    select: { id: true, name: true },
  });
  await recordAudit({ actor, action: "class.create", resource: "Classroom", resourceId: klass.id });
  return klass;
}

export async function updateClass(actor: Actor, classId: string, input: Partial<CreateClassInput>) {
  authorize(actor, "class.manage");
  const tenantId = requireTenantId(actor);
  const klass = await prisma.classroom.findFirst({ where: { id: classId, tenantId, deletedAt: null }, select: { id: true } });
  if (!klass) throw Errors.notFound();
  const data: Record<string, unknown> = {};
  for (const key of ["name", "code", "stream"] as const) {
    if (input[key] !== undefined) data[key] = typeof input[key] === "string" ? input[key]!.trim() : input[key];
  }
  for (const key of ["academicYearId", "gradeLevelId", "campusId", "homeroomTeacherId"] as const) {
    if (input[key] !== undefined) data[key] = input[key] || null;
  }
  if (input.capacity !== undefined) data.capacity = input.capacity;
  await prisma.classroom.update({ where: { id: classId }, data });
  await recordAudit({ actor, action: "class.update", resource: "Classroom", resourceId: classId });
}

/** Class roster (students currently enrolled in a classroom). */
export async function getClassRoster(actor: Actor, classId: string) {
  authorize(actor, "class.read");
  const tenantId = requireTenantId(actor);
  const klass = await prisma.classroom.findFirst({
    where: { id: classId, tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      code: true,
      capacity: true,
      stream: true,
      academicYear: { select: { id: true, name: true } },
      gradeLevel: { select: { id: true, name: true } },
      homeroomTeacher: { select: { id: true, fullName: true } },
    },
  });
  if (!klass) throw Errors.notFound();
  const enrollments = await prisma.enrollment.findMany({
    where: { tenantId, classroomId: classId, status: "ACTIVE" },
    select: {
      id: true,
      rollNumber: true,
      student: { select: { id: true, fullName: true, studentNumber: true, status: true } },
    },
    orderBy: [{ rollNumber: "asc" }, { student: { fullName: "asc" } }],
  });
  return { klass, students: enrollments.map((e) => ({ enrollmentId: e.id, rollNumber: e.rollNumber, ...e.student })) };
}
