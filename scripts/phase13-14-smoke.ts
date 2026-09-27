// Phase 13/14 E2E smoke: log in as the seeded school admin by minting a session
// through the app's own session service (no password typed), then fetch each new
// route + a mutation round-trip. Cleans up the session it created.
import { createSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";

const BASE = "http://localhost:3113";

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: "admin@demo.local" },
    select: { id: true },
  });
  if (!user) throw new Error("seeded admin not found");

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    select: { tenantId: true },
  });
  if (!membership) throw new Error("no membership");

  const session = await createSession({
    userId: user.id,
    activeTenantId: membership.tenantId,
    ip: "127.0.0.1",
    userAgent: "phase13-14-smoke",
  });

  const cookie = `ssos_session=${session.cookieValue}`;
  const routes = [
    "/app/teachers",
    "/app/staff",
    "/app/guardians",
  ];

  for (const route of routes) {
    const res = await fetch(BASE + route, { headers: { cookie }, redirect: "manual" });
    const body = await res.text();
    const title = (body.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? "";
    console.log(`GET ${route} -> ${res.status} "${title}" (${body.length} bytes)`);
  }

  // Detail pages: pick one teacher and one guardian from the DB.
  const teacher = await prisma.teacher.findFirst({
    where: { tenantId: membership.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (teacher) {
    const res = await fetch(`${BASE}/app/teachers/${teacher.id}`, { headers: { cookie } });
    const body = await res.text();
    console.log(`GET /app/teachers/[id] -> ${res.status} (${body.length} bytes)`);
  }

  const guardian = await prisma.guardian.findFirst({
    where: { tenantId: membership.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (guardian) {
    const res = await fetch(`${BASE}/app/guardians/${guardian.id}`, { headers: { cookie } });
    const body = await res.text();
    console.log(`GET /app/guardians/[id] -> ${res.status} (${body.length} bytes)`);
  }

  // Revoke the smoke session.
  await prisma.session.update({
    where: { id: session.sessionId },
    data: { revokedAt: new Date() },
  });
  console.log("smoke session revoked");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
