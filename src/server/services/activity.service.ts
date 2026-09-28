import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize, can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Activities & wellbeing (Phases 75-78).
 *
 * Extracurricular clubs + members + achievements, and the two sensitive record
 * types: counseling (defaults to confidential) and discipline. Wellbeing records
 * are never shown to the student's peers or parents by default - only the
 * counselor/authorized staff roles that hold the matching permission, and always
 * scoped to the actor's tenant.
 */

type AchievementLevel = "SCHOOL" | "DISTRICT" | "REGIONAL" | "NATIONAL" | "INTERNATIONAL";
type CounselingType = "APPOINTMENT" | "SESSION" | "REFERRAL" | "FOLLOW_UP";
type CounselingStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";
type DisciplineSeverity = "MINOR" | "MODERATE" | "MAJOR" | "CRITICAL";
type DisciplineStatus = "OPEN" | "RESOLVED" | "APPEALED" | "CLOSED";

// --- Extracurricular ---------------------------------------------------------

export async function listExtracurriculars(actor: Actor, opts: { activeOnly?: boolean } = {}) {
  authorize(actor, "extracurricular.read");
  const tenantId = requireTenantId(actor);
  return prisma.extracurricular.findMany({
    where: { tenantId, ...(opts.activeOnly ? { isActive: true } : {}) },
    orderBy: { name: "asc" },
    include: { _count: { select: { members: true } } },
  });
}

export async function getExtracurricular(actor: Actor, id: string) {
  authorize(actor, "extracurricular.read");
  const tenantId = requireTenantId(actor);
  const club = await prisma.extracurricular.findFirst({
    where: { id, tenantId },
    include: {
      members: {
        orderBy: { joinedAt: "asc" },
        include: { student: { select: { id: true, fullName: true, studentNumber: true } } },
      },
      achievements: { orderBy: { achievedAt: "desc" } },
    },
  });
  if (!club) throw Errors.notFound("Extracurricular not found.");
  return club;
}

export async function createExtracurricular(
  actor: Actor,
  input: { name: string; description?: string; coachTeacherId?: string; schedule?: string; location?: string; capacity?: number },
) {
  authorize(actor, "extracurricular.manage");
  const tenantId = requireTenantId(actor);
  if (!input.name.trim()) throw Errors.validation("A name is required.");
  const club = await prisma.extracurricular.create({
    data: {
      tenantId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      coachTeacherId: input.coachTeacherId || null,
      schedule: input.schedule?.trim() || null,
      location: input.location?.trim() || null,
      capacity: input.capacity ?? null,
    },
  });
  await recordAudit({ actor, action: "extracurricular.create", resource: "Extracurricular", resourceId: club.id });
  return club;
}

export async function addMember(actor: Actor, clubId: string, input: { studentId: string; role?: string }) {
  authorize(actor, "extracurricular.manage");
  const tenantId = requireTenantId(actor);
  const [club, student] = await Promise.all([
    prisma.extracurricular.findFirst({ where: { id: clubId, tenantId }, select: { id: true } }),
    prisma.student.findFirst({ where: { id: input.studentId, tenantId, deletedAt: null }, select: { id: true } }),
  ]);
  if (!club) throw Errors.notFound("Extracurricular not found.");
  if (!student) throw Errors.notFound("Student not found.");
  const existing = await prisma.extracurricularMember.findFirst({ where: { extracurricularId: clubId, studentId: input.studentId } });
  if (existing) {
    if (existing.isActive) throw Errors.conflict("That student is already a member.");
    const reactivated = await prisma.extracurricularMember.update({ where: { id: existing.id }, data: { isActive: true, role: input.role?.trim() || existing.role } });
    await recordAudit({ actor, action: "extracurricular.member.reactivate", resource: "ExtracurricularMember", resourceId: reactivated.id });
    return reactivated;
  }
  const member = await prisma.extracurricularMember.create({ data: { tenantId, extracurricularId: clubId, studentId: input.studentId, role: input.role?.trim() || null } });
  await recordAudit({ actor, action: "extracurricular.member.add", resource: "ExtracurricularMember", resourceId: member.id });
  return member;
}

