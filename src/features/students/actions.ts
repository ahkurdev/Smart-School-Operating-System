"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import {
  createStudent,
  updateStudent,
  archiveStudent,
} from "@/server/services/student.service";

export type StudentActionResult =
  | { ok: true; message?: string; studentId?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function fail(e: unknown): StudentActionResult {
  if (isAppError(e)) return { ok: false, message: e.userMessage, fieldErrors: e.details };
  console.error("student action failed", e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

const baseSchema = z.object({
  fullName: z.string().min(2, "Enter the student's full name."),
  preferredName: z.string().optional(),
  studentNumber: z.string().optional(),
  nationalId: z.string().optional(),
  gender: z.string().optional(),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  phone: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  medicalNotes: z.string().optional(),
  specialEdNotes: z.string().optional(),
  campusId: z.string().optional(),
  status: z
    .enum(["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED", "WITHDRAWN", "APPLICANT"])
    .optional(),
});

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  return {
    fullName: get("fullName"),
    preferredName: get("preferredName"),
    studentNumber: get("studentNumber"),
    nationalId: get("nationalId"),
    gender: get("gender"),
    birthDate: get("birthDate"),
    birthPlace: get("birthPlace"),
    nationality: get("nationality"),
    religion: get("religion"),
    address: get("address"),
    city: get("city"),
    region: get("region"),
    country: get("country"),
    postalCode: get("postalCode"),
    email: get("email"),
    phone: get("phone"),
    emergencyContactName: get("emergencyContactName"),
    emergencyContactPhone: get("emergencyContactPhone"),
    medicalNotes: get("medicalNotes"),
    specialEdNotes: get("specialEdNotes"),
    campusId: get("campusId"),
    status: get("status"),
  };
}

export async function createStudentAction(
  _prev: StudentActionResult | undefined,
  formData: FormData,
): Promise<StudentActionResult> {
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
    const student = await createStudent(actor, {
      fullName: d.fullName,
      preferredName: d.preferredName,
      studentNumber: d.studentNumber,
      nationalId: d.nationalId,
      gender: d.gender,
      birthDate: d.birthDate ? new Date(d.birthDate) : undefined,
      birthPlace: d.birthPlace,
      nationality: d.nationality,
      religion: d.religion,
      address: d.address,
      city: d.city,
      region: d.region,
      country: d.country,
      postalCode: d.postalCode,
      email: d.email || undefined,
      phone: d.phone,
      emergencyContactName: d.emergencyContactName,
      emergencyContactPhone: d.emergencyContactPhone,
      medicalNotes: d.medicalNotes,
      specialEdNotes: d.specialEdNotes,
      campusId: d.campusId,
      status: d.status,
    });
    revalidatePath("/app/students");
    return { ok: true, message: "Student added.", studentId: student.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateStudentAction(
  _prev: StudentActionResult | undefined,
  formData: FormData,
): Promise<StudentActionResult> {
  const studentId = String(formData.get("studentId") ?? "");
  if (!studentId) return { ok: false, message: "Missing student." };
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
    await updateStudent(actor, studentId, {
      fullName: d.fullName,
      preferredName: d.preferredName,
      studentNumber: d.studentNumber,
      nationalId: d.nationalId,
      gender: d.gender,
      birthDate: d.birthDate ? new Date(d.birthDate) : undefined,
      birthPlace: d.birthPlace,
      nationality: d.nationality,
      religion: d.religion,
      address: d.address,
      city: d.city,
      region: d.region,
      country: d.country,
      postalCode: d.postalCode,
      email: d.email || undefined,
      phone: d.phone,
      emergencyContactName: d.emergencyContactName,
      emergencyContactPhone: d.emergencyContactPhone,
      medicalNotes: d.medicalNotes,
      specialEdNotes: d.specialEdNotes,
      campusId: d.campusId,
      status: d.status,
    });
    revalidatePath(`/app/students/${studentId}`);
    revalidatePath("/app/students");
    return { ok: true, message: "Changes saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveStudentAction(studentId: string): Promise<StudentActionResult> {
  try {
    const actor = await requireActor();
    await archiveStudent(actor, studentId);
    revalidatePath("/app/students");
    return { ok: true, message: "Student archived." };
  } catch (e) {
    return fail(e);
  }
}
