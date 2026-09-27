// Exercise the Phase 13/14 service write paths with a real actor, then clean up.
import { prisma } from "@/server/db/client";
import { buildActor } from "@/server/auth/session";
import {
  createTeacher,
  updateTeacher,
  archiveTeacher,
} from "@/server/services/teacher.service";
import { createStaff, updateStaff, archiveStaff } from "@/server/services/staff.service";
import {
  createGuardian,
  updateGuardian,
  linkGuardianToStudent,
  unlinkGuardianFromStudent,
  archiveGuardian,
} from "@/server/services/guardian.service";

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "admin@demo.local" }, select: { id: true } });
  const membership = await prisma.membership.findFirst({ where: { userId: user!.id, status: "ACTIVE" }, select: { tenantId: true } });
  const actor = await buildActor(user!.id, membership!.tenantId);
  console.log("actor perms:", actor.permissions.has("teacher.create"), actor.permissions.has("staff.manage"), actor.permissions.has("guardian.link"));

  // --- Teacher lifecycle ---
  const t = await createTeacher(actor, { fullName: "Smoke Teacher One", employmentType: "CONTRACT", specialization: "Physics" });
  console.log("teacher.create:", t.employeeNumber, t.id);
  await updateTeacher(actor, t.id, { status: "ON_LEAVE", phone: "555-0100" });
  const tRow = await prisma.teacher.findUnique({ where: { id: t.id }, select: { status: true, phone: true, employmentType: true } });
  console.log("teacher.update:", tRow);

  // --- Staff lifecycle ---
  const s = await createStaff(actor, { fullName: "Smoke Staff One", position: "Librarian", department: "Library" });
  console.log("staff.create:", s.employeeNumber);
  await updateStaff(actor, s.id, { status: "ON_LEAVE" });
  const sRow = await prisma.staff.findUnique({ where: { id: s.id }, select: { status: true, position: true } });
  console.log("staff.update:", sRow);

  // --- Guardian lifecycle + link ---
  const g = await createGuardian(actor, { fullName: "Smoke Guardian One", relationship: "Aunt", phone: "555-0200" });
  console.log("guardian.create:", g.id);
  await updateGuardian(actor, g.id, { occupation: "Engineer" });

  const student = await prisma.student.findFirst({ where: { tenantId: membership!.tenantId, deletedAt: null }, select: { id: true } });
  await linkGuardianToStudent(actor, { guardianId: g.id, studentId: student!.id, isPrimary: true, relationship: "Aunt" });
  const link = await prisma.studentGuardian.findUnique({
    where: { studentId_guardianId: { studentId: student!.id, guardianId: g.id } },
    select: { isPrimary: true, relationship: true, canPickup: true },
  });
  console.log("guardian.link:", link);
  await unlinkGuardianFromStudent(actor, { guardianId: g.id, studentId: student!.id });
  const after = await prisma.studentGuardian.findUnique({ where: { studentId_guardianId: { studentId: student!.id, guardianId: g.id } } });
  console.log("guardian.unlink (should be null):", after);

  // --- Duplicate-guard against seniority / audit ---
  const audits = await prisma.auditLog.count({ where: { tenantId: membership!.tenantId, action: { in: ["teacher.create", "staff.create", "guardian.create", "guardian.link", "guardian.unlink"] } } });
  console.log("audit rows:", audits);

  // --- Cleanup ---
  await archiveTeacher(actor, t.id);
  await archiveStaff(actor, s.id);
  await archiveGuardian(actor, g.id);
  await prisma.teacher.delete({ where: { id: t.id } });
  await prisma.staff.delete({ where: { id: s.id } });
  await prisma.guardian.delete({ where: { id: g.id } });
  console.log("cleanup done");
}
main().then(() => process.exit(0)).catch((e) => { console.error("SMOKE FAILED", e); process.exit(1); });
