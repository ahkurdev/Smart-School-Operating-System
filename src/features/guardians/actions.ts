"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import {
  createGuardian,
  updateGuardian,
  archiveGuardian,
  linkGuardianToStudent,
  updateGuardianLink,
  unlinkGuardianFromStudent,
} from "@/server/services/guardian.service";

export type GuardianActionResult =
  | { ok: true; message?: string; guardianId?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function fail(e: unknown): GuardianActionResult {
  if (isAppError(e)) return { ok: false, message: e.userMessage, fieldErrors: e.details };
  console.error("guardian action failed", e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

const baseSchema = z.object({
  fullName: z.string().min(2, "Enter the guardian's full name."),
  relationship: z.string().min(2, "Enter the relationship (e.g. Mother, Father, Uncle)."),
  nationalId: z.string().optional(),
  occupation: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  address: z.string().optional(),
});

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  return {
    fullName: get("fullName"),
    relationship: get("relationship"),
    nationalId: get("nationalId"),
    occupation: get("occupation"),
    phone: get("phone"),
    email: get("email"),
    address: get("address"),
  };
}

export async function createGuardianAction(
  _prev: GuardianActionResult | undefined,
  formData: FormData,
): Promise<GuardianActionResult> {
  const parsed = baseSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  try {
    const actor = await requireActor();
    const d = parsed.data;
    const guardian = await createGuardian(actor, {
      fullName: d.fullName,
      relationship: d.relationship,
      nationalId: d.nationalId,
      occupation: d.occupation,
      phone: d.phone,
      email: d.email || undefined,
      address: d.address,
    });
    revalidatePath("/app/guardians");
    return { ok: true, message: "Guardian added.", guardianId: guardian.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateGuardianAction(
  _prev: GuardianActionResult | undefined,
  formData: FormData,
): Promise<GuardianActionResult> {
  const guardianId = String(formData.get("guardianId") ?? "");
  if (!guardianId) return { ok: false, message: "Missing guardian." };
  const parsed = baseSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  try {
    const actor = await requireActor();
    const d = parsed.data;
    await updateGuardian(actor, guardianId, {
      fullName: d.fullName,
      relationship: d.relationship,
      nationalId: d.nationalId,
      occupation: d.occupation,
      phone: d.phone,
      email: d.email || undefined,
      address: d.address,
    });
    revalidatePath(`/app/guardians/${guardianId}`);
    revalidatePath("/app/guardians");
    return { ok: true, message: "Changes saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveGuardianAction(guardianId: string): Promise<GuardianActionResult> {
  try {
    const actor = await requireActor();
    await archiveGuardian(actor, guardianId);
    revalidatePath("/app/guardians");
    return { ok: true, message: "Guardian archived." };
  } catch (e) {
    return fail(e);
  }
}

const linkSchema = z.object({
  guardianId: z.string().min(1, "Choose a guardian."),
  studentId: z.string().min(1, "Choose a student."),
  relationship: z.string().optional(),
  isPrimary: z.boolean().optional(),
  canPickup: z.boolean().optional(),
  hasPortalAccess: z.boolean().optional(),
});

/** Link a student to a guardian (used from the guardian detail page). */
export async function linkStudentAction(
  _prev: GuardianActionResult | undefined,
  formData: FormData,
): Promise<GuardianActionResult> {
  const checkbox = (k: string) => formData.get(k) === "on" || formData.get(k) === "true";
  const parsed = linkSchema.safeParse({
    guardianId: String(formData.get("guardianId") ?? ""),
    studentId: String(formData.get("studentId") ?? ""),
    relationship: formData.get("relationship") || undefined,
    isPrimary: checkbox("isPrimary"),
    canPickup: formData.has("canPickup") ? checkbox("canPickup") : true,
    hasPortalAccess: formData.has("hasPortalAccess") ? checkbox("hasPortalAccess") : true,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Choose a student to link.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  try {
    const actor = await requireActor();
    await linkGuardianToStudent(actor, parsed.data);
    revalidatePath(`/app/guardians/${parsed.data.guardianId}`);
    return { ok: true, message: "Student linked." };
  } catch (e) {
    return fail(e);
  }
}

/** Update the rights on an existing link. */
export async function updateLinkAction(
  guardianId: string,
  studentId: string,
  input: { isPrimary?: boolean; canPickup?: boolean; hasPortalAccess?: boolean; relationship?: string },
): Promise<GuardianActionResult> {
  try {
    const actor = await requireActor();
    await updateGuardianLink(actor, { guardianId, studentId, ...input });
    revalidatePath(`/app/guardians/${guardianId}`);
    return { ok: true, message: "Link updated." };
  } catch (e) {
    return fail(e);
  }
}

export async function unlinkStudentAction(
  guardianId: string,
  studentId: string,
): Promise<GuardianActionResult> {
  try {
    const actor = await requireActor();
    await unlinkGuardianFromStudent(actor, { guardianId, studentId });
    revalidatePath(`/app/guardians/${guardianId}`);
    return { ok: true, message: "Student unlinked." };
  } catch (e) {
    return fail(e);
  }
}
