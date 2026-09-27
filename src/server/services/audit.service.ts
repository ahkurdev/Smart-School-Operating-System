import { prisma } from "@/server/db/client";
import type { Actor } from "@/types/actor";
import type { Prisma } from "@prisma/client";

/**
 * Audit trail. Every meaningful mutation calls `recordAudit`. Events are
 * append-only by convention (no update/delete path in the app). Sensitive values
 * must be redacted by the caller before being placed in before/after.
 */

export type AuditInput = {
  actor: Pick<Actor, "userId" | "tenantId" | "ip" | "userAgent"> & {
    actorType?: "user" | "system" | "api_key" | "ai";
  };
  action: string;
  resource: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  requestId?: string | null;
};

const REDACT_KEYS = new Set([
  "passwordHash",
  "password",
  "mfaSecret",
  "tokenHash",
  "apiKeyHash",
  "secret",
]);

/** Deep-redact known-sensitive keys before persisting. */
function redact(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => redact(v)) as Prisma.InputJsonValue;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.has(k) ? "[redacted]" : redact(v);
    }
    return out as Prisma.InputJsonValue;
  }
  return value as Prisma.InputJsonValue;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.actor.tenantId ?? null,
        actorUserId: input.actor.userId || null,
        actorType: input.actor.actorType ?? "user",
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        before: redact(input.before) ?? undefined,
        after: redact(input.after) ?? undefined,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? {},
        ipAddress: input.actor.ip ?? null,
        userAgent: input.actor.userAgent ?? null,
        requestId: input.requestId ?? null,
      },
    });
  } catch {
    // Audit must never break the business operation; log-and-continue.
    // (A real deployment would also ship this to an error monitor.)
  }
}
