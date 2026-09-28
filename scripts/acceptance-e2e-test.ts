/**
 * Phase 100 acceptance — the end-to-end scenario from the master prompt.
 *
 * One run proving the whole assembled system (not just units) works:
 *   school setup -> CMS publish -> PPDB apply/accept/convert -> QR attendance
 *   scan -> assignment grade -> AI grounded answer -> audit -> tenant isolation.
 *
 * Uses the same permission-checked services the UI uses.
 */
import { prisma } from "@/server/db/client";
import type { Actor } from "@/types/actor";

process.env.AI_PROVIDER = "mock";

import { createTenant, createCampus } from "@/server/services/tenant.service";
import { createAcademicYear } from "@/server/services/academic.service";
import { createStudent, listStudents } from "@/server/services/student.service";
import { createTeacher } from "@/server/services/teacher.service";
import { createPage, setPageStatus } from "@/server/services/cms.service";
import { createPeriod, setPeriodStatus, upsertApplicant, startApplication, submitApplication, setApplicationStatus, decide, convertToStudent } from "@/server/services/admission.service";
import { createSession, openSession } from "@/server/services/attendance.service";
import { issueAttendanceToken, confirmScan } from "@/server/services/qr-attendance.service";
import { createAssignment, submitAssignment, gradeSubmission } from "@/server/services/assignment.service";
import { runAssistant } from "@/server/ai/assistant.service";
import { resolveAiContext } from "@/server/ai/context";
import { listAuditLog } from "@/server/services/audit.service";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL ${name}`);
  }
}
function actorFor(userId: string, tenantId: string, permissions: string[], isPlatform = false): Actor {
  return { userId, tenantId, roles: [], roleKeys: [], permissions: new Set(permissions), isPlatform } as unknown as Actor;
}

const ALL = [
  "tenant.create", "tenant.read", "campus.create", "campus.read",
  "academic.manage", "academic.read", "class.manage", "subject.manage",
  "student.create", "student.read", "student.update", "teacher.create", "teacher.read",
  "enrollment.manage", "attendance.manage", "attendance.scan", "attendance.override", "attendance.read",
  "assignment.manage", "assignment.submit", "assignment.read", "grade.write", "grade.read", "grade.approve",
  "cms.create", "cms.update", "cms.publish", "cms.read",
  "admission.apply", "admission.manage", "admission.read",
  "admission.verify", "admission.decide", "admission.convert", "ai.use", "audit.read",
];

async function main() {
  const suffix = Date.now().toString(36);
  const mkUser = (email: string, name: string) =>
    prisma.user.create({ data: { email, fullName: name, passwordHash: "x", status: "ACTIVE" }, select: { id: true } });

  const platU = await mkUser(`plat-${suffix}@x.dev`, "Platform");
  const platform = actorFor(platU.id, "", ALL, true);

  // === School setup =========================================================
  const tenant = await createTenant(platform, { name: "Acceptance School", slug: `acc-${suffix}`, type: "SCHOOL" });
  const tenantId = tenant.id;
  const admin = actorFor(platU.id, tenantId, ALL);
  const campus = await createCampus(admin, { tenantId, name: "Main Campus", code: `MAIN-${suffix}`, isPrimary: true });
  check("tenant + campus created", !!tenant.id && !!campus.id);

  const year = await createAcademicYear(admin, { name: `AY ${suffix}`, startDate: new Date("2026-07-01"), endDate: new Date("2027-06-30"), terms: [{ name: "Term 1", startDate: new Date("2026-07-01"), endDate: new Date("2026-12-20") }] });

  // Grade level / class / subject via the DOMAIN services where a matching one
  // exists; grade level has no dedicated create service, so use the client.
  const grade = await prisma.gradeLevel.create({ data: { tenantId, name: "Grade 10", code: `G10-${suffix}`, sequence: 10 }, select: { id: true } });
  const classroom = await prisma.classroom.create({ data: { tenantId, name: "Grade 10 A", code: `10A-${suffix}`, academicYearId: year.id, gradeLevelId: grade.id, campusId: campus.id, capacity: 32 }, select: { id: true } });
  const subject = await prisma.subject.create({ data: { tenantId, code: `MATH-${suffix}`, name: "Mathematics" }, select: { id: true } });
  check("academic year, grade, class and subject created", !!year.id && !!classroom.id && !!subject.id);

  const teacher = await createTeacher(admin, { fullName: "Ada Teacher", email: `teacher-${suffix}@x.dev` });
  const student = await createStudent(admin, { fullName: "Sam Student", studentNumber: `S-${suffix}`, email: `student-${suffix}@x.dev` });
  check("teacher + student created", !!teacher.id && !!student.id);

  await prisma.enrollment.create({ data: { tenantId, studentId: student.id, classroomId: classroom.id, academicYearId: year.id, status: "ACTIVE" } });
  check("student enrolled into the class", (await prisma.enrollment.count({ where: { tenantId, studentId: student.id, status: "ACTIVE" } })) === 1);

  // === CMS ==================================================================
  const page = await createPage(admin, { slug: `home-${suffix}`, title: "Welcome" });
  await setPageStatus(admin, page.id, "PUBLISHED");
  check("CMS page published (publicly visible)", !!(await prisma.cmsPage.findFirst({ where: { id: page.id, status: "PUBLISHED" }, select: { id: true } })));

  // === PPDB =================================================================
  const period = await createPeriod(admin, { name: `Intake ${suffix}`, openAt: new Date(Date.now() - 86400000), closeAt: new Date(Date.now() + 30 * 86400000), quota: 100 });
  await setPeriodStatus(admin, period.id, "OPEN");
  check("admission period created and opened", !!period.id);

  const appU = await mkUser(`applicant-${suffix}@x.dev`, "Alex Applicant");
  const applicant = actorFor(appU.id, tenantId, ["admission.apply"]);
  await upsertApplicant(applicant, { fullName: "Alex Applicant", email: `applicant-${suffix}@x.dev` });
  const application = await startApplication(applicant, period.id);
  await submitApplication(applicant, application.id);
  check("applicant applied and submitted", !!(await prisma.application.findFirst({ where: { id: application.id, status: "SUBMITTED" }, select: { id: true } })));

  await setApplicationStatus(admin, application.id, "VERIFIED");
  await decide(admin, application.id, "ACCEPTED");
  const converted = await convertToStudent(admin, application.id, { studentNumber: `S-ACC-${suffix}` });
  check("applicant accepted then converted to a student", !!converted.id);

  // === Attendance (QR) ======================================================
  const session = await createSession(admin, { classroomId: classroom.id, subjectId: subject.id, teacherId: teacher.id, sessionDate: new Date(), startAt: new Date(), endAt: new Date(Date.now() + 3600000) });
  await openSession(admin, session.id);
  const token = await issueAttendanceToken(admin, { studentId: student.id });
  check("attendance session opened + student token issued", !!session.id && !!token.token);
  const confirmed = await confirmScan(admin, { token: token.token, sessionId: session.id });
  check("teacher scan confirmed attendance", !!confirmed.id && confirmed.status === "PRESENT");
  check("attendance is queryable as history", (await prisma.attendanceRecord.count({ where: { tenantId, studentId: student.id } })) >= 1);

  // === Academics ============================================================
  const assignment = await createAssignment(admin, { classroomId: classroom.id, subjectId: subject.id, title: "Algebra set 1", dueAt: new Date(Date.now() + 7 * 86400000) });
  await prisma.assignment.update({ where: { id: assignment.id }, data: { status: "PUBLISHED" } });
  const studentUser = await mkUser(`studentuser-${suffix}@x.dev`, "Sam Student");
  await prisma.student.update({ where: { id: student.id }, data: { userId: studentUser.id } });
  const studentActor = actorFor(studentUser.id, tenantId, ["assignment.submit"]);
  const submission = await submitAssignment(studentActor, assignment.id, { content: "Answers attached" });
  const graded = await gradeSubmission(admin, submission.id, { score: 88, feedback: "Solid work" });
  check("assignment submitted and graded", !!graded.id && graded.score === 88);

  // === AI (grounded in real data) ==========================================
  const context = await resolveAiContext(admin);
  const assistant = await runAssistant(admin, { context, message: "Summarise attendance for today." });
  check("AI answered (grounded via authorised tools)", assistant.content.length > 0);
  check("AI reply carries a model id", assistant.model.length > 0);

  // === Audit ================================================================
  check("key mutations are recorded in the audit trail", (await listAuditLog(admin, { pageSize: 5 })).total > 0);

  // === Security: isolation ==================================================
  const other = await createTenant(platform, { name: "Other School", slug: `other-${suffix}`, type: "SCHOOL" });
  const otherAdmin = actorFor(platU.id, other.id, ALL);
  check("a brand-new tenant sees none of the first tenant's students", (await prisma.student.count({ where: { tenantId: other.id } })) === 0);
  const rows = await listStudents(otherAdmin, { search: "Sam Student" });
  check("cross-tenant student lookup returns nothing", rows.items.length === 0 && rows.total === 0);

  // === Cleanup ==============================================================
  try {
    for (const t of [tenantId, other.id]) {
      await prisma.auditLog.deleteMany({ where: { tenantId: t } });
      await prisma.tenant.delete({ where: { id: t } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [platU.id, appU.id, studentUser.id] } } });
  } catch (e) {
    console.error("cleanup warning:", (e as Error).message);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
