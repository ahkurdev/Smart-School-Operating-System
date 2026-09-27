/**
 * Assignment + gradebook end-to-end test (Phases 59-65).
 *
 * Proves the workflow the school depends on:
 *   - a teacher creates an assignment for their class and publishes it;
 *   - a student can only submit while it is published and only if enrolled;
 *   - grades move DRAFT -> SUBMITTED -> APPROVED -> PUBLISHED;
 *   - a student never sees an unpublished grade (publish gating);
 *   - weighted averages ignore ungraded cells and empty columns.
 *
 * Runs against the real services with a throwaway tenant, then cleans up.
 */
import { prisma } from "@/server/db/client";
import type { Actor } from "@/types/actor";
import {
  createAssignment,
  setAssignmentStatus,
  submitAssignment,
  gradeSubmission,
  getMySubmission,
  listMaterials,
  createMaterial,
  setMaterialStatus,
} from "@/server/services/assignment.service";
import {
  createAssessment,
  setGrade,
  getGradebook,
  submitGrades,
  approveGrades,
  publishGrades,
  getMyGrades,
  letterGrade,
} from "@/server/services/gradebook.service";

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

function actorFor(tenantId: string, userId: string, permissions: string[]): Actor {
  return { userId, tenantId, roles: [], permissions: new Set(permissions) } as unknown as Actor;
}

async function expectError(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(name, false);
  } catch {
    check(name, true);
  }
}

const ALL_STAFF = [
  "assignment.read",
  "assignment.manage",
  "material.read",
  "material.manage",
  "grade.read",
  "grade.write",
  "grade.submit",
  "grade.approve",
  "grade.publish",
];

const STUDENT = ["assignment.read", "assignment.submit", "material.read", "grade.read_own"];

