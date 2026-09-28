import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Data retention & privacy (Phase 94).
 *
 * Retention is per-tenant and per-entity, because the rules differ between
 * institutions. `applyRetention` deletes or anonymises rows older than the
 * policy's threshold. Anonymisation replaces identifying fields but keeps the
 * row for aggregate reporting. Every run is audited; nothing here touches a
 * tenant other than the actor's.
 */

export type RetentionAction = "delete" | "anonymize" | "archive";

/** Entity handlers: how to count/apply retention for a named entity. */
type RetentionEntity = {
  key: string;
  /** ISO date field used to decide age. */
  dateField: string;
  apply: (tenantId: string, cutoff: Date, action: RetentionAction) => Promise<number>;
};

const ENTITIES: Record<string, RetentionEntity> = {
  audit_log: {
    key: "audit_log",
    dateField: "createdAt",
    apply: (tenantId, cutoff) =>
      prisma.auditLog.deleteMany({ where: { tenantId, createdAt: { lt: cutoff } } }).then((r) => r.count),
  },
  webhook_delivery: {
    key: "webhook_delivery",
    dateField: "createdAt",
    apply: (tenantId, cutoff) =>
      prisma.webhookDelivery.deleteMany({ where: { tenantId, createdAt: { lt: cutoff } } }).then((r) => r.count),
  },
  background_job: {
    key: "background_job",
    dateField: "createdAt",
    apply: (tenantId, cutoff) =>
      prisma.backgroundJob.deleteMany({ where: { tenantId, createdAt: { lt: cutoff }, status: { in: ["SUCCEEDED", "FAILED", "CANCELLED"] } } }).then((r) => r.count),
  },
  notification: {
    key: "notification",
    dateField: "createdAt",
    apply: (tenantId, cutoff) =>
      prisma.notification.deleteMany({ where: { tenantId, createdAt: { lt: cutoff }, readAt: { not: null } } }).then((r) => r.count),
  },
  applicant: {
    key: "applicant",
    dateField: "createdAt",
    apply: async (tenantId, cutoff, action) => {
      if (action === "anonymize") {
        const applicants = await prisma.applicant.findMany({
          where: { tenantId, createdAt: { lt: cutoff } },
          select: { id: true },
        });
        for (const a of applicants) {
          await prisma.applicant.update({
            where: { id: a.id },
            data: { fullName: "Anonymised applicant", email: null, phone: null },
          });
        }
        return applicants.length;
      }
      const r = await prisma.applicant.deleteMany({ where: { tenantId, createdAt: { lt: cutoff } } });
      return r.count;
    },
  },
};

export function supportedRetentionEntities(): string[] {
  return Object.keys(ENTITIES);
}

export async function listRetentionPolicies(actor: Actor) {
  authorize(actor, "setting.read");
  const tenantId = requireTenantId(actor);
  return prisma.dataRetentionPolicy.findMany({ where: { OR: [{ tenantId }, { tenantId: null }] }, orderBy: { entity: "asc" } });
}

export async function upsertRetentionPolicy(
  actor: Actor,
  input: { entity: string; retentionDays: number; action: RetentionAction; isActive?: boolean },
) {
  authorize(actor, "setting.manage");
  const tenantId = requireTenantId(actor);
  if (!ENTITIES[input.entity]) throw Errors.validation(`Unsupported entity: ${input.entity}. Supported: ${supportedRetentionEntities().join(", ")}.`);
  if (input.retentionDays < 1) throw Errors.validation("Retention days must be at least 1.");

  const policy = await prisma.dataRetentionPolicy.upsert({
    where: { tenantId_entity: { tenantId, entity: input.entity } },
    update: { retentionDays: input.retentionDays, action: input.action, isActive: input.isActive ?? true },
    create: { tenantId, entity: input.entity, retentionDays: input.retentionDays, action: input.action, isActive: input.isActive ?? true },
  });
  await recordAudit({ actor, action: "retention.upsert", resource: "DataRetentionPolicy", resourceId: policy.id, metadata: { entity: input.entity, retentionDays: input.retentionDays, action: input.action } });
  return policy;
}

export type RetentionRunResult = { entity: string; affected: number; action: RetentionAction };

/** Apply all active retention policies for the actor's tenant. */
export async function applyRetention(actor: Actor, opts: { dryRun?: boolean } = {}): Promise<RetentionRunResult[]> {
  authorize(actor, "setting.manage");
  const tenantId = requireTenantId(actor);
  const policies = await prisma.dataRetentionPolicy.findMany({ where: { tenantId, isActive: true } });
  const results: RetentionRunResult[] = [];

  for (const policy of policies) {
    const handler = ENTITIES[policy.entity];
    if (!handler) continue;
    const cutoff = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
    if (opts.dryRun) {
      results.push({ entity: policy.entity, affected: -1, action: policy.action as RetentionAction });
      continue;
    }
    const affected = await handler.apply(tenantId, cutoff, policy.action as RetentionAction);
    results.push({ entity: policy.entity, affected, action: policy.action as RetentionAction });
  }

  if (!opts.dryRun) {
    await recordAudit({ actor, action: "retention.apply", resource: "DataRetentionPolicy", metadata: { results } });
  }
  return results;
}
