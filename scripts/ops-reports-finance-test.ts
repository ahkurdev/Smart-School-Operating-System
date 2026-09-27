/**
 * Reports, communication & finance end-to-end test (Phases 66-70).
 *
 * Proves:
 *   - a report card snapshots published grades + attendance, and stays hidden
 *     from the student until published;
 *   - announcements only reach non-managers when published, and
 *     acknowledgement is idempotent;
 *   - an invoice status is always derived from payments (UNPAID/PARTIAL/PAID)
 *     and over-payment is refused; finance summary reconciles.
 */
import { prisma } from "@/server/db/client";
import type { Actor } from "@/types/actor";
import { generateReportCard, setReportCardStatus, getMyReportCards, getReportCard } from "@/server/services/reportcard.service";
import { createAnnouncement, publishAnnouncement, acknowledgeAnnouncement, listAnnouncements } from "@/server/services/announcement.service";
import { createInvoice, recordPayment, getFinanceSummary } from "@/server/services/finance.service";

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
async function expectError(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(name, false);
  } catch {
    check(name, true);
  }
}

function actorFor(tenantId: string, userId: string, permissions: string[]): Actor {
  return { userId, tenantId, roles: [], permissions: new Set(permissions) } as unknown as Actor;
}

const STAFF = ["grade.read", "grade.write", "grade.publish", "grade.read_own", "announcement.read", "announcement.manage", "finance.read", "finance.manage", "reporting.read"];
const STUDENT_VIEW = ["grade.read_own", "announcement.read"];

