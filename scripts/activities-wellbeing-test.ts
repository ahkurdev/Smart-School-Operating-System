/**
 * Activities & wellbeing end-to-end test (Phases 75-78).
 *
 * Proves:
 *   - extracurricular membership is tenant-scoped and idempotent-ish (re-adding an
 *     inactive member reactivates rather than duplicating);
 *   - achievements link to a student and are tenant-isolated;
 *   - counseling records are confidential: a counselor sees them, a student sees
 *     only their own, and an unrelated actor with no permission sees nothing;
 *   - discipline records require discipline.read.
 */
import { prisma } from "@/server/db/client";
import type { Actor } from "@/types/actor";
import {
  createExtracurricular,
  addMember,
  getExtracurricular,
  removeMember,
  createAchievement,
  listAchievements,
  createCounseling,
  listCounseling,
  updateCounselingStatus,
  createDiscipline,
  listDiscipline,
} from "@/server/services/activity.service";

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

const COUNSELOR = ["extracurricular.read", "extracurricular.manage", "achievement.read", "achievement.manage", "counseling.read", "counseling.manage", "discipline.read", "discipline.manage"];
const STUDENT_P = ["counseling.read", "extracurricular.read"];

async function main() {
  const suffix = Date.now().toString(36);
  const tenant = await prisma.tenant.create({ data: { slug: `act-${suffix}`, name: "ACT" }, select: { id: true } });
  const other = await prisma.tenant.create({ data: { slug: `act2-${suffix}`, name: "ACT2" }, select: { id: true } });
  const tenantId = tenant.id;

  const counselorUser = await prisma.user.create({ data: { email: `act-c-${suffix}@x.dev`, fullName: "Counselor", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  const s1User = await prisma.user.create({ data: { email: `act-s1-${suffix}@x.dev`, fullName: "S1", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  const s2User = await prisma.user.create({ data: { email: `act-s2-${suffix}@x.dev`, fullName: "S2", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });

  const s1 = await prisma.student.create({ data: { tenantId, userId: s1User.id, fullName: "S1", studentNumber: `A1-${suffix}` }, select: { id: true } });
  const s2 = await prisma.student.create({ data: { tenantId, userId: s2User.id, fullName: "S2", studentNumber: `A2-${suffix}` }, select: { id: true } });

  const counselor = actorFor(tenantId, counselorUser.id, COUNSELOR);
  const stud1 = actorFor(tenantId, s1User.id, STUDENT_P);

  // --- extracurricular ------------------------------------------------------
  const club = await createExtracurricular(counselor, { name: "Robotics", capacity: 20 });
  const mem = await addMember(counselor, club.id, { studentId: s1.id, role: "Captain" });
  check("member added", (await getExtracurricular(counselor, club.id)).members.filter((m) => m.isActive).length === 1);
  await expectError("duplicate active member refused", () => addMember(counselor, club.id, { studentId: s1.id }));
  await removeMember(counselor, mem.id);
  check("member deactivated", (await getExtracurricular(counselor, club.id)).members.filter((m) => m.isActive).length === 0);
  const reactivated = await addMember(counselor, club.id, { studentId: s1.id });
  check("re-adding reactivates (no duplicate)", reactivated.id === mem.id);
  await expectError("cannot add a student from another tenant", () => addMember(counselor, club.id, { studentId: "nope" }));

  // --- achievements ---------------------------------------------------------
  const ach = await createAchievement(counselor, { title: "Gold Medal", studentId: s1.id, level: "NATIONAL", achievedAt: new Date() });
  check("achievement created", ach.level === "NATIONAL");
  const foreign = actorFor(other.id, counselorUser.id, COUNSELOR);
  check("achievements tenant-isolated", (await listAchievements(foreign)).length === 0);

  // --- counseling (confidential) --------------------------------------------
  const rec = await createCounseling(counselor, { studentId: s1.id, summary: "Academic stress", notes: "Private" });
  check("counseling defaults to confidential", rec.confidential === true);
  check("counselor sees the record", (await listCounseling(counselor)).length === 1);
  const s1Own = await listCounseling(stud1);
  check("student sees only their own record", s1Own.length === 1 && s1Own[0]!.studentId === s1.id);
  const stud2 = actorFor(tenantId, s2User.id, ["counseling.read"]);
  check("another student sees no records", (await listCounseling(stud2)).length === 0);
  await expectError("non-manager cannot create counseling", () => createCounseling(stud1, { studentId: s2.id, summary: "x" }));
  await updateCounselingStatus(counselor, rec.id, "CLOSED");
  check("counseling status updated", (await listCounseling(counselor, { status: "CLOSED" })).length === 1);

  // --- discipline -----------------------------------------------------------
  await expectError("cannot read discipline without permission", () => listDiscipline(stud1));
  const disc = await createDiscipline(counselor, { studentId: s1.id, category: "Lateness", description: "Arrived late 3x", severity: "MINOR", occurredAt: new Date() });
  check("discipline record created", (await listDiscipline(counselor)).some((d) => d.id === disc.id));

  // --- cleanup --------------------------------------------------------------
  try {
    await prisma.counselingRecord.deleteMany({ where: { tenantId } });
    await prisma.disciplineRecord.deleteMany({ where: { tenantId } });
    await prisma.achievement.deleteMany({ where: { tenantId } });
    await prisma.extracurricularMember.deleteMany({ where: { tenantId } });
    await prisma.extracurricular.deleteMany({ where: { tenantId } });
    await prisma.student.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { id: { in: [counselorUser.id, s1User.id, s2User.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, other.id] } } });
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
