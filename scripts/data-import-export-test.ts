/**
 * Documents, import/export, reporting & academic-risk test (Phases 79-83).
 *
 * Proves:
 *   - the CSV parser/serialiser round-trips commas, quotes and newlines;
 *   - student import previews (flags duplicates/blank rows) and commits only valid rows;
 *   - document access levels gate reads (PRIVATE hidden from a colleague);
 *   - reporting aggregates compute from real rows (not fabricated);
 *   - risk indicators are explainable: each carries factors + a data period, and a
 *     student with poor attendance/grade shows up while a healthy one does not.
 */
import { prisma } from "@/server/db/client";
import type { Actor } from "@/types/actor";
import { parseCsv, toCsv, toXlsxXml, previewStudentImport, commitStudentImport } from "@/server/services/data.service";
import { createDocument, getDocument, listDocuments } from "@/server/services/document.service";
import { attendanceTrend, enrollmentByGrade, academicRiskIndicators } from "@/server/services/reporting.service";

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
  return { userId, tenantId, roles: [], roleKeys: [], permissions: new Set(permissions), isPlatform: false } as unknown as Actor;
}

const ADMIN = ["document.read", "document.manage", "student.import", "student.export", "reporting.read", "student.read"];
const COLLEAGUE = ["document.read"];

