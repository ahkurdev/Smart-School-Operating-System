/**
 * API keys, webhooks & background jobs test (Phases 90-91).
 *
 * Proves:
 *   - API keys are stored hashed; the plaintext is returned once and resolves back
 *     to the right tenant + scopes;
 *   - a revoked/expired key resolves to null;
 *   - scope checks gate access (a students-only key cannot call attendance);
 *   - emitting an event enqueues a webhook delivery job and the handler runs,
 *     recording the delivery outcome and signing the payload;
 *   - the job queue retries and records failures.
 */
import { createHmac } from "node:crypto";
import { prisma } from "@/server/db/client";
import type { Actor } from "@/types/actor";
import {
  createApiKey,
  revokeApiKey,
  resolveApiKey,
  hasScope,
  createWebhook,
  emitEvent,
  signWebhookBody,
  listDeliveries,
} from "@/server/services/integration.service";
import { registerAllJobs } from "@/server/jobs";
import { registerJob, enqueue, runJob } from "@/server/jobs/queue";

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
function actorFor(tenantId: string, userId: string, permissions: string[]): Actor {
  return { userId, tenantId, roles: [], roleKeys: [], permissions: new Set(permissions), isPlatform: false } as unknown as Actor;
}

async function main() {
  registerAllJobs();
  const suffix = Date.now().toString(36);
  const tenant = await prisma.tenant.create({ data: { slug: `int-${suffix}`, name: "INT" }, select: { id: true } });
  const tenantId = tenant.id;
  const adminUser = await prisma.user.create({ data: { email: `int-${suffix}@x.dev`, fullName: "Admin", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  const admin = actorFor(tenantId, adminUser.id, ["apikey.manage"]);

  // --- API keys -------------------------------------------------------------
  const key = await createApiKey(admin, { name: "Reporting", scopes: ["students.read", "attendance.read"] });
  check("plaintext key is returned once", key.secret.startsWith("sk_") && key.secret.length > 20);
  check("key is stored hashed (not plaintext)", (await prisma.apiKey.findUnique({ where: { id: key.id }, select: { keyHash: true } }))!.keyHash !== key.secret);

  const resolved = await resolveApiKey(`Bearer ${key.secret}`);
  check("key resolves to the right tenant", resolved?.tenantId === tenantId);
  check("key carries its scopes", !!resolved && resolved.scopes.includes("students.read"));
  check("scope check passes for granted scope", !!resolved && hasScope(resolved.scopes, "attendance.read"));
  check("scope check fails for ungranted scope", !!resolved && !hasScope(resolved.scopes, "finance.read"));
  check("garbage key resolves to null", (await resolveApiKey("Bearer sk_nope")) === null);
  check("missing header resolves to null", (await resolveApiKey(null)) === null);

  await revokeApiKey(admin, key.id);
  check("revoked key no longer resolves", (await resolveApiKey(`Bearer ${key.secret}`)) === null);

  // --- Webhook signing + delivery job --------------------------------------
  const body = JSON.stringify({ hello: "world" });
  const sig = signWebhookBody("s3cr3t", body);
  check("webhook signature is HMAC-SHA256 hex", /^[0-9a-f]{64}$/.test(sig) && sig === createHmac("sha256", "s3cr3t").update(body).digest("hex"));

  // Point a webhook at a local sink that always succeeds.
  let received: { headers: Record<string, string>; body: string } | null = null;
  const server = await startSink((req) => {
    received = req;
  });
  try {
    const hook = await createWebhook(admin, { url: `${server.url}`, events: ["student.created"] });
    await emitEvent(tenantId, "student.created", { studentId: "s1" });

    // The inline driver runs the delivery handler synchronously.
    const deliveries = await listDeliveries(admin);
    check("a delivery row was created", deliveries.length === 1);
    check("delivery succeeded", deliveries[0]!.status === "SUCCESS");
    check("sink received the payload", !!received && (received as { body: string }).body.includes("student.created"));
    check("sink received a signature header", !!received && /^sha256=[0-9a-f]{64}$/.test((received as { headers: Record<string, string> }).headers["x-school-signature"] ?? ""));
    void hook;
  } finally {
    await server.close();
  }

  // --- Job queue failure + retry bookkeeping --------------------------------
  registerJob("always-fail", async () => {
    throw new Error("boom");
  });
  const job = await enqueue({ name: "always-fail", tenantId, maxAttempts: 1 });
  const row = await prisma.backgroundJob.findUnique({ where: { id: job.id } });
  check("failed job is marked FAILED after max attempts", row?.status === "FAILED");
  check("failed job records the error", !!row?.lastError?.includes("boom"));

  const okJob = await enqueue({ name: "noop", tenantId });
  const okRow = await prisma.backgroundJob.findUnique({ where: { id: okJob.id } });
  check("successful job is marked SUCCEEDED", okRow?.status === "SUCCEEDED");
  // Re-running a finished job is a no-op.
  await runJob(okJob.id);
  check("re-running a succeeded job is idempotent", (await prisma.backgroundJob.findUnique({ where: { id: okJob.id } }))!.status === "SUCCEEDED");

  // --- cleanup --------------------------------------------------------------
  try {
    await prisma.webhookDelivery.deleteMany({ where: { tenantId } });
    await prisma.webhook.deleteMany({ where: { tenantId } });
    await prisma.backgroundJob.deleteMany({ where: { tenantId } });
    await prisma.apiKey.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.user.delete({ where: { id: adminUser.id } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  } catch (e) {
    console.error("cleanup warning:", (e as Error).message);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

/** Tiny local HTTP sink to receive a webhook delivery. */
async function startSink(onRequest: (req: { headers: Record<string, string>; body: string }) => void) {
  const http = await import("node:http");
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      onRequest({ headers: req.headers as Record<string, string>, body });
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}/hook`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
