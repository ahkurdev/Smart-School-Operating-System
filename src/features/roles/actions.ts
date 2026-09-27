"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import { createRole, updateRolePermissions, deleteRole } from "@/server/services/role.service";
import { isPermission, type Permission } from "@/lib/permissions";

export type RoleActionResult = { ok: true; message?: string } | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function fail(e: unknown): RoleActionResult {
  if (isAppError(e)) return { ok: false, message: e.userMessage, fieldErrors: e.details };
  console.error("role action failed", e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

const roleSchema = z.object({
  key: z.string().min(2, "Enter a role key."),
  name: z.string().min(2, "Enter a role name."),
  description: z.string().optional(),
});

export async function createRoleAction(
  _prev: RoleActionResult | undefined,
  formData: FormData,
): Promise<RoleActionResult> {
  const permissions = formData
    .getAll("permissions")
    .map(String)
    .filter((p): p is Permission => isPermission(p));
  const parsed = roleSchema.safeParse({
    key: formData.get("key"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  try {
    const actor = await requireActor();
    await createRole(actor, {
      key: parsed.data.key,
      name: parsed.data.name,
      description: parsed.data.description || undefined,
      permissions,
    });
    revalidatePath("/app/roles");
    return { ok: true, message: "Role created." };
  } catch (e) {
    return fail(e);
  }
}

const updateSchema = z.object({
  roleId: z.string().min(1),
});

export async function updateRolePermissionsAction(
  _prev: RoleActionResult | undefined,
  formData: FormData,
): Promise<RoleActionResult> {
  const parsed = updateSchema.safeParse({ roleId: formData.get("roleId") });
  if (!parsed.success) return { ok: false, message: "Missing role." };
  const permissions = formData
    .getAll("permissions")
    .map(String)
    .filter((p): p is Permission => isPermission(p));
  try {
    const actor = await requireActor();
    await updateRolePermissions(actor, parsed.data.roleId, permissions);
    revalidatePath("/app/roles");
    return { ok: true, message: "Permissions updated." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRoleAction(roleId: string): Promise<RoleActionResult> {
  try {
    const actor = await requireActor();
    await deleteRole(actor, roleId);
    revalidatePath("/app/roles");
    return { ok: true, message: "Role deleted." };
  } catch (e) {
    return fail(e);
  }
}
