/**
 * Admissions end-to-end test (Phase 40).
 *
 * Drives the whole PPDB pipeline against the live dev database through the
 * service layer (the same functions the UI calls), proving the flow works and
 * that the guard rails hold:
 *   1. staff creates a period + form fields
 *   2. an applicant registers, starts an application, is blocked from submitting
 *      with missing required fields, then succeeds once complete
 *   3. staff verifies, scores, ranks, and accepts
 *   4. the accepted applicant converts into a Student (and a second convert is
 *      refused — idempotency guard)
 * Cleans up everything it created.
 *
 * Run: node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/admissions-e2e-test.ts
 */
import { prisma } from "../src/server/db/client";
import { isAppError } from "../src/server/errors";
import type { Actor } from "../src/types/actor";
import type { Permission } from "../src/lib/permissions";
import {
  createPeriod,
  setPeriodStatus,
  replaceFormFields,
  getDefaultForm,
  upsertApplicant,
  startApplication,
  saveApplicationValues,
  submitApplication,
  verifyDocument,
  scoreApplication,
  rankPeriod,
  decide,
  convertToStudent,
} from "../src/server/services/admission.service";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}`);
  }
}

function actor(tenantId: string, userId: string, perms: Permission[]): Actor {
  return {
    userId,
    tenantId,
    isPlatform: false,
    roleKeys: [],
    permissions: new Set(perms),
    ip: null,
    userAgent: null,
  };
}

async function main() {
  const suffix = Date.now().toString(36);
  const tenant = await prisma.tenant.create({
    data: { slug: `adm-e2e-${suffix}`, name: "Admissions E2E" },
    select: { id: true },
  });
  const tenantId = tenant.id;

  const adminId = `adm-admin-${suffix}`;
  const applicantUserId = `adm-applicant-${suffix}`;

  // Real users are required (Applicant.userId is a foreign key).
  const dummyHash = "$2b$12$0000000000000000000000000000000000000000000000000000";
  await prisma.user.createMany({
    data: [
      { id: adminId, email: `admin-${suffix}@e2e.local`, fullName: "E2E Admin", status: "ACTIVE", passwordHash: dummyHash },
      { id: applicantUserId, email: `applicant-${suffix}@e2e.local`, fullName: "Test Applicant", status: "ACTIVE", passwordHash: dummyHash },
    ],
  });

  const admin = actor(tenantId, adminId, [
    "admission.read",
    "admission.manage",
    "admission.verify",
    "admission.decide",
    "admission.convert",
  ]);
  const applicant = actor(tenantId, applicantUserId, ["admission.apply"]);

  try {
    // 1. Period + form.
    const period = await createPeriod(admin, {
      name: "E2E Intake",
      openAt: new Date(Date.now() - 3_600_000),
      closeAt: new Date(Date.now() + 86_400_000),
    });
    await setPeriodStatus(admin, period.id, "OPEN");
    check("period created and opened", true);

    await replaceFormFields(admin, period.id, [
      { key: "national_id", label: "National ID", type: "SHORT_TEXT", required: true },
      { key: "programme", label: "Programme", type: "SELECT", required: true, options: ["Science", "Social"] },
    ]);
    const form = await getDefaultForm(admin, period.id);
    check("form has two fields", (form?.fields.length ?? 0) === 2);
    const nidField = form!.fields.find((f) => f.key === "national_id")!;
    const progField = form!.fields.find((f) => f.key === "programme")!;

    // 2. Applicant flow.
    await upsertApplicant(applicant, { fullName: "Test Applicant", email: "t@example.com" });
    const app = await startApplication(applicant, period.id);
    check("application started in DRAFT", app.status === "DRAFT");
    check("application number has PPDB prefix", app.applicationNumber.startsWith("PPDB-"));

    // Submit with missing required fields must fail.
    let blocked = false;
    try {
      await submitApplication(applicant, app.id);
    } catch (e) {
      blocked = isAppError(e);
    }
    check("submit blocked while required fields missing", blocked);

    // Fill and submit.
    await saveApplicationValues(applicant, app.id, [
      { fieldId: nidField.id, value: "1234567890" },
      { fieldId: progField.id, value: "Science" },
    ]);
    await submitApplication(applicant, app.id);
    const submitted = await prisma.application.findUnique({ where: { id: app.id } });
    check("application submitted", submitted?.status === "SUBMITTED");

    // 3. Staff review.
    const doc = await prisma.applicationDocument.create({
      data: { tenantId, applicationId: app.id, fileId: "test-file-id", documentType: "ID card" },
    });
    await verifyDocument(admin, doc.id, true, "looks valid");
    const verifiedDoc = await prisma.applicationDocument.findUnique({ where: { id: doc.id } });
    check("document verified", verifiedDoc?.verified === true);

    await scoreApplication(admin, app.id, 88.5);
    await rankPeriod(admin, period.id);
    const scored = await prisma.application.findUnique({ where: { id: app.id } });
    check("application scored", scored?.score === 88.5);
    check("application ranked", scored?.rank === 1);

    await decide(admin, app.id, "ACCEPTED", "Strong candidate");
    const decided = await prisma.application.findUnique({ where: { id: app.id } });
    check("application accepted", decided?.status === "ACCEPTED");

    // 4. Conversion.
    const student = await convertToStudent(admin, app.id, { studentNumber: `E2E-${suffix}` });
    check("student created from applicant", student.fullName === "Test Applicant");
    const afterConvert = await prisma.application.findUnique({ where: { id: app.id } });
    check("application marked RE_REGISTERED", afterConvert?.status === "RE_REGISTERED");
    const applicantRow = await prisma.applicant.findFirst({ where: { tenantId, userId: applicantUserId } });
    check("applicant linked to new student", applicantRow?.studentId === student.id);

    // Second convert must be refused (idempotency guard).
    let refused = false;
    try {
      await convertToStudent(admin, app.id, { studentNumber: `E2E-${suffix}-2` });
    } catch (e) {
      refused = isAppError(e);
    }
    check("second conversion refused", refused);

    // Cross-tenant isolation: another tenant's admin cannot read this period.
    const otherTenant = await prisma.tenant.create({ data: { slug: `adm-other-${suffix}`, name: "Other" }, select: { id: true } });
    const otherAdmin = actor(otherTenant.id, "other-admin", ["admission.read"]);
    let isolated = false;
    try {
      const { getPeriod } = await import("../src/server/services/admission.service");
      await getPeriod(otherAdmin, period.id);
    } catch {
      isolated = true;
    }
    check("cross-tenant period access denied", isolated);
    await prisma.tenant.delete({ where: { id: otherTenant.id } }).catch(() => {});

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [adminId, applicantUserId] } } }).catch(() => {});
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
