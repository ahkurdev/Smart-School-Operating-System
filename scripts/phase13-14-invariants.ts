// Verify invariants: single primary guardian per student, and RBAC denial.
import { prisma } from "@/server/db/client";
import { buildActor } from "@/server/auth/session";
import { isAppError } from "@/server/errors";
import { createGuardian, linkGuardianToStudent, updateGuardianLink } from "@/server/services/guardian.service";
import { createTeacher } from "@/server/services/teacher.service";

async function main() {
  const admin = await prisma.user.findFirst({ where: { email: "admin@demo.local" }, select: { id: true } });
  const membership = await prisma.membership.findFirst({ where: { userId: admin!.id, status: "ACTIVE" }, select: { tenantId: true } });
  const actor = await buildActor(admin!.id, membership!.tenantId);

  const tenantId = membership!.tenantId;
  const student = await prisma.student.findFirst({ where: { tenantId, deletedAt: null }, select: { id: true } });

  // Create two guardians and link both as primary -> only the second stays primary.
  const g1 = await createGuardian(actor, { fullName: "Invariant G1", relationship: "Father" });
  const g2 = await createGuardian(actor, { fullName: "Invariant G2", relationship: "Mother" });
  // Note: the student may already have a primary guardian from seed. Record baseline.
  const baseline = await prisma.studentGuardian.count({ where: { studentId: student!.id, isPrimary: true } });

  await linkGuardianToStudent(actor, { guardianId: g1.id, studentId: student!.id, isPrimary: true });
  await linkGuardianToStudent(actor, { guardianId: g2.id, studentId: student!.id, isPrimary: true });
  const primaries = await prisma.studentGuardian.findMany({ where: { studentId: student!.id, isPrimary: true }, select: { guardianId: true } });
  console.log(`baselinePrimaries=${baseline} afterTwoPrimaryLinks=${primaries.length} (expect exactly 1)`);
  console.log("primary is g2:", primaries.length === 1 && primaries[0]!.guardianId === g2.id);

  // Toggle g1 to primary -> g2 demoted.
  await updateGuardianLink(actor, { guardianId: g1.id, studentId: student!.id, isPrimary: true });
  const primaries2 = await prisma.studentGuardian.findMany({ where: { studentId: student!.id, isPrimary: true }, select: { guardianId: true } });
  console.log("afterToggle primary is g1:", primaries2.length === 1 && primaries2[0]!.guardianId === g1.id);

  // RBAC: a read-only actor must be denied create.
  const readonly = await buildActor(admin!.id, null); // no tenant -> no permissions
  let denied = false;
  try {
    await createTeacher(readonly, { fullName: "Should Fail" });
  } catch (e) {
    denied = isAppError(e) && (e.code === "FORBIDDEN" || e.code === "UNAUTHENTICATED");
  }
  console.log("rbac denial for permissionless actor:", denied);

  // Cleanup.
  await prisma.studentGuardian.deleteMany({ where: { guardianId: { in: [g1.id, g2.id] } } });
  await prisma.guardian.deleteMany({ where: { id: { in: [g1.id, g2.id] } } });
  console.log("cleanup done");
}
main().then(() => process.exit(0)).catch((e) => { console.error("FAILED", e); process.exit(1); });
