// Assert the rendered HTML contains real records + key UI affordances.
import { createSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";

const BASE = "http://localhost:3113";

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "admin@demo.local" }, select: { id: true } });
  const membership = await prisma.membership.findFirst({ where: { userId: user!.id, status: "ACTIVE" }, select: { tenantId: true } });
  const session = await createSession({ userId: user!.id, activeTenantId: membership!.tenantId });
  const cookie = `ssos_session=${session.cookieValue}`;

  const checks: { route: string; must: string[] }[] = [];
  const teacher = await prisma.teacher.findFirst({ where: { tenantId: membership!.tenantId, deletedAt: null }, select: { fullName: true, employeeNumber: true } });
  const guardian = await prisma.guardian.findFirst({ where: { tenantId: membership!.tenantId, deletedAt: null }, select: { fullName: true } });

  checks.push({ route: "/app/teachers", must: ["Teachers", "Add teacher", teacher!.fullName, teacher!.employeeNumber] });
  checks.push({ route: "/app/staff", must: ["Staff", "Add staff", "No staff found"] });
  checks.push({ route: "/app/guardians", must: ["Guardians", "Add guardian", guardian!.fullName] });
  checks.push({ route: `/app/teachers/${(await prisma.teacher.findFirst({ where: { tenantId: membership!.tenantId }, select: { id: true } }))!.id}`, must: ["Subject assignments", "Homeroom classes", teacher!.employeeNumber] });
  checks.push({ route: `/app/guardians/${(await prisma.guardian.findFirst({ where: { tenantId: membership!.tenantId }, select: { id: true } }))!.id}`, must: ["Linked students", guardian!.fullName] });

  let failed = 0;
  for (const c of checks) {
    const res = await fetch(BASE + c.route, { headers: { cookie } });
    const html = await res.text();
    const missing = c.must.filter((m) => !html.includes(m));
    if (missing.length) {
      failed++;
      console.log(`FAIL ${c.route}: missing ${JSON.stringify(missing)}`);
    } else {
      console.log(`PASS ${c.route}: ${c.must.length} assertions`);
    }
  }

  await prisma.session.update({ where: { id: session.sessionId }, data: { revokedAt: new Date() } });
  console.log(failed === 0 ? "ALL_CONTENT_CHECKS_PASSED" : `${failed} ROUTE(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