export async function removeMember(actor: Actor, memberId: string) {
  authorize(actor, "extracurricular.manage");
  const tenantId = requireTenantId(actor);
  const member = await prisma.extracurricularMember.findFirst({ where: { id: memberId, tenantId }, select: { id: true } });
  if (!member) throw Errors.notFound("Member not found.");
  await prisma.extracurricularMember.update({ where: { id: memberId }, data: { isActive: false } });
  await recordAudit({ actor, action: "extracurricular.member.remove", resource: "ExtracurricularMember", resourceId: memberId });
}

// --- Achievements ------------------------------------------------------------

export async function listAchievements(actor: Actor, opts: { studentId?: string; level?: string } = {}) {
  authorize(actor, "achievement.read");
  const tenantId = requireTenantId(actor);
  return prisma.achievement.findMany({
    where: {
      tenantId,
      ...(opts.studentId ? { studentId: opts.studentId } : {}),
      ...(opts.level ? { level: opts.level as never } : {}),
    },
    orderBy: { achievedAt: "desc" },
    take: 200,
    include: {
      student: { select: { id: true, fullName: true, studentNumber: true } },
      extracurricular: { select: { id: true, name: true } },
    },
  });
}

export async function createAchievement(
  actor: Actor,
  input: {
    title: string;
    studentId?: string;
    teacherId?: string;
    extracurricularId?: string;
    competition?: string;
    level?: AchievementLevel;
    rank?: string;
    achievedAt: Date;
    publishToCms?: boolean;
  },
) {
  authorize(actor, "achievement.manage");
  const tenantId = requireTenantId(actor);
  if (!input.title.trim()) throw Errors.validation("A title is required.");
  if (input.studentId) {
    const student = await prisma.student.findFirst({ where: { id: input.studentId, tenantId, deletedAt: null }, select: { id: true } });
    if (!student) throw Errors.notFound("Student not found.");
  }
  const achievement = await prisma.achievement.create({
    data: {
      tenantId,
      title: input.title.trim(),
      studentId: input.studentId || null,
      teacherId: input.teacherId || null,
      extracurricularId: input.extracurricularId || null,
      competition: input.competition?.trim() || null,
      level: (input.level as never) ?? "SCHOOL",
      rank: input.rank?.trim() || null,
      achievedAt: input.achievedAt,
      publishToCms: input.publishToCms ?? false,
    },
  });
  await recordAudit({ actor, action: "achievement.create", resource: "Achievement", resourceId: achievement.id });
  return achievement;
}

// --- Counseling (restricted) -------------------------------------------------

export async function listCounseling(actor: Actor, opts: { studentId?: string; status?: string } = {}) {
  const tenantId = requireTenantId(actor);

  // Determine whether this actor is themselves a student. A student never sees
  // any counseling record but their own, even if a broad permission was granted
  // by mistake - this closes a "student with counseling.read sees everyone" hole.
  const ownStudent = await prisma.student.findFirst({
    where: { tenantId, userId: actor.userId, deletedAt: null },
    select: { id: true },
  });
  const isStudentActor = !!ownStudent;

  if (!can(actor, "counseling.read") || isStudentActor) {
    if (!ownStudent) return [];
    return prisma.counselingRecord.findMany({
      where: { tenantId, studentId: ownStudent.id, ...(opts.status ? { status: opts.status as never } : {}) },
      orderBy: { occurredAt: "desc" },
    });
  }
  return prisma.counselingRecord.findMany({
    where: { tenantId, ...(opts.studentId ? { studentId: opts.studentId } : {}), ...(opts.status ? { status: opts.status as never } : {}) },
    orderBy: { occurredAt: "desc" },
    take: 200,
    include: { student: { select: { id: true, fullName: true, studentNumber: true } } },
  });
}

export async function createCounseling(
  actor: Actor,
  input: {
    studentId: string;
    type?: CounselingType;
    summary: string;
    notes?: string;
    confidentiality?: "confidential" | "shared";
    scheduledAt?: Date;
    occurredAt?: Date;
    followUpAt?: Date;
  },
) {
  authorize(actor, "counseling.manage");
  const tenantId = requireTenantId(actor);
  const student = await prisma.student.findFirst({ where: { id: input.studentId, tenantId, deletedAt: null }, select: { id: true } });
  if (!student) throw Errors.notFound("Student not found.");
  if (!input.summary.trim()) throw Errors.validation("A summary is required.");
  const record = await prisma.counselingRecord.create({
    data: {
      tenantId,
      studentId: input.studentId,
      counselorUserId: actor.userId,
      type: (input.type as never) ?? "SESSION",
      summary: input.summary.trim(),
      notes: input.notes?.trim() || null,
      confidential: input.confidentiality ? input.confidentiality === "confidential" : true,
      scheduledAt: input.scheduledAt ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      followUpAt: input.followUpAt ?? null,
      status: "OPEN",
    },
  });
  await recordAudit({ actor, action: "counseling.create", resource: "CounselingRecord", resourceId: record.id, metadata: { studentId: input.studentId } });
  return record;
}