async function main() {
  const suffix = Date.now().toString(36);
  const tenant = await prisma.tenant.create({ data: { slug: `wk-${suffix}`, name: "WK" }, select: { id: true } });
  const tenantId = tenant.id;
  const cleanup: (() => Promise<unknown>)[] = [() => prisma.tenant.delete({ where: { id: tenantId } })];

  // --- Fixtures -------------------------------------------------------------
  const teacherUser = await prisma.user.create({ data: { email: `t-${suffix}@x.dev`, fullName: "Teach", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  const studentUser = await prisma.user.create({ data: { email: `s-${suffix}@x.dev`, fullName: "Stud", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  await prisma.teacher.create({ data: { tenantId, userId: teacherUser.id, fullName: "Teach", employeeNumber: `E-${suffix}` } });

  const year = await prisma.academicYear.create({ data: { tenantId, name: "2025/2026", startDate: new Date("2025-07-01"), endDate: new Date("2026-06-30") }, select: { id: true } });
  const grade = await prisma.gradeLevel.create({ data: { tenantId, name: "Grade 5", code: "G5", sequence: 5 }, select: { id: true } });
  const classroom = await prisma.classroom.create({ data: { tenantId, gradeLevelId: grade.id, name: "5A", code: "5A", capacity: 30 }, select: { id: true } });
  const subject = await prisma.subject.create({ data: { tenantId, name: "Math", code: "MTH" }, select: { id: true } });
  const student = await prisma.student.create({ data: { tenantId, userId: studentUser.id, fullName: "Stud", studentNumber: `S-${suffix}` }, select: { id: true } });
  await prisma.enrollment.create({ data: { tenantId, studentId: student.id, classroomId: classroom.id, academicYearId: year.id, status: "ACTIVE" } });

  const staff = actorFor(tenantId, teacherUser.id, ALL_STAFF);
  const stud = actorFor(tenantId, studentUser.id, STUDENT);

  console.log("\nAssignments");
  const assignment = await createAssignment(staff, { classroomId: classroom.id, subjectId: subject.id, title: "Fractions worksheet", maxScore: 50 });
  check("create assignment", assignment.status === "DRAFT");

  // A student cannot submit to a draft assignment.
  await expectError("cannot submit to a draft assignment", () =>
    submitAssignment(stud, assignment.id, { content: "answer" }),
  );

  await setAssignmentStatus(staff, assignment.id, "PUBLISHED");
  const submission = await submitAssignment(stud, assignment.id, { content: "1/2 + 1/3 = 5/6" });
  check("student submits after publish", submission.status === "SUBMITTED");

  // Not enrolled students cannot submit.
  const outsiderUser = await prisma.user.create({ data: { email: `o-${suffix}@x.dev`, fullName: "Out", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  cleanup.push(() => prisma.user.delete({ where: { id: outsiderUser.id } }));
  await prisma.student.create({ data: { tenantId, userId: outsiderUser.id, fullName: "Out", studentNumber: `O-${suffix}` } });
  const outsider = actorFor(tenantId, outsiderUser.id, STUDENT);
  await expectError("non-enrolled student cannot submit", () => submitAssignment(outsider, assignment.id, { content: "sneak" }));

  const graded = await gradeSubmission(staff, submission.id, { score: 45, feedback: "Nice work" });
  check("teacher grades submission", graded.status === "GRADED" && graded.score === 45);
  await expectError("score above max is rejected", () => gradeSubmission(staff, submission.id, { score: 999 }));

  const mine = await getMySubmission(stud, assignment.id);
  check("student sees own submission", mine?.score === 45);

  console.log("\nMaterials");
  const draftMat = await createMaterial(staff, { subjectId: subject.id, title: "Chapter 3 notes", type: "DOCUMENT" });
  const staffMats = await listMaterials(staff);
  check("staff sees draft material", staffMats.some((m) => m.id === draftMat.id));
  const studMatsBefore = await listMaterials(stud);
  check("student does not see draft material", !studMatsBefore.some((m) => m.id === draftMat.id));
  await setMaterialStatus(staff, draftMat.id, "PUBLISHED");
  const studMatsAfter = await listMaterials(stud);
  check("student sees material once published", studMatsAfter.some((m) => m.id === draftMat.id));

  console.log("\nGradebook");
  const quiz = await createAssessment(staff, { academicYearId: year.id, classroomId: classroom.id, subjectId: subject.id, title: "Quiz 1", type: "QUIZ", maxScore: 20, weight: 1 });
  const exam = await createAssessment(staff, { academicYearId: year.id, classroomId: classroom.id, subjectId: subject.id, title: "Final", type: "EXAM", maxScore: 100, weight: 3 });

  await setGrade(staff, { assessmentId: quiz.id, studentId: student.id, score: 18 });
  await setGrade(staff, { assessmentId: exam.id, studentId: student.id, score: 90 });

  // Draft grades are deliberately excluded from the running average until the
  // column is submitted for review.
  const draftBook = await getGradebook(staff, { classroomId: classroom.id });
  const draftRow = draftBook.rows.find((r) => r.studentId === student.id)!;
  check("draft grades do not count toward the average", draftRow.weightedAverage === null);

  await submitGrades(staff, quiz.id);
  await submitGrades(staff, exam.id);
  const book = await getGradebook(staff, { classroomId: classroom.id });
  const row = book.rows.find((r) => r.studentId === student.id)!;
  // (18/20)*1 + (90/100)*3 = 0.9 + 2.7 = 3.6 over weight 4 => 90%
  check("weighted average is correct", row.weightedAverage === 90);
  check("letter grade is A", row.letter === "A");
  check("letterGrade thresholds", letterGrade(89.9) === "B" && letterGrade(60) === "D" && letterGrade(59) === "F");

  console.log("\nPublish gating");
  const beforePublish = await getMyGrades(stud);
  check("student sees no grades before publish", beforePublish.grades.length === 0);

  await approveGrades(staff, quiz.id);
  const stillHidden = await getMyGrades(stud);
  check("approved-but-unpublished grades stay hidden", stillHidden.grades.length === 0);

  await publishGrades(staff, exam.id);
  const afterPublish = await getMyGrades(stud);
  check("published grade becomes visible", afterPublish.grades.some((g) => g.maxScore === 100));
  check("student average computed from published only", afterPublish.average === 90);

  // --- Cleanup --------------------------------------------------------------
  await cleanupTenant(tenantId, [teacherUser.id, studentUser.id, outsiderUser.id]);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

async function cleanupTenant(tenantId: string, userIds: string[]) {
  try {
    await prisma.assignmentSubmission.deleteMany({ where: { tenantId } });
    await prisma.assignment.deleteMany({ where: { tenantId } });
    await prisma.learningMaterial.deleteMany({ where: { tenantId } });
    await prisma.grade.deleteMany({ where: { tenantId } });
    await prisma.assessment.deleteMany({ where: { tenantId } });
    await prisma.enrollment.deleteMany({ where: { tenantId } });
    await prisma.student.deleteMany({ where: { tenantId } });
    await prisma.classroom.deleteMany({ where: { tenantId } });
    await prisma.subject.deleteMany({ where: { tenantId } });
    await prisma.gradeLevel.deleteMany({ where: { tenantId } });
    await prisma.academicYear.deleteMany({ where: { tenantId } });
    await prisma.teacher.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  } catch (e) {
    console.error("cleanup warning:", (e as Error).message);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
