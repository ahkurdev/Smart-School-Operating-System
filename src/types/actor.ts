import type { Permission } from "@/lib/permissions";

/**
 * The authenticated identity that every service call receives. Authorization is
 * never implied: services take an explicit `Actor` and the policy layer answers
 * "may this actor do X to Y".
 */
export type Actor = {
  userId: string;
  /** Active tenant for this request, or null for platform-level actors. */
  tenantId: string | null;
  /** Permissions resolved from the user's roles in the active tenant. */
  permissions: ReadonlySet<Permission>;
  /** True for platform super-admins who operate across tenants. */
  isPlatform: boolean;
  /** Role keys held in the active tenant (for role-aware behaviour/prompts). */
  roleKeys: readonly string[];
  /** Request metadata for audit (best-effort). */
  ip?: string | null;
  userAgent?: string | null;
};

/** A minimal actor shape used before a tenant is chosen (login, tenant picker). */
export type BaseUser = {
  id: string;
  email: string | null;
  username: string | null;
  fullName: string;
  preferredName: string | null;
  avatarUrl: string | null;
  isPlatform: boolean;
};

/** One tenant a user can act within, plus the roles they hold there. */
export type TenantMembership = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  roles: { key: string; name: string }[];
};
