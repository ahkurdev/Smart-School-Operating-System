import { prisma } from "@/server/db/client";
import type { Actor } from "@/types/actor";

/**
 * The tenants an actor may act in (active memberships on active tenants).
 * Used server-side by pages that need to render a school picker when no active
 * tenant is selected. Mirrors `listMyTenantsAction` but callable from RSCs.
 */
export async function listMyTenants(actor: Actor): Promise<{ tenantId: string; name: string; slug: string }[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId: actor.userId, status: "ACTIVE", tenant: { status: "ACTIVE" } },
    select: { tenantId: true, tenant: { select: { name: true, slug: true } } },
    orderBy: { tenant: { name: "asc" } },
  });
  return memberships.map((m) => ({ tenantId: m.tenantId, name: m.tenant.name, slug: m.tenant.slug }));
}
