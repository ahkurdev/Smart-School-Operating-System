/**
 * Notifications + audit trail test (Phases 48 / 75).
 *
 * Proves:
 *   - publishing an announcement fans out an in-app notification to members;
 *   - a user only sees their own notifications; marking read is scoped;
 *   - marking all read flips only the actor's unread rows;
 *   - the audit trail lists tenant-scoped events and requires `audit.read`;
 *   - notification manager view requires `notification.manage`.
 */
import { prisma } from "@/server/db/client";
import type { Actor } from "@/types/actor";
import { recordAudit, listAuditLog, auditResources } from "@/server/services/audit.service";
import {
  notifyTenant,
  listMyNotifications,
  unreadCount,
  markNotificationRead,
  markAllRead,
  listRecentNotifications,
} from "@/server/services/notification.service";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL ${name}${detail ? ` (${detail})` : ""}`);
  }
}
function actorFor(tenantId: string, userId: string, permissions: string[]): Actor {
  return { userId, tenantId, roles: [], roleKeys: [], permissions: new Set(permissions), isPlatform: false } as unknown as Actor;
}
async function expectError(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

async function main() {
  const suffix = Date.now().toString(36);
  const tenant = await prisma.tenant.create({ data: { slug: `notif-${suffix}`, name: "Notif" }, select: { id: true } });
  const tenantId = tenant.id;

  const u1 = await prisma.user.create({ data: { email: `n1-${suffix}@x.dev`, fullName: "One", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  const u2 = await prisma.user.create({ data: { email: `n2-${suffix}@x.dev`, fullName: "Two", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  await prisma.membership.create({ data: { tenantId, userId: u1.id, status: "ACTIVE" } });
  await prisma.membership.create({ data: { tenantId, userId: u2.id, status: "ACTIVE" } });

  const admin = actorFor(tenantId, u1.id, ["notification.manage", "audit.read"]);
  const member = actorFor(tenantId, u2.id, ["student.read"]);

  // --- Fan-out --------------------------------------------------------------
  const res = await notifyTenant(admin, { type: "announcement", title: "Hello everyone", body: "Term starts Monday." });
  check("fan-out created one notification per active member", res.created === 2);

  const mine = await listMyNotifications(admin);
  check("the actor sees their own notification", mine.length === 1 && mine[0]!.title === "Hello everyone");
  check("unread count is per user", (await unreadCount(admin)) === 1 && (await unreadCount(member)) === 1);

  // --- Read scoping ---------------------------------------------------------
  const otherN = (await listMyNotifications(member))[0]!;
  check("a user cannot mark another user's notification read", await expectError(() => markNotificationRead(admin, otherN.id)));
  await markNotificationRead(member, otherN.id);
  check("marking your own read clears it from unread", (await unreadCount(member)) === 0);
  check("the other user is unaffected", (await unreadCount(admin)) === 1);

  const upd = await markAllRead(admin);
  check("mark all read updates only the actor's rows", upd.updated === 1 && (await unreadCount(admin)) === 0);

  // --- Manager view ---------------------------------------------------------
  check("a plain member cannot see the manager view", await expectError(() => listRecentNotifications(member)));
  check("a manager sees recent notifications", (await listRecentNotifications(admin)).length >= 2);

  // --- Audit ----------------------------------------------------------------
  await recordAudit({ actor: admin, action: "student.update", resource: "Student", resourceId: "s1" });
  await recordAudit({ actor: admin, action: "grade.publish", resource: "Grade" });

  const audit = await listAuditLog(admin, { pageSize: 10 });
  check("audit lists the tenant's events", audit.rows.length >= 2);
  check("audit rows carry the actor", audit.rows.some((r) => r.actor?.fullName === "One"));
  const filtered = await listAuditLog(admin, { resource: "Grade" });
  check("audit filters by resource", filtered.rows.every((r) => r.resource === "Grade") && filtered.rows.length === 1);
  check("audit resource list is distinct", (await auditResources(admin)).includes("Student"));
  check("audit requires audit.read", await expectError(() => listAuditLog(member)));

  // --- Cleanup --------------------------------------------------------------
  try {
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.membership.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { id: { in: [u1.id, u2.id] } } });
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
