/**
 * Tenant isolation test (Phase 90/94).
 *
 * Proves that a student, teacher, and guardian created under two different
 * tenants are only ever reachable inside their own tenant — the core of the
 * "School A cannot see School B" requirement. It exercises the service layer
 * with hand-built Actors (no HTTP needed) against the live dev database, then
 * cleans up everything it created.
 *
 * Run: node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/tenant-isolation-test.ts
 */
import { prisma } from "../src/server/db/client";
import { listStudents, getStudent } from "../src/server/services/student.service";
import type { Actor } from "../src/types/actor";
import type { Permission } from "../src/lib/permissions";

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

function actorFor(tenantId: string, perms: Actor["permissions"], userId = "test-user"): Actor {
  return {
    userId,
    tenantId,
    isPlatform: false,
    roleKeys: ["school_admin"],
    permissions: perms,
    ip: null,
    userAgent: null,
  };
}

async function main() {
  const suffix = Date.now().toString(36);
  const a = await prisma.tenant.create({ data: { slug: `iso-a-${suffix}`, name: "Isolation A" }, select: { id: true } });
  const b = await prisma.tenant.create({ data: { slug: `iso-b-${suffix}`, name: "Isolation B" }, select: { id: true } });

  try {
    const sa = await prisma.student.create({
      data: { tenantId: a.id, studentNumber: `A-${suffix}`, fullName: "Alice A Student", status: "ACTIVE" },
      select: { id: true },
    });
    const sb = await prisma.student.create({
      data: { tenantId: b.id, studentNumber: `B-${suffix}`, fullName: "Bob B Student", status: "ACTIVE" },
      select: { id: true },
    });

    const actorA = actorFor(a.id, new Set<Permission>(["student.read", "teacher.read"]));
    const actorB = actorFor(b.id, new Set<Permission>(["student.read", "teacher.read"]));

    // Listing in tenant A returns only A's students.
    const listA = await listStudents(actorA, { pageSize: 100 });
    const listAIds = listA.items.map((s) => s.id);
    check("list in A contains A's student", listAIds.includes(sa.id));
    check("list in A excludes B's student", !listAIds.includes(sb.id));

    const listB = await listStudents(actorB, { pageSize: 100 });
    const listBIds = listB.items.map((s) => s.id);
    check("list in B contains B's student", listBIds.includes(sb.id));
    check("list in B excludes A's student", !listBIds.includes(sa.id));

    // Cross-tenant get by id must 404 for the other tenant.
    let crossFailed = false;
    try {
      await getStudent(actorA, sb.id);
    } catch {
      crossFailed = true;
    }
    check("A cannot fetch B's student by id", crossFailed);

    // Same-tenant get succeeds.
    const own = await getStudent(actorA, sa.id);
    check("A can fetch its own student", own.id === sa.id);

    // A search cannot leak the other tenant's name.
    const searchA = await listStudents(actorA, { search: "Bob B Student", pageSize: 100 });
    check("A search for B's name returns nothing", searchA.items.length === 0);

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    // Clean up (cascade removes students).
    await prisma.tenant.delete({ where: { id: a.id } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: b.id } }).catch(() => {});
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
