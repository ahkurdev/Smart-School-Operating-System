"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import {
  createTeacher,
  updateTeacher,
  archiveTeacher,
  type TeacherEmploymentType,
  type TeacherStatusFilter,
} from "@/server/services/teacher.service";

export type TeacherActionResult =
  | { ok: true; message?: string; teacherId?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function fail(e: unknown): TeacherActionResult {
  if (isAppError(e)) return { ok: false, message: e.userMessage, fieldErrors: e.details };
  console.error("teacher action failed", e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

const STATUSES = ["ACTIVE", "ON_LEAVE", "INACTIVE", "TERMINATED"] as const;
const EMPLOYMENT = ["FULL_TIME", "PART_TIME", "CONTRACT", "VOLUNTEER", "SUBSTITUTE"] as const;

const baseSchema = z.object({
  fullName: z.string().min(2, "Enter the teacher's full name."),
  employeeNumber: z.string().optional(),
  gender: z.string().optional(),
  qualification: z.string().optional(),
  specialization: z.string().optional(),
  employmentType: z.enum(EMPLOYMENT).optional(),
  joinDate: z.string().optional(),
  exitDate: z.string().optional(),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  campusId: z.string().optional(),
  departmentId: z.string().optional(),
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
    gender: get("gender"),
    qualification: get("qualification"),
    specialization: get("specialization"),
    employmentType: get("employmentType"),
    joinDate: get("joinDate"),
    exitDate: get("exitDate"),
    email: get("email"),
    phone: get("phone"),
    address: get("address"),
    campusId: get("campusId"),
    departmentId: get("departmentId"),
    status: get("status"),
  };
}

export async function createTeacherAction(
  _prev: TeacherActionResult | undefined,
  formData: FormData,
): Promise<TeacherActionResult> {
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
    const teacher = await createTeacher(actor, {
      fullName: d.fullName,
      employeeNumber: d.employeeNumber,
      gender: d.gender,
      qualification: d.qualification,
      specialization: d.specialization,
      employmentType: d.employmentType as TeacherEmploymentType | undefined,
      joinDate: d.joinDate ? new Date(d.joinDate) : undefined,
      exitDate: d.exitDate ? new Date(d.exitDate) : undefined,
      email: d.email || undefined,
      phone: d.phone,
      address: d.address,
      campusId: d.campusId,
      departmentId: d.departmentId,
      status: d.status as TeacherStatusFilter | undefined,
    });
    revalidatePath("/app/teachers");
    return { ok: true, message: "Teacher added.", teacherId: teacher.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTeacherAction(
  _prev: TeacherActionResult | undefined,
  formData: FormData,
): Promise<TeacherActionResult> {
  const teacherId = String(formData.get("teacherId") ?? "");
  if (!teacherId) return { ok: false, message: "Missing teacher." };
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
    await updateTeacher(actor, teacherId, {
      fullName: d.fullName,
      employeeNumber: d.employeeNumber,
      gender: d.gender,
      qualification: d.qualification,
      specialization: d.specialization,
      employmentType: d.employmentType as TeacherEmploymentType | undefined,
      joinDate: d.joinDate ? new Date(d.joinDate) : undefined,
      exitDate: d.exitDate ? new Date(d.exitDate) : undefined,
      email: d.email || undefined,
      phone: d.phone,
      address: d.address,
      campusId: d.campusId,
      departmentId: d.departmentId,
      status: d.status as TeacherStatusFilter | undefined,
    });
    revalidatePath(`/app/teachers/${teacherId}`);
    revalidatePath("/app/teachers");
    return { ok: true, message: "Changes saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveTeacherAction(teacherId: string): Promise<TeacherActionResult> {
  try {
    const actor = await requireActor();
    await archiveTeacher(actor, teacherId);
    revalidatePath("/app/teachers");
    return { ok: true, message: "Teacher archived." };
  } catch (e) {
    return fail(e);
  }
}
