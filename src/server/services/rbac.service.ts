import { prisma } from "@/server/db/client";
import {
  ALL_PERMISSIONS,
  permissionSubject,
  PERMISSIONS,
  type Permission,
} from "@/lib/permissions";
import {
  PLATFORM_ROLES,
  TENANT_ROLES,
  expandPermissions,
  type RoleSeed,
} from "@/server/services/rbac.seed";

/**
 * RBAC service. Two jobs:
 *  - syncPermissionCatalog(): upsert the canonical Permission rows.
 *  - materialiseRoles(): for a given tenant (or platform), create the role rows
 *    and wire their permissions from the seed templates.
 */

/** Category a permission belongs to (for the role editor grouping). */
function permissionCategory(p: Permission): string {
  const subject = permissionSubject(p);
  const map: Record<string, string> = {
    platform: "Platform",
    tenant: "Platform",
    campus: "Platform",
    user: "People",
    role: "People",
    membership: "People",
    student: "People",
    teacher: "People",
    staff: "People",
    guardian: "People",
    academic: "Academic",
    class: "Academic",
    subject: "Academic",
    timetable: "Academic",
    attendance: "Academic",
    grade: "Academic",
    assignment: "Academic",
    material: "Academic",
    admission: "Admissions",
    cms: "Content",
    media: "Content",
    announcement: "Communication",
    message: "Communication",
    notification: "Communication",
    library: "Operations",
    finance: "Operations",
    asset: "Operations",
    facility: "Operations",
    extracurricular: "Operations",
    achievement: "Operations",
    counseling: "Wellbeing",
    discipline: "Wellbeing",
    document: "Operations",
    reporting: "Intelligence",
    ai: "Intelligence",
    audit: "System",
    setting: "System",
    apikey: "System",
  };
  return map[subject] ?? "Other";
}

/** Upsert the full permission catalog. Idempotent. */
export async function syncPermissionCatalog(): Promise<void> {
  for (const key of ALL_PERMISSIONS) {
    const idx = key.indexOf(".");
    const subject = idx === -1 ? key : key.slice(0, idx);
    const action = idx === -1 ? "" : key.slice(idx + 1);
    await prisma.permission.upsert({
      where: { key },
      create: {
        key,
        subject,
        action,
        category: permissionCategory(key),
        description: PERMISSIONS[key],
      },
      update: {
        subject,
        action,
        category: permissionCategory(key),
        description: PERMISSIONS[key],
      },
    });
  }
}

async function applyRolePermissions(roleId: string, seed: RoleSeed): Promise<void> {
  const permissions = expandPermissions(seed).map((p) => p);
  const rows = await prisma.permission.findMany({
    where: { key: { in: permissions } },
    select: { id: true },
  });
  // Replace the set to stay idempotent.
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: rows.map((r) => ({ roleId, permissionId: r.id })),
      skipDuplicates: true,
    }),
  ]);
}

/** Create platform-level role templates (idempotent). */
export async function materialisePlatformRoles(): Promise<void> {
  for (const seed of PLATFORM_ROLES) {
    const existing = await prisma.role.findFirst({
      where: { tenantId: null, key: seed.key },
      select: { id: true },
    });
    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: {
            name: seed.name,
            description: seed.description,
            isSystem: seed.isSystem,
            isDefault: seed.isDefault,
          },
          select: { id: true },
        })
      : await prisma.role.create({
          data: {
            tenantId: null,
            key: seed.key,
            name: seed.name,
            description: seed.description,
            isSystem: seed.isSystem,
            isDefault: seed.isDefault,
          },
          select: { id: true },
        });
    await applyRolePermissions(role.id, seed);
  }
}

/** Create the tenant's default roles (idempotent). */
export async function materialiseTenantRoles(tenantId: string): Promise<void> {
  for (const seed of TENANT_ROLES) {
    const role = await prisma.role.upsert({
      where: { tenantId_key: { tenantId, key: seed.key } },
      create: {
        tenantId,
        key: seed.key,
        name: seed.name,
        description: seed.description,
        isSystem: seed.isSystem,
        isDefault: seed.isDefault,
      },
      update: {
        name: seed.name,
        description: seed.description,
        isSystem: seed.isSystem,
        isDefault: seed.isDefault,
      },
      select: { id: true },
    });
    await applyRolePermissions(role.id, seed);
  }
}

/** Find the platform super-admin role id. */
export async function getPlatformRoleId(key: string): Promise<string | null> {
  const role = await prisma.role.findFirst({
    where: { tenantId: null, key },
    select: { id: true },
  });
  return role?.id ?? null;
}
