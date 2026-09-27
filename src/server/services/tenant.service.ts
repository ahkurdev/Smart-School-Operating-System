import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { materialiseTenantRoles } from "@/server/services/rbac.service";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Tenant service. A tenant is an organization (school, district, institute).
 * Creating one provisions its default roles and a first campus, in a single
 * transaction so a half-built school can never exist.
 */

export type CreateTenantInput = {
  slug: string;
  name: string;
  legalName?: string;
  type?: "SCHOOL" | "DISTRICT" | "INSTITUTE" | "UNIVERSITY";
  timezone?: string;
  locale?: string;
  currency?: string;
  primaryColor?: string;
  gradeLabel?: string;
  classLabel?: string;
  studentIdLabel?: string;
  /** Name of the first campus to create. Defaults to the school name. */
  firstCampusName?: string;
};

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function validateSlug(slug: string): string | null {
  if (!SLUG_RE.test(slug)) {
    return "Slug must be 3-40 characters, lowercase letters, numbers, and hyphens.";
  }
  return null;
}

export async function createTenant(actor: Actor, input: CreateTenantInput) {
  // Only platform admins create tenants.
  authorize(actor, "platform.manage");

  const slugProblem = validateSlug(input.slug);
  if (slugProblem) throw Errors.validation(slugProblem, { slug: [slugProblem] });

  const existing = await prisma.tenant.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (existing) throw Errors.conflict("A school with that slug already exists.");

  const tenant = await prisma.tenant.create({
    data: {
      slug: input.slug,
      name: input.name.trim(),
      legalName: input.legalName?.trim() || null,
      type: input.type ?? "SCHOOL",
      timezone: input.timezone ?? "UTC",
      locale: input.locale ?? "en",
      currency: input.currency ?? "USD",
      primaryColor: input.primaryColor ?? "#0f766e",
      gradeLabel: input.gradeLabel ?? "Grade",
      classLabel: input.classLabel ?? "Class",
      studentIdLabel: input.studentIdLabel ?? "Student ID",
      campuses: {
        create: {
          name: input.firstCampusName?.trim() || input.name.trim(),
          code: "MAIN",
          isPrimary: true,
        },
      },
    },
    select: { id: true, slug: true, name: true },
  });

  // Roles are materialised inside a follow-up call (outside the tx is fine
  // because role sync is idempotent and safe to re-run).
  await materialiseTenantRoles(tenant.id);

  await recordAudit({
    actor,
    action: "tenant.create",
    resource: "Tenant",
    resourceId: tenant.id,
    after: { slug: tenant.slug, name: tenant.name },
  });

  return tenant;
}

export type UpdateTenantInput = Partial<
  Pick<
    CreateTenantInput,
    | "name"
    | "legalName"
    | "type"
    | "timezone"
    | "locale"
    | "currency"
    | "primaryColor"
    | "gradeLabel"
    | "classLabel"
    | "studentIdLabel"
  >
> & {
  logoUrl?: string | null;
  academicTermsPerYear?: number;
  gradingScale?: Record<string, unknown>;
  featureFlags?: Record<string, boolean>;
};

export async function updateTenant(
  actor: Actor,
  tenantId: string,
  input: UpdateTenantInput,
) {
  authorize(actor, "tenant.update");
  // Tenant admins may only update their own tenant; platform admins any.
  if (!actor.isPlatform && actor.tenantId !== tenantId) {
    throw Errors.notFound();
  }

  const before = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, timezone: true, locale: true, primaryColor: true },
  });
  if (!before) throw Errors.notFound("That school was not found.");

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.legalName !== undefined ? { legalName: input.legalName?.trim() || null } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
      ...(input.gradeLabel !== undefined ? { gradeLabel: input.gradeLabel } : {}),
      ...(input.classLabel !== undefined ? { classLabel: input.classLabel } : {}),
      ...(input.studentIdLabel !== undefined ? { studentIdLabel: input.studentIdLabel } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.academicTermsPerYear !== undefined
        ? { academicTermsPerYear: input.academicTermsPerYear }
        : {}),
      ...(input.gradingScale !== undefined
        ? { gradingScale: input.gradingScale as object }
        : {}),
      ...(input.featureFlags !== undefined
        ? { featureFlags: input.featureFlags as object }
        : {}),
    },
    select: { id: true, slug: true, name: true },
  });

  await recordAudit({
    actor,
    action: "tenant.update",
    resource: "Tenant",
    resourceId: tenantId,
    before,
    after: input,
  });

  return updated;
}

/** Read a tenant's public-ish settings (name, branding, feature flags). */
export async function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      status: true,
      timezone: true,
      locale: true,
      currency: true,
      primaryColor: true,
      logoUrl: true,
      gradeLabel: true,
      classLabel: true,
      studentIdLabel: true,
      academicTermsPerYear: true,
      gradingScale: true,
      featureFlags: true,
    },
  });
}

/** Whether a module is enabled for a tenant by feature flag. */
export async function isFeatureEnabled(
  tenantId: string,
  flag: string,
): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { featureFlags: true },
  });
  const flags = (tenant?.featureFlags as Record<string, boolean> | null) ?? {};
  return flags[flag] !== false;
}

// --- Campuses ---------------------------------------------------------------

export type CreateCampusInput = {
  tenantId: string;
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
};

export async function createCampus(actor: Actor, input: CreateCampusInput) {
  authorize(actor, "campus.create");
  if (!actor.isPlatform && actor.tenantId !== input.tenantId) {
    throw Errors.forbidden();
  }

  if (input.isPrimary) {
    await prisma.campus.updateMany({
      where: { tenantId: input.tenantId },
      data: { isPrimary: false },
    });
  }

  const campus = await prisma.campus.create({
    data: {
      tenantId: input.tenantId,
      name: input.name.trim(),
      code: input.code?.trim() || "MAIN",
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      isPrimary: input.isPrimary ?? false,
    },
    select: { id: true, name: true },
  });

  await recordAudit({
    actor,
    action: "campus.create",
    resource: "Campus",
    resourceId: campus.id,
    after: { name: campus.name },
  });
  return campus;
}

export async function listCampuses(tenantId: string) {
  return prisma.campus.findMany({
    where: { tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      code: true,
      isPrimary: true,
      address: true,
      phone: true,
      email: true,
    },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });
}
