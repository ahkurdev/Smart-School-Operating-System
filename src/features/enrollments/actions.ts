"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import {
  enrollStudent,
  transferStudent,
  withdrawStudent,
  bulkEnroll,
  listEnrollableStudents,
} from "@/server/services/enrollment.service";

export type EnrollmentActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function fail(e: unknown): EnrollmentActionResult {
  if (isAppError(e)) return { ok: false, message: e.userMessage, fieldErrors: e.details };
  console.error("enrollment action failed", e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

export async function enrollStudentAction(
  _prev: EnrollmentActionResult | undefined,
  formData: FormData,
): Promise<EnrollmentActionResult> {
  const parsed = z
    .object({
      studentId: z.string().min(1, "Select a student."),
      classroomId: z.string().min(1),
      academicYearId: z.string().min(1),
      rollNumber: z.coerce.number().int().min(0).optional(),
    })
    .safeParse({
      studentId: formData.get("studentId"),
      classroomId: formData.get("classroomId"),
      academicYearId: formData.get("academicYearId"),
      rollNumber: formData.get("rollNumber") || undefined,
    });
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const actor = await requireActor();
    const res = await enrollStudent(actor, parsed.data);
    revalidatePath(`/app/classes/${parsed.data.classroomId}`);
    revalidatePath(`/app/students/${parsed.data.studentId}`);
    return { ok: true, message: "Student enrolled.", id: res.id };
  } catch (e) {
    return fail(e);
  }
}

export async function transferStudentAction(
  _prev: EnrollmentActionResult | undefined,
  formData: FormData,
): Promise<EnrollmentActionResult> {
  const parsed = z
    .object({ enrollmentId: z.string().min(1), toClassroomId: z.string().min(1) })
    .safeParse({ enrollmentId: formData.get("enrollmentId"), toClassroomId: formData.get("toClassroomId") });
  if (!parsed.success) return { ok: false, message: "Please choose a class." };
  try {
    const actor = await requireActor();
    await transferStudent(actor, parsed.data.enrollmentId, parsed.data.toClassroomId);
    revalidatePath("/app/students");
    return { ok: true, message: "Student transferred." };
  } catch (e) {
    return fail(e);
  }
}

export async function withdrawStudentAction(enrollmentId: string, reason: string): Promise<EnrollmentActionResult> {
  try {
    const actor = await requireActor();
    await withdrawStudent(actor, enrollmentId, reason);
    revalidatePath("/app/students");
    return { ok: true, message: "Enrollment withdrawn." };
  } catch (e) {
    return fail(e);
  }
}

export async function bulkEnrollAction(
  _prev: EnrollmentActionResult | undefined,
  formData: FormData,
): Promise<EnrollmentActionResult> {
  const classroomId = String(formData.get("classroomId") ?? "");
  const academicYearId = String(formData.get("academicYearId") ?? "");
  const studentIds = formData.getAll("studentIds").map(String).filter(Boolean);
  if (!classroomId || !academicYearId) return { ok: false, message: "Missing class or year." };
  if (studentIds.length === 0) return { ok: false, message: "Select at least one student." };
  try {
    const actor = await requireActor();
    const res = await bulkEnroll(actor, classroomId, studentIds, academicYearId);
    revalidatePath(`/app/classes/${classroomId}`);
    return { ok: true, message: `${res.enrolled} student(s) enrolled.` };
  } catch (e) {
    return fail(e);
  }
}

/** Picker search for enrollable students (no active enrollment in the year). */
export async function searchEnrollableStudentsAction(
  academicYearId: string,
  query: string,
): Promise<{ id: string; fullName: string; studentNumber: string }[]> {
  try {
    const actor = await requireActor();
    return await listEnrollableStudents(actor, academicYearId, query);
  } catch {
    return [];
  }
}
