"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, setSessionTenant, buildActor } from "@/server/auth/session";
import { verifySessionJwt } from "@/server/auth/signing";
import { prisma } from "@/server/db/client";

/**
 * Switch the active tenant for the current session. The chosen tenant must be one
 * the user is actually a member of (verified server-side).
 */
export async function switchTenantAction(tenantId: string): Promise<{ ok: boolean }> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return { ok: false };
  const claims = await verifySessionJwt(value);
  if (!claims) return { ok: false };

  const membership = await prisma.membership.findFirst({
    where: { userId: claims.uid, tenantId, status: "ACTIVE", tenant: { status: "ACTIVE" } },
    select: { id: true },
  });
  if (!membership) return { ok: false };

  await setSessionTenant(claims.sid, tenantId);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** List the tenants the current user may switch to. */
export async function listMyTenantsAction() {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return [];
  const claims = await verifySessionJwt(value);
  if (!claims) return [];
  const memberships = await prisma.membership.findMany({
    where: { userId: claims.uid, status: "ACTIVE", tenant: { status: "ACTIVE" } },
    select: { tenantId: true, tenant: { select: { name: true, slug: true } } },
    orderBy: { tenant: { name: "asc" } },
  });
  return memberships.map((m) => ({
    tenantId: m.tenantId,
    name: m.tenant.name,
    slug: m.tenant.slug,
  }));
}

export { buildActor };