export async function updateCounselingStatus(actor: Actor, id: string, status: CounselingStatus) {
  authorize(actor, "counseling.manage");
  const tenantId = requireTenantId(actor);
  const record = await prisma.counselingRecord.findFirst({ where: { id, tenantId }, select: { id: true, status: true } });
  if (!record) throw Errors.notFound("Counseling record not found.");
  const updated = await prisma.counselingRecord.update({ where: { id }, data: { status: status as never } });
  await recordAudit({ actor, action: "counseling.status.update", resource: "CounselingRecord", resourceId: id, before: { status: record.status }, after: { status } });
  return updated;
}

// --- Discipline --------------------------------------------------------------

export async function listDiscipline(actor: Actor, opts: { studentId?: string; status?: string } = {}) {
  authorize(actor, "discipline.read");
  const tenantId = requireTenantId(actor);
  return prisma.disciplineRecord.findMany({
    where: { tenantId, ...(opts.studentId ? { studentId: opts.studentId } : {}), ...(opts.status ? { status: opts.status as never } : {}) },
    orderBy: { occurredAt: "desc" },
    take: 200,
    include: { student: { select: { id: true, fullName: true, studentNumber: true } } },
  });
}

export async function createDiscipline(
  actor: Actor,
  input: {
    studentId: string;
    category: string;
    description: string;
    occurredAt: Date;
    severity?: DisciplineSeverity;
    action?: string;
    followUpAt?: Date;
  },
) {
  authorize(actor, "discipline.manage");
  const tenantId = requireTenantId(actor);
  const student = await prisma.student.findFirst({ where: { id: input.studentId, tenantId, deletedAt: null }, select: { id: true } });
  if (!student) throw Errors.notFound("Student not found.");
  if (!input.category.trim()) throw Errors.validation("A category is required.");
  if (!input.description.trim()) throw Errors.validation("A description is required.");
  const record = await prisma.disciplineRecord.create({
    data: {
      tenantId,
      studentId: input.studentId,
      reportedByUserId: actor.userId,
      category: input.category.trim(),
      description: input.description.trim(),
      occurredAt: input.occurredAt,
      severity: (input.severity as never) ?? "MINOR",
      action: input.action?.trim() || null,
      followUpAt: input.followUpAt ?? null,
      status: "OPEN",
    },
  });
  await recordAudit({ actor, action: "discipline.create", resource: "DisciplineRecord", resourceId: record.id, metadata: { studentId: input.studentId } });
  return record;
}

export async function updateDisciplineStatus(actor: Actor, id: string, status: DisciplineStatus, action?: string) {
  authorize(actor, "discipline.manage");
  const tenantId = requireTenantId(actor);
  const record = await prisma.disciplineRecord.findFirst({ where: { id, tenantId }, select: { id: true, status: true } });
  if (!record) throw Errors.notFound("Discipline record not found.");
  const updated = await prisma.disciplineRecord.update({ where: { id }, data: { status: status as never, ...(action !== undefined ? { action: action.trim() || null } : {}) } });
  await recordAudit({ actor, action: "discipline.status.update", resource: "DisciplineRecord", resourceId: id, before: { status: record.status }, after: { status } });
  return updated;
}

// A student's activity summary for their own portal / guardian view.
export async function getStudentActivitySummary(actor: Actor, studentId: string) {
  const tenantId = requireTenantId(actor);
  const [memberships, achievements] = await Promise.all([
    prisma.extracurricularMember.findMany({
      where: { tenantId, studentId, isActive: true },
      include: { extracurricular: { select: { id: true, name: true, schedule: true } } },
    }),
    prisma.achievement.findMany({ where: { tenantId, studentId }, orderBy: { achievedAt: "desc" }, take: 20 }),
  ]);
  return { memberships, achievements };
}
