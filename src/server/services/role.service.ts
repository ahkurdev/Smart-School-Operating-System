import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import { ALL_PERMISSIONS, permissionSubject, type Permission } from "@/lib/permissions";
import type { Actor } from "@/types/actor";

/** Roles and their permission grants within a tenant. */

export async function listRolesWithPermissions(actor: Actor) {
  authorize(actor, "role.read");
  const tenantId = requireTenantId(actor);
  const roles = await prisma.role.findMany({
    where: { tenantId },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      isSystem: true,
      rolePermissions: { select: { permission: { select: { key: true } } } },
      _count: { select: { userRoles: true } },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    userCount: r._count.userRoles,
    permissions: r.rolePermissions
      .map((rp) => rp.permission.key)
      .filter((k): k is Permission => ALL_PERMISSIONS.includes(k as Permission)),
  }));
}

export type CreateRoleInput = {
  key: string;
  name: string;
  description?: string;
  permissions?: Permission[];
};

const KEY_RE = /^[a-z][a-z0-9_]{1,40}$/;

export async function createRole(actor: Actor, input: CreateRoleInput) {
  authorize(actor, "role.create");
  const tenantId = requireTenantId(actor);

  if (!KEY_RE.test(input.key)) {
    throw Errors.validation("Role key must be lowercase letters, numbers, and underscores.", {
      key: ["Use lowercase letters, numbers, and underscores, starting with a letter."],
    });
  }
  const existing = await prisma.role.findFirst({
    where: { tenantId, key: input.key },
    select: { id: true },
  });
  if (existing) throw Errors.conflict("A role with that key already exists.");

  const perms = (input.permissions ?? []).filter((p) => ALL_PERMISSIONS.includes(p));
  const permissionRows = perms.length
    ? await prisma.permission.findMany({
        where: { key: { in: perms } },
        select: { id: true },
      })
    : [];

  const role = await prisma.$transaction(async (tx) => {
    const created = await tx.role.create({
      data: {
        tenantId,
        key: input.key,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        isSystem: false,
      },
      select: { id: true, key: true, name: true },
    });
    if (permissionRows.length) {
      await tx.rolePermission.createMany({
        data: permissionRows.map((p) => ({ roleId: created.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
    return created;
  });

  await recordAudit({
    actor,
    action: "role.create",
    resource: "Role",
    resourceId: role.id,
    after: { key: role.key, name: role.name, permissions: perms },
  });
  return role;
}

export async function updateRolePermissions(
  actor: Actor,
  roleId: string,
  permissions: Permission[],
) {
  authorize(actor, "role.update");
  const tenantId = requireTenantId(actor);
  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId },
    select: { id: true, key: true },
  });
  if (!role) throw Errors.notFound();

  const perms = permissions.filter((p) => ALL_PERMISSIONS.includes(p));
  const permissionRows = await prisma.permission.findMany({
    where: { key: { in: perms } },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: permissionRows.map((p) => ({ roleId, permissionId: p.id })),
      skipDuplicates: true,
    }),
  ]);

  await recordAudit({
    actor,
    action: "role.update_permissions",
    resource: "Role",
    resourceId: roleId,
    after: { permissions: perms },
  });
}

export async function deleteRole(actor: Actor, roleId: string) {
  authorize(actor, "role.delete");
  const tenantId = requireTenantId(actor);
  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId },
    select: { id: true, isSystem: true, _count: { select: { userRoles: true } } },
  });
  if (!role) throw Errors.notFound();
  if (role.isSystem) throw Errors.conflict("Built-in roles cannot be deleted.");
  if (role._count.userRoles > 0) {
    throw Errors.conflict("This role is assigned to users. Reassign them first.");
  }
  await prisma.role.delete({ where: { id: roleId } });
  await recordAudit({ actor, action: "role.delete", resource: "Role", resourceId: roleId });
}

/**
 * The permission catalog grouped by subject, for the role editor UI.
 */
export function groupPermissions() {
  const groups = new Map<string, Permission[]>();
  for (const p of ALL_PERMISSIONS) {
    const subject = permissionSubject(p);
    const list = groups.get(subject) ?? [];
    list.push(p);
    groups.set(subject, list);
  }
  return [...groups.entries()].map(([subject, permissions]) => ({ subject, permissions }));
}
