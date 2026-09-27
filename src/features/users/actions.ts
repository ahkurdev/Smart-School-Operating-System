"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import {
  createUser,
  updateUser,
  setUserRoles,
  setUserStatus,
  resetUserPassword,
} from "@/server/services/user.service";

export type UserActionResult =
  | { ok: true; message?: string; temporaryPassword?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function fail(e: unknown): UserActionResult {
  if (isAppError(e)) return { ok: false, message: e.userMessage, fieldErrors: e.details };
  console.error("user action failed", e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

const createSchema = z.object({
  fullName: z.string().min(2, "Enter a full name."),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  username: z.string().min(3, "Username must be at least 3 characters.").optional().or(z.literal("")),
  title: z.string().optional(),
  roleKeys: z.array(z.string()).optional(),
  password: z.string().optional(),
  generatePassword: z.boolean().optional(),
});

export async function createUserAction(
  _prev: UserActionResult | undefined,
  formData: FormData,
): Promise<UserActionResult> {
  const roleKeys = formData.getAll("roleKeys").map(String).filter(Boolean);
  const parsed = createSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email") ?? "",
    username: formData.get("username") ?? "",
    title: formData.get("title") ?? "",
    password: formData.get("password") ?? "",
    generatePassword: formData.get("generatePassword") === "on",
    roleKeys,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  if (!parsed.data.email && !parsed.data.username) {
    return { ok: false, message: "Provide an email or a username." };
  }
  if (!parsed.data.password && !parsed.data.generatePassword) {
    return { ok: false, message: "Provide a password or enable generation." };
  }

  try {
    const actor = await requireActor();
    const result = await createUser(actor, {
      fullName: parsed.data.fullName,
      email: parsed.data.email || undefined,
      username: parsed.data.username || undefined,
      title: parsed.data.title || undefined,
      roleKeys: parsed.data.roleKeys,
      password: parsed.data.password || undefined,
      generatePassword: parsed.data.generatePassword,
    });
    revalidatePath("/app/users");
    return {
      ok: true,
      message: "User created.",
      ...(result.temporaryPassword ? { temporaryPassword: result.temporaryPassword } : {}),
    };
  } catch (e) {
    return fail(e);
  }
}

const updateSchema = z.object({
  membershipId: z.string().min(1),
  fullName: z.string().min(2, "Enter a full name."),
  preferredName: z.string().optional(),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  username: z.string().min(3, "Username must be at least 3 characters.").optional().or(z.literal("")),
  phone: z.string().optional(),
  title: z.string().optional(),
});

export async function updateUserAction(
  _prev: UserActionResult | undefined,
  formData: FormData,
): Promise<UserActionResult> {
  const parsed = updateSchema.safeParse({
    membershipId: formData.get("membershipId"),
    fullName: formData.get("fullName"),
    preferredName: formData.get("preferredName") ?? "",
    email: formData.get("email") ?? "",
    username: formData.get("username") ?? "",
    phone: formData.get("phone") ?? "",
    title: formData.get("title") ?? "",
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
    await updateUser(actor, parsed.data.membershipId, {
      fullName: parsed.data.fullName,
      preferredName: parsed.data.preferredName || null,
      email: parsed.data.email || null,
      username: parsed.data.username || null,
      phone: parsed.data.phone || null,
      title: parsed.data.title || null,
    });
    revalidatePath("/app/users");
    return { ok: true, message: "Changes saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function setUserRolesAction(
  membershipId: string,
  roleKeys: string[],
): Promise<UserActionResult> {
  try {
    const actor = await requireActor();
    await setUserRoles(actor, membershipId, roleKeys);
    revalidatePath("/app/users");
    return { ok: true, message: "Roles updated." };
  } catch (e) {
    return fail(e);
  }
}

export async function setUserStatusAction(
  membershipId: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<UserActionResult> {
  try {
    const actor = await requireActor();
    await setUserStatus(actor, membershipId, status);
    revalidatePath("/app/users");
    return { ok: true, message: "Status updated." };
  } catch (e) {
    return fail(e);
  }
}

export async function resetUserPasswordAction(
  membershipId: string,
): Promise<UserActionResult> {
  try {
    const actor = await requireActor();
    const { temporaryPassword } = await resetUserPassword(actor, membershipId);
    revalidatePath("/app/users");
    return { ok: true, message: "Password reset.", temporaryPassword };
  } catch (e) {
    return fail(e);
  }
}
