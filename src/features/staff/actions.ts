"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import {
  createStaff,
  updateStaff,
  archiveStaff,
  type StaffStatusFilter,
} from "@/server/services/staff.service";

export type StaffActionResult =
  | { ok: true; message?: string; staffId?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function fail(e: unknown): StaffActionResult {
  if (isAppError(e)) return { ok: false, message: e.userMessage, fieldErrors: e.details };
  console.error("staff action failed", e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

const STATUSES = ["ACTIVE", "ON_LEAVE", "INACTIVE", "TERMINATED"] as const;

const baseSchema = z.object({
  fullName: z.string().min(2, "Enter the staff member's full name."),
  employeeNumber: z.string().optional(),
  position: z.string().min(2, "Enter a position or job title."),
  department: z.string().optional(),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  phone: z.string().optional(),
  joinDate: z.string().optional(),
  status: z.enum(STATUSES).optional(),
});

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  return {
    fullName: get("fullName"),
    employeeNumber: get("employeeNumber"),
    position: get("position"),
    department: get("department"),
    email: get("email"),
    phone: get("phone"),
    joinDate: get("joinDate"),
    status: get("status"),
  };
}

export async function createStaffAction(
  _prev: StaffActionResult | undefined,
  formData: FormData,
): Promise<StaffActionResult> {
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
    const staff = await createStaff(actor, {
      fullName: d.fullName,
      employeeNumber: d.employeeNumber,
      position: d.position,
      department: d.department,
      email: d.email || undefined,
      phone: d.phone,
      joinDate: d.joinDate ? new Date(d.joinDate) : undefined,
      status: d.status as StaffStatusFilter | undefined,
    });
    revalidatePath("/app/staff");
    return { ok: true, message: "Staff member added.", staffId: staff.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateStaffAction(
  _prev: StaffActionResult | undefined,
  formData: FormData,
): Promise<StaffActionResult> {
  const staffId = String(formData.get("staffId") ?? "");
  if (!staffId) return { ok: false, message: "Missing staff member." };
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
    await updateStaff(actor, staffId, {
      fullName: d.fullName,
      employeeNumber: d.employeeNumber,
      position: d.position,
      department: d.department,
      email: d.email || undefined,
      phone: d.phone,
      joinDate: d.joinDate ? new Date(d.joinDate) : undefined,
      status: d.status as StaffStatusFilter | undefined,
    });
    revalidatePath("/app/staff");
    return { ok: true, message: "Changes saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveStaffAction(staffId: string): Promise<StaffActionResult> {
  try {
    const actor = await requireActor();
    await archiveStaff(actor, staffId);
    revalidatePath("/app/staff");
    return { ok: true, message: "Staff member archived." };
  } catch (e) {
    return fail(e);
  }
}
