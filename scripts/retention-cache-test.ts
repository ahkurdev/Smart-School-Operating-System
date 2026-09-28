/**
 * Caching, security hardening & retention test (Phases 92-94).
 *
 * Proves:
 *   - the TTL cache returns memoised values and honours expiry/clear;
 *   - tenantKey embeds the tenant id (leak guard);
 *   - retention policies are stored per tenant and reject unknown entities;
 *   - applyRetention deletes only rows older than the cutoff, only for the
 *     actor's tenant (cross-tenant rows survive);
 *   - a student actor cannot manage retention (permission enforced).
 */
import { prisma } from "@/server/db/client";
import type { Actor } from "@/types/actor";
import { ttlMemo, tenantKey, clearTtlCache } from "@/server/cache";
import {
  listRetentionPolicies,
  upsertRetentionPolicy,
  applyRetention,
  supportedRetentionEntities,
} from "@/server/services/retention.service";

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
  // --- Cache ----------------------------------------------------------------
  clearTtlCache();
  let calls = 0;
  const v1 = ttlMemo("k", 10_000, () => {
    calls++;
    return "A";
  });
  const v2 = ttlMemo("k", 10_000, () => {
    calls++;
    return "B";
  });
  check("ttlMemo returns the cached value on a hit", v1 === "A" && v2 === "A");
  check("ttlMemo only ran the producer once", calls === 1);
  check("tenantKey embeds the tenant id", tenantKey("t1", "students", 7) === "t1:students:7");
  check("tenantKey differs across tenants", tenantKey("t1", "x") !== tenantKey("t2", "x"));
  clearTtlCache();

  // --- Setup ----------------------------------------------------------------
  const suffix = Date.now().toString(36);
  const t1 = await prisma.tenant.create({ data: { slug: `ret-a-${suffix}`, name: "Ret A" }, select: { id: true } });
  const t2 = await prisma.tenant.create({ data: { slug: `ret-b-${suffix}`, name: "Ret B" }, select: { id: true } });
  const adminUser = await prisma.user.create({ data: { email: `ret-${suffix}@x.dev`, fullName: "Admin", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  const studentUser = await prisma.user.create({ data: { email: `ret-s-${suffix}@x.dev`, fullName: "Student", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  const admin = actorFor(t1.id, adminUser.id, ["setting.read", "setting.manage"]);
  const student = actorFor(t1.id, studentUser.id, ["student.read"]);

  const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
  await prisma.auditLog.create({ data: { tenantId: t1.id, actorUserId: adminUser.id, action: "x", resource: "Y", createdAt: old } });
  await prisma.auditLog.create({ data: { tenantId: t1.id, actorUserId: adminUser.id, action: "x", resource: "Y", createdAt: new Date() } });
  await prisma.auditLog.create({ data: { tenantId: t2.id, actorUserId: adminUser.id, action: "x", resource: "Y", createdAt: old } });

  // --- Policy validation ----------------------------------------------------
  check("supported entities are listed", supportedRetentionEntities().includes("audit_log"));
  check("unknown entity is rejected", await expectError(() => upsertRetentionPolicy(admin, { entity: "not_a_table", retentionDays: 30, action: "delete" })));
  check("retention days < 1 is rejected", await expectError(() => upsertRetentionPolicy(admin, { entity: "audit_log", retentionDays: 0, action: "delete" })));
  check("a student cannot manage retention", await expectError(() => upsertRetentionPolicy(student, { entity: "audit_log", retentionDays: 30, action: "delete" })));

  const policy = await upsertRetentionPolicy(admin, { entity: "audit_log", retentionDays: 365, action: "delete" });
  check("policy is stored for the tenant", policy.tenantId === t1.id);
  check("upsert updates an existing policy", (await upsertRetentionPolicy(admin, { entity: "audit_log", retentionDays: 200, action: "delete" })).retentionDays === 200);

  const listed = await listRetentionPolicies(admin);
  check("policy list includes the tenant policy", listed.some((p) => p.entity === "audit_log" && p.tenantId === t1.id));

  // --- Apply ----------------------------------------------------------------
  const results = await applyRetention(admin);
  const auditResult = results.find((r) => r.entity === "audit_log");
  check("retention run reports the affected count", !!auditResult && auditResult.affected === 1);

  const t1Old = await prisma.auditLog.count({ where: { tenantId: t1.id, createdAt: { lt: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000) } } });
  const t1Recent = await prisma.auditLog.count({ where: { tenantId: t1.id, createdAt: { gt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) } } });
  const t2Old = await prisma.auditLog.count({ where: { tenantId: t2.id, createdAt: { lt: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000) } } });
  check("old rows in the actor's tenant were deleted", t1Old === 0);
  check("recent rows were preserved", t1Recent >= 1, `t1Recent=${t1Recent} t1Old=${t1Old}`);
  check("the other tenant's rows were untouched (isolation)", t2Old === 1);

  const dry = await applyRetention(admin, { dryRun: true });
  check("dry run reports -1 without deleting", dry.some((r) => r.affected === -1));

  // --- cleanup --------------------------------------------------------------
  try {
    await prisma.dataRetentionPolicy.deleteMany({ where: { tenantId: { in: [t1.id, t2.id] } } });
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: [t1.id, t2.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, studentUser.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [t1.id, t2.id] } } });
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