async function main() {
  const suffix = Date.now().toString(36);
  const tenant = await prisma.tenant.create({ data: { slug: `dat-${suffix}`, name: "DAT" }, select: { id: true } });
  const tenantId = tenant.id;
  const adminUser = await prisma.user.create({ data: { email: `dat-a-${suffix}@x.dev`, fullName: "Admin", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  const otherUser = await prisma.user.create({ data: { email: `dat-b-${suffix}@x.dev`, fullName: "Other", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  const admin = actorFor(tenantId, adminUser.id, ADMIN);
  const colleague = actorFor(tenantId, otherUser.id, COLLEAGUE);

  // --- CSV primitives -------------------------------------------------------
  const tricky = [["name", "note"], ['A, B', 'He said "hi"'], ["multi\nline", "plain"]];
  const csv = toCsv(tricky[0]!, tricky.slice(1));
  const parsed = parseCsv(csv);
  check("CSV header preserved", parsed[0]!.join("|") === "name|note");
  check("CSV comma/quote round-trips", parsed[1]![0] === "A, B" && parsed[1]![1] === 'He said "hi"');
  check("CSV newline-in-cell round-trips", parsed[2]![0] === "multi\nline");
  const xmlOut = toXlsxXml("Sheet", ["a"], [[1]]);
  check("XLSX xml is SpreadsheetML", xmlOut.includes("Excel.Sheet") && xmlOut.includes("ss:Type=\"Number\""));

  // --- Student import -------------------------------------------------------
  const csvText = "fullName,studentNumber,email\nAisyah Putri,S-100,\nBudi Santoso,S-101,\n,S-102\nCici Dewi,S-103\nCici Dewi,S-103\n";
  const preview = await previewStudentImport(admin, csvText);
  check("preview counts data rows", preview.totalRows === 5);
  check("preview flags blank name row", preview.errors.some((e) => e.row === 3 && e.message.includes("fullName")));
  check("preview flags in-file duplicate", preview.errors.some((e) => e.message.includes("duplicated")));
  check("preview keeps the 3 valid rows", preview.validCount === 3);

  const committed = await commitStudentImport(admin, [
    { fullName: "Aisyah Putri", studentNumber: "S-100" },
    { fullName: "Budi Santoso", studentNumber: "S-101" },
  ]);
  check("import commits valid rows", committed.created === 2);
  const rerun = await commitStudentImport(admin, [{ fullName: "Aisyah Putri", studentNumber: "S-100" }]);
  check("re-import skips existing number", rerun.created === 0 && rerun.skipped === 1);
  await expectError("in-payload duplicate refused", () =>
    commitStudentImport(admin, [
      { fullName: "X", studentNumber: "S-200" },
      { fullName: "Y", studentNumber: "S-200" },
    ]),
  );

  const aisyah = await prisma.student.findFirst({ where: { tenantId, studentNumber: "S-100" }, select: { id: true } });
  check("imported student persisted", !!aisyah);

  // --- Documents ------------------------------------------------------------
  const file = await prisma.fileObject.create({
    data: { tenantId, key: `${tenantId}/doc/${suffix}.pdf`, provider: "local", fileName: "policy.pdf", mimeType: "application/pdf", size: 1234, uploadedByUserId: adminUser.id },
    select: { id: true },
  });
  const priv = await createDocument(admin, { fileId: file.id, title: "Board minutes", category: "Governance", accessLevel: "PRIVATE" });
  check("admin reads own private doc", (await getDocument(admin, priv.id)).id === priv.id);
  await expectError("colleague cannot read a PRIVATE doc", () => getDocument(colleague, priv.id));
  check("colleague's list hides PRIVATE", (await listDocuments(colleague)).every((d) => d.id !== priv.id));

  const staffDoc = await createDocument(admin, { fileId: file.id, title: "Staff handbook", category: "HR", accessLevel: "STAFF" });
  check("colleague reads a STAFF doc", (await getDocument(colleague, staffDoc.id)).id === staffDoc.id);

  // --- Reporting from real rows --------------------------------------------
  const year = await prisma.academicYear.create({ data: { tenantId, name: `Y-${suffix}`, startDate: new Date("2025-07-01"), endDate: new Date("2026-06-30"), isCurrent: true }, select: { id: true } });
  const grade = await prisma.gradeLevel.create({ data: { tenantId, name: "Grade 5", code: `G5-${suffix}`, sequence: 5 }, select: { id: true } });
  const classroom = await prisma.classroom.create({ data: { tenantId, gradeLevelId: grade.id, name: "5A", code: `5A-${suffix}`, capacity: 30 }, select: { id: true } });
  await prisma.enrollment.create({ data: { tenantId, studentId: aisyah!.id, classroomId: classroom.id, academicYearId: year.id, status: "ACTIVE" } });

  const enrol = await enrollmentByGrade(admin, year.id);
  check("enrollment aggregate reflects the row", enrol.total === 1 && enrol.byGrade.some((g) => g.name === "Grade 5"));

  const sessionDate = new Date();
  const healthy = await prisma.student.create({ data: { tenantId, fullName: "Healthy", studentNumber: `H-${suffix}` }, select: { id: true } });
  // 5 sessions across 5 days: aisyah absent twice, healthy present once.
  const day = 24 * 60 * 60 * 1000;
  const sessions: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(sessionDate.getTime() - i * day);
    const s = await prisma.attendanceSession.create({ data: { tenantId, classroomId: classroom.id, sessionDate: d, startAt: d, endAt: new Date(d.getTime() + 3600000), status: "CLOSED" }, select: { id: true } });
    sessions.push(s.id);
  }
  for (let i = 0; i < sessions.length; i++) {
    await prisma.attendanceRecord.create({ data: { tenantId, sessionId: sessions[i]!, studentId: aisyah!.id, status: i < 2 ? "ABSENT" : "PRESENT" } });
  }
  await prisma.attendanceRecord.create({ data: { tenantId, sessionId: sessions[0]!, studentId: healthy.id, status: "PRESENT" } });

  const from = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const trend = await attendanceTrend(admin, { from, to: new Date() });
  check("attendance trend totals real records", trend.total === 6);
  check("attendance trend counts absences", trend.absent === 2);

  const risk = await academicRiskIndicators(admin, { days: 30 });
  const flagged = risk.indicators.find((r) => r.studentNumber === `S-100`);
  check("risk flags the low-attendance student", !!flagged);
  check("risk item names its factors", !!flagged && flagged.factors.length > 0);
  check("risk item carries a data period", !!flagged && !!risk.period.from && !!risk.period.to);
  check("risk item requires review", !!flagged && flagged.requiresReview === true);
  check("healthy student not flagged", !risk.indicators.some((r) => r.studentNumber === `H-${suffix}`));

  // --- cleanup --------------------------------------------------------------
  try {
    await prisma.document.deleteMany({ where: { tenantId } });
    await prisma.fileObject.deleteMany({ where: { tenantId } });
    await prisma.attendanceRecord.deleteMany({ where: { tenantId } });
    await prisma.attendanceSession.deleteMany({ where: { tenantId } });
    await prisma.enrollment.deleteMany({ where: { tenantId } });
    await prisma.student.deleteMany({ where: { tenantId } });
    await prisma.classroom.deleteMany({ where: { tenantId } });
    await prisma.gradeLevel.deleteMany({ where: { tenantId } });
    await prisma.academicYear.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, otherUser.id] } } });
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
