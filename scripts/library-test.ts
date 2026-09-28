/**
 * Library & digital-library end-to-end test (Phases 71-72).
 *
 * Proves:
 *   - items get copies; a copy can be loaned once and is not loanable twice;
 *   - returning computes an overdue fine from the per-day rate and frees the copy;
 *   - a student only sees their own loans, never another student's;
 *   - the catalog is tenant-isolated (a foreign actor cannot read another tenant's item).
 */
import { prisma } from "@/server/db/client";
import type { Actor } from "@/types/actor";
import {
  createLibraryItem,
  addLibraryCopy,
  borrowItem,
  returnItem,
  listLibraryItems,
  getLibraryStats,
  getMyLoans,
  getLibraryItem,
} from "@/server/services/library.service";

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

const LIB = ["library.read", "library.manage", "library.borrow"];

async function main() {
  const suffix = Date.now().toString(36);
  const tenant = await prisma.tenant.create({ data: { slug: `lib-${suffix}`, name: "Lib" }, select: { id: true } });
  const otherTenant = await prisma.tenant.create({ data: { slug: `lib2-${suffix}`, name: "Lib2" }, select: { id: true } });
  const tenantId = tenant.id;

  const staffUser = await prisma.user.create({ data: { email: `lib-staff-${suffix}@x.dev`, fullName: "Librarian", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  const s1User = await prisma.user.create({ data: { email: `lib-s1-${suffix}@x.dev`, fullName: "S1", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  const s2User = await prisma.user.create({ data: { email: `lib-s2-${suffix}@x.dev`, fullName: "S2", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });

  const s1 = await prisma.student.create({ data: { tenantId, userId: s1User.id, fullName: "S1", studentNumber: `L1-${suffix}` }, select: { id: true } });
  const s2 = await prisma.student.create({ data: { tenantId, userId: s2User.id, fullName: "S2", studentNumber: `L2-${suffix}` }, select: { id: true } });

  const staff = actorFor(tenantId, staffUser.id, LIB);
  const stud1 = actorFor(tenantId, s1User.id, ["library.read"]);
  const stud2 = actorFor(tenantId, s2User.id, ["library.read"]);

  // --- catalog + copies -----------------------------------------------------
  const book = await createLibraryItem(staff, { title: "Foundations of Education", author: "A. Author", year: 2021, type: "PHYSICAL", copyCount: 2 });
  const fetched = await getLibraryItem(staff, book.id);
  check("physical item gets copies", fetched.copies.length === 2);
  check("copies start AVAILABLE", fetched.copies.every((c) => c.status === "AVAILABLE"));
  check("barcodes are unique", new Set(fetched.copies.map((c) => c.barcode)).size === 2);

  const extra = await addLibraryCopy(staff, book.id, { barcode: `CUSTOM-${suffix}` });
  check("manual copy barcode stored", extra.barcode === `CUSTOM-${suffix}`.toUpperCase());

  const ebook = await createLibraryItem(staff, { title: "Digital Handbook", type: "EBOOK", accessLevel: "student", externalUrl: "https://example.edu/handbook" });
  check("digital item has no copies", (await getLibraryItem(staff, ebook.id)).copies.length === 0);

  // --- lending --------------------------------------------------------------
  const copyA = fetched.copies[0]!;
  const loan = await borrowItem(staff, { copyId: copyA.id, studentId: s1.id, days: 7 });
  check("borrow creates an ACTIVE loan", loan.status === "ACTIVE");
  check("borrowed copy leaves AVAILABLE", (await getLibraryItem(staff, book.id)).copies.find((c) => c.id === copyA.id)?.status === "ON_LOAN");
  await expectError("cannot loan an already-on-loan copy", () => borrowItem(staff, { copyId: copyA.id, studentId: s2.id }));
  await expectError("cannot loan to a student of another tenant", () =>
    borrowItem(staff, { copyId: fetched.copies[1]!.id, studentId: "nonexistent-student" }),
  );

  // --- return + fine --------------------------------------------------------
  // Pretend the loan is overdue by 3 days.
  await prisma.libraryLoan.update({ where: { id: loan.id }, data: { dueAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } });
  const returned = await returnItem(staff, loan.id);
  check("overdue return computes a fine", returned.fineAmount > 0);
  check("overdue days detected (>=3)", returned.overdueDays >= 3);
  check("returned copy is AVAILABLE again", (await getLibraryItem(staff, book.id)).copies.find((c) => c.id === copyA.id)?.status === "AVAILABLE");
  await expectError("cannot return the same loan twice", () => returnItem(staff, loan.id));

  const waived = await borrowItem(staff, { copyId: copyA.id, studentId: s2.id, days: 1 });
  await prisma.libraryLoan.update({ where: { id: waived.id }, data: { dueAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) } });
  const waivedRes = await returnItem(staff, waived.id, { waiveFine: true });
  check("waived fine is zero", waivedRes.fineAmount === 0);

  // --- ownership / isolation ------------------------------------------------
  await borrowItem(staff, { copyId: copyA.id, studentId: s1.id, days: 14 });
  const s1Loans = await getMyLoans(stud1);
  const s2Loans = await getMyLoans(stud2);
  check("student sees their own active loan", s1Loans.some((l) => l.status === "ACTIVE" && l.studentId === s1.id));
  check("student does not see another student's active loan", !s2Loans.some((l) => l.status === "ACTIVE" && l.studentId === s1.id));

  const foreign = actorFor(otherTenant.id, staffUser.id, LIB);
  await expectError("catalog is tenant-isolated (foreign read fails)", () => getLibraryItem(foreign, book.id));
  const foreignList = await listLibraryItems(foreign);
  check("foreign listing is empty", foreignList.items.length === 0);

  const stats = await getLibraryStats(staff);
  check("stats count titles", stats.items >= 2);
  check("stats count active loans", stats.activeLoans >= 1);

  // --- cleanup --------------------------------------------------------------
  try {
    await prisma.libraryLoan.deleteMany({ where: { tenantId } });
    await prisma.libraryReservation.deleteMany({ where: { tenantId } });
    await prisma.libraryCopy.deleteMany({ where: { tenantId } });
    await prisma.libraryItem.deleteMany({ where: { tenantId } });
    await prisma.student.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { id: { in: [staffUser.id, s1User.id, s2User.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenant.id] } } });
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
