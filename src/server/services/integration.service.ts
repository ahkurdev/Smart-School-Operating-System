import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { sha256, randomToken } from "@/server/auth/random";
import { createHmac } from "node:crypto";
import { recordAudit } from "@/server/services/audit.service";
import { enqueue } from "@/server/jobs/queue";
import type { Actor } from "@/types/actor";

/**
 * API keys & webhooks (Phases 90-91).
 *
 * API keys are shown once at creation and stored only as a SHA-256 hash (plus a
 * short prefix for identification). Webhooks receive signed payloads: the
 * signature is an HMAC-SHA256 of the raw body keyed by the endpoint secret, sent
 * as `X-School-Signature`. Deliveries are queued as background jobs so a slow or
 * failing receiver never blocks the request that triggered the event.
 */

export const API_SCOPES = [
  "students.read",
  "attendance.read",
  "finance.read",
  "admissions.read",
  "library.read",
  "webhooks.manage",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

const WEBHOOK_EVENTS = [
  "student.created",
  "student.enrolled",
  "attendance.recorded",
  "applicant.accepted",
  "payment.received",
  "invoice.created",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
export { WEBHOOK_EVENTS };

// --- API keys ----------------------------------------------------------------

export async function listApiKeys(actor: Actor) {
  authorize(actor, "apikey.manage");
  const tenantId = requireTenantId(actor);
  return prisma.apiKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, scopes: true, rateLimit: true, lastUsedAt: true, revokedAt: true, expiresAt: true, createdAt: true },
  });
}

/** Create a key; the plaintext is returned exactly once. */
export async function createApiKey(actor: Actor, input: { name: string; scopes: ApiScope[]; rateLimit?: number; expiresAt?: Date }) {
  authorize(actor, "apikey.manage");
  const tenantId = requireTenantId(actor);
  if (!input.name.trim()) throw Errors.validation("A key name is required.");
  if (input.scopes.length === 0) throw Errors.validation("Choose at least one scope.");
  const invalid = input.scopes.filter((s) => !API_SCOPES.includes(s));
  if (invalid.length) throw Errors.validation(`Unknown scope(s): ${invalid.join(", ")}.`);

  const secret = `sk_${randomToken(24)}`;
  const prefix = secret.slice(0, 11);
  const key = await prisma.apiKey.create({
    data: {
      tenantId,
      name: input.name.trim(),
      keyHash: sha256(secret),
      prefix,
      scopes: input.scopes,
      rateLimit: input.rateLimit ?? 1000,
      expiresAt: input.expiresAt ?? null,
    },
    select: { id: true, name: true, prefix: true, scopes: true },
  });
  await recordAudit({ actor, action: "apikey.create", resource: "ApiKey", resourceId: key.id, metadata: { scopes: input.scopes } });
  return { ...key, secret };
}

export async function revokeApiKey(actor: Actor, id: string) {
  authorize(actor, "apikey.manage");
  const tenantId = requireTenantId(actor);
  const key = await prisma.apiKey.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!key) throw Errors.notFound("API key not found.");
  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  await recordAudit({ actor, action: "apikey.revoke", resource: "ApiKey", resourceId: id });
}

export type ApiKeyResolution = { tenantId: string; scopes: ApiScope[]; keyId: string } | null;

/**
 * Resolve an API key from an Authorization: Bearer header. Returns the tenant and
 * scopes, or null. Never reveals whether a key exists vs is revoked.
 */
export async function resolveApiKey(authorization: string | null): Promise<ApiKeyResolution> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const secret = authorization.slice("Bearer ".length).trim();
  if (!secret.startsWith("sk_")) return null;
  const key = await prisma.apiKey.findFirst({
    where: { keyHash: sha256(secret) },
    select: { id: true, tenantId: true, scopes: true, revokedAt: true, expiresAt: true, rateLimit: true },
  });
  if (!key) return null;
  if (key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) return null;

  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { tenantId: key.tenantId, scopes: key.scopes as ApiScope[], keyId: key.id };
}

export function hasScope(scopes: ApiScope[], required: ApiScope): boolean {
  return scopes.includes(required);
}

// --- Webhooks ----------------------------------------------------------------

export async function listWebhooks(actor: Actor) {
  authorize(actor, "apikey.manage");
  const tenantId = requireTenantId(actor);
  return prisma.webhook.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, url: true, events: true, isActive: true, createdAt: true, _count: { select: { deliveries: true } } },
  });
}

export async function createWebhook(actor: Actor, input: { url: string; events: WebhookEvent[] }) {
  authorize(actor, "apikey.manage");
  const tenantId = requireTenantId(actor);
  if (!/^https:\/\//.test(input.url)) {
    // Allow plain http only for loopback addresses (local integrations/dev).
    const isLoopback = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(input.url);
    if (!isLoopback) throw Errors.validation("The webhook URL must use https.");
  }
  if (input.events.length === 0) throw Errors.validation("Choose at least one event.");
  const hook = await prisma.webhook.create({
    data: { tenantId, url: input.url.trim(), events: input.events, secret: randomToken(32) },
    select: { id: true, url: true, events: true, secret: true },
  });
  await recordAudit({ actor, action: "webhook.create", resource: "Webhook", resourceId: hook.id, metadata: { events: input.events } });
  return hook;
}

export async function deleteWebhook(actor: Actor, id: string) {
  authorize(actor, "apikey.manage");
  const tenantId = requireTenantId(actor);
  const hook = await prisma.webhook.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!hook) throw Errors.notFound("Webhook not found.");
  await prisma.webhook.delete({ where: { id } });
  await recordAudit({ actor, action: "webhook.delete", resource: "Webhook", resourceId: id });
}

export async function listDeliveries(actor: Actor, webhookId?: string) {
  authorize(actor, "apikey.manage");
  const tenantId = requireTenantId(actor);
  return prisma.webhookDelivery.findMany({
    where: { tenantId, ...(webhookId ? { webhookId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, webhookId: true, event: true, status: true, responseCode: true, attempts: true, lastError: true, createdAt: true },
  });
}

/**
 * Emit an event to all active webhooks of a tenant that subscribe to it. Each
 * delivery is enqueued as a job so the emitting request is never blocked.
 */
export async function emitEvent(tenantId: string, event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
  const hooks = await prisma.webhook.findMany({
    where: { tenantId, isActive: true, events: { has: event } },
    select: { id: true, url: true, secret: true },
  });
  const fullPayload = { event, occurredAt: new Date().toISOString(), data: payload };
  for (const hook of hooks) {
    const delivery = await prisma.webhookDelivery.create({
      data: { tenantId, webhookId: hook.id, event, payload: fullPayload as never, status: "PENDING" },
      select: { id: true },
    });
    await enqueue({
      name: "webhook.deliver",
      tenantId,
      payload: { deliveryId: delivery.id, webhookId: hook.id, url: hook.url, event, body: fullPayload },
      maxAttempts: 3,
    });
  }
}

/** HMAC-SHA256 signature for a webhook body (hex), matching the delivery signer. */
export function signWebhookBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}
