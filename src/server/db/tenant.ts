import type { Actor } from "@/types/actor";
import { Errors } from "@/server/errors";

/**
 * Tenant scoping. Every query against tenant-scoped data must be filtered by the
 * actor's tenant on the server. This helper is the single, auditable place that
 * produces that filter so a missed `where: { tenantId }` becomes a type/compile
 * concern rather than a silent data leak.
 */

/** Returns the actor's tenantId or throws if the actor has no active tenant. */
export function requireTenantId(actor: Actor): string {
  if (!actor.tenantId) {
    throw Errors.forbidden("No active school selected for this action.");
  }
  return actor.tenantId;
}

/**
 * Produce a Prisma `where` fragment scoped to the actor's tenant. Platform actors
 * may pass `{ allowAll: true }` for genuine cross-tenant admin operations; that
 * choice is explicit and visible at the call site.
 */
export function tenantScope(
  actor: Actor,
  options?: { allowAll?: boolean },
): { tenantId: string } | Record<string, never> {
  if (!actor.tenantId) {
    if (options?.allowAll && actor.isPlatform) return {};
    throw Errors.forbidden("No active school selected for this action.");
  }
  return { tenantId: actor.tenantId };
}

/**
 * Merge a tenant scope into an existing Prisma `where`. Use this instead of
 * hand-writing `{ tenantId }` so isolation stays consistent.
 */
export function scoped<T extends Record<string, unknown>>(
  actor: Actor,
  where: T,
  options?: { allowAll?: boolean },
): T & { tenantId?: string } {
  return { ...where, ...tenantScope(actor, options) };
}

/** Assert a resource belongs to the actor's tenant (defence against IDOR). */
export function assertSameTenant(
  actor: Actor,
  resourceTenantId: string,
  options?: { allowAll?: boolean },
): void {
  if (options?.allowAll && actor.isPlatform) return;
  if (!actor.tenantId || actor.tenantId !== resourceTenantId) {
    // Deliberately 404-shaped: never confirm existence of another tenant's data.
    throw Errors.notFound("The requested item was not found.");
  }
}