async function main() {
  const suffix = Date.now().toString(36);
  const tenant = await prisma.tenant.create({ data: { slug: `op-${suffix}`, name: "OP" }, select: { id: true } });
  const tenantId = tenant.id;

  const staffUser = await prisma.user.create({ data: { email: `of-${suffix}@x.dev`, fullName: "Staff", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  const studentUser = await prisma.user.create({ data: { email: `os-${suffix}@x.dev`, fullName: "Stud", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });

  const year = await prisma.academicYear.create({ data: { tenantId, name: "2025/2026", startDate: new Date("2025-07-01"), endDate: new Date("2026-06-30"), isCurrent: true }, select: { id: true } });
  const grade = await prisma.gradeLevel.create({ data: { tenantId, name: "Grade 6", code: "G6", sequence: 6 }, select: { id: true } });
  const classroom = await prisma.classroom.create({ data: { tenantId, gradeLevelId: grade.id, name: "6A", code: "6A", capacity: 30 }, select: { id: true } });
  const subject = await prisma.subject.create({ data: { tenantId, name: "Science", code: "SCI" }, select: { id: true } });
  const student = await prisma.student.create({ data: { tenantId, userId: studentUser.id, fullName: "Stud", studentNumber: `S-${suffix}` }, select: { id: true } });
  await prisma.enrollment.create({ data: { tenantId, studentId: student.id, classroomId: classroom.id, academicYearId: year.id, status: "ACTIVE" } });

  const staff = actorFor(tenantId, staffUser.id, STAFF);
  const studView = actorFor(tenantId, studentUser.id, STUDENT_VIEW);

  // --- A published grade + some attendance to snapshot ----------------------
  const assessment = await prisma.assessment.create({
    data: { tenantId, academicYearId: year.id, classroomId: classroom.id, subjectId: subject.id, title: "Unit test", type: "EXAM", maxScore: 100, weight: 1, status: "PUBLISHED" },
    select: { id: true },
  });
  await prisma.grade.create({ data: { tenantId, assessmentId: assessment.id, studentId: student.id, score: 88, status: "PUBLISHED", publishedAt: new Date() } });

  const session = await prisma.attendanceSession.create({
    data: {
      tenantId,
      classroomId: classroom.id,
      subjectId: subject.id,
      academicYearId: year.id,
      sessionDate: new Date(),
      startAt: new Date(),
      endAt: new Date(Date.now() + 45 * 60000),
      status: "CLOSED",
    },
    select: { id: true },
  });
  await prisma.attendanceRecord.createMany({
    data: [
      { tenantId, sessionId: session.id, studentId: student.id, status: "PRESENT" },
    ],
  });

  console.log("\nReport cards");
  const card = await generateReportCard(staff, { studentId: student.id, academicYearId: year.id });
  const lines = card.grades as unknown as { subject: string; average: number | null; letter: string | null }[];
  check("report card snapshots the subject average", lines.length === 1 && lines[0]!.subject === "Science" && lines[0]!.average === 88);
  check("report card snapshot has a letter grade", lines[0]!.letter === "B");
  const att = card.attendanceSummary as unknown as { present: number; rate: number | null };
  check("report card snapshots attendance", att.present === 1 && att.rate === 100);
  check("new report card is a draft", card.status === "DRAFT");

  const hidden = await getMyReportCards(studView);
  check("student sees no draft report card", hidden.length === 0);

  await setReportCardStatus(staff, card.id, "PUBLISHED");
  const visible = await getMyReportCards(studView);
  check("student sees published report card", visible.length === 1);

  // Even with the id, a student cannot read an unpublished card.
  const card2 = await generateReportCard(staff, { studentId: student.id, academicYearId: year.id, teacherRemarks: "improved" });
  check("regenerating keeps one card per student/year/term", card2.id === card.id);
  // (regenerate resets to DRAFT)
  await expectError("student cannot read card while draft", () => getReportCard(studView, card.id));

  console.log("\nAnnouncements");
  const draft = await createAnnouncement(staff, { title: "Sports day", body: "Friday", audience: "ALL" });
  const staffView = await listAnnouncements(staff, { includeDrafts: true });
  check("staff sees draft announcement", staffView.some((a) => a.id === draft.id));
  const studentSeesDraft = await listAnnouncements(studView);
  check("student does not see draft announcement", !studentSeesDraft.some((a) => a.id === draft.id));

  await publishAnnouncement(staff, draft.id);
  const studentSeesPublished = await listAnnouncements(studView);
  check("student sees published announcement", studentSeesPublished.some((a) => a.id === draft.id));

  await acknowledgeAnnouncement(studView, draft.id);
  await acknowledgeAnnouncement(studView, draft.id); // idempotent
  const ackCount = await prisma.announcementAcknowledgment.count({ where: { announcementId: draft.id, userId: studentUser.id } });
  check("acknowledgement is idempotent", ackCount === 1);

  console.log("\nFinance");
  const invoice = await createInvoice(staff, {
    studentId: student.id,
    academicYearId: year.id,
    dueDate: new Date(Date.now() + 7 * 864e5),
    items: [
      { description: "Tuition", unitPrice: 1000000 },
      { description: "Books", unitPrice: 250000, quantity: 2 },
    ],
  });
  check("invoice subtotal sums line items", invoice.subtotal === 1500000);
  check("invoice starts UNPAID", invoice.status === "UNPAID");

  await recordPayment(staff, invoice.id, { amount: 500000, method: "BANK_TRANSFER" });
  let inv = await prisma.invoice.findUnique({ where: { id: invoice.id }, select: { status: true, paidAmount: true } });
  check("partial payment sets PARTIAL", inv!.status === "PARTIAL" && inv!.paidAmount === 500000);

  await expectError("over-payment is refused", () => recordPayment(staff, invoice.id, { amount: 2000000 }));

  await recordPayment(staff, invoice.id, { amount: 1000000 });
  inv = await prisma.invoice.findUnique({ where: { id: invoice.id }, select: { status: true, paidAmount: true } });
  check("full payment sets PAID", inv!.status === "PAID" && inv!.paidAmount === 1500000);

  const summary = await getFinanceSummary(staff);
  check("summary reconciles", summary.billed === 1500000 && summary.collected === 1500000 && summary.outstanding === 0);

  // --- Cleanup --------------------------------------------------------------
  try {
    await prisma.payment.deleteMany({ where: { tenantId } });
    await prisma.invoiceItem.deleteMany({ where: { tenantId } });
    await prisma.invoice.deleteMany({ where: { tenantId } });
    await prisma.announcementAcknowledgment.deleteMany({ where: { tenantId } });
    await prisma.classAnnouncementLink.deleteMany({ where: { announcement: { tenantId } } });
    await prisma.announcement.deleteMany({ where: { tenantId } });
    await prisma.reportCard.deleteMany({ where: { tenantId } });
    await prisma.attendanceRecord.deleteMany({ where: { tenantId } });
    await prisma.attendanceSession.deleteMany({ where: { tenantId } });
    await prisma.grade.deleteMany({ where: { tenantId } });
    await prisma.assessment.deleteMany({ where: { tenantId } });
    await prisma.enrollment.deleteMany({ where: { tenantId } });
    await prisma.student.deleteMany({ where: { tenantId } });
    await prisma.classroom.deleteMany({ where: { tenantId } });
    await prisma.subject.deleteMany({ where: { tenantId } });
    await prisma.gradeLevel.deleteMany({ where: { tenantId } });
    await prisma.academicYear.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { id: { in: [staffUser.id, studentUser.id] } } });
    await prisma.tenant.delete({ where: { id: tenantId } });
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
