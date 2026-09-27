"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import {
  createAcademicYear,
  setCurrentAcademicYear,
  addTerm,
  createGradeLevel,
  createDepartment,
  createSubject,
  updateSubject,
  createClass,
  updateClass,
} from "@/server/services/academic.service";

export type AcademicActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function fail(e: unknown): AcademicActionResult {
  if (isAppError(e)) return { ok: false, message: e.userMessage, fieldErrors: e.details };
  console.error("academic action failed", e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

const dateStr = z.string().min(1, "Required");

export async function createAcademicYearAction(
  _prev: AcademicActionResult | undefined,
  formData: FormData,
): Promise<AcademicActionResult> {
  const termNames = formData.getAll("termNames").map(String).filter(Boolean);
  const parsed = z
    .object({
      name: z.string().min(2, "Enter a year name (e.g. 2026/2027)."),
      startDate: dateStr,
      endDate: dateStr,
      termCount: z.coerce.number().int().min(0).max(4).optional(),
    })
    .safeParse({
      name: formData.get("name"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      termCount: formData.get("termCount") ?? 0,
    });
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const actor = await requireActor();
    const start = new Date(parsed.data.startDate);
    const end = new Date(parsed.data.endDate);
    const count = parsed.data.termCount ?? 0;
    const terms =
      count > 0
        ? Array.from({ length: count }, (_, i) => {
            const span = (end.getTime() - start.getTime()) / count;
            return {
              name: termNames[i] || `Term ${i + 1}`,
              type: "SEMESTER" as const,
              startDate: new Date(start.getTime() + span * i),
              endDate: new Date(start.getTime() + span * (i + 1)),
            };
          })
        : undefined;
    const year = await createAcademicYear(actor, {
      name: parsed.data.name,
      startDate: start,
      endDate: end,
      terms,
    });
    revalidatePath("/app/academic-years");
    return { ok: true, message: "Academic year created.", id: year.id };
  } catch (e) {
    return fail(e);
  }
}

export async function setCurrentYearAction(yearId: string): Promise<AcademicActionResult> {
  try {
    const actor = await requireActor();
    await setCurrentAcademicYear(actor, yearId);
    revalidatePath("/app/academic-years");
    return { ok: true, message: "Set as current year." };
  } catch (e) {
    return fail(e);
  }
}

export async function addTermAction(
  _prev: AcademicActionResult | undefined,
  formData: FormData,
): Promise<AcademicActionResult> {
  const parsed = z
    .object({
      academicYearId: z.string().min(1),
      name: z.string().min(1, "Enter a term name."),
      type: z.enum(["SEMESTER", "TRIMESTER", "QUARTER", "TERM", "CUSTOM"]),
      startDate: dateStr,
      endDate: dateStr,
    })
    .safeParse({
      academicYearId: formData.get("academicYearId"),
      name: formData.get("name"),
      type: formData.get("type") ?? "SEMESTER",
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
    });
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const actor = await requireActor();
    await addTerm(actor, {
      academicYearId: parsed.data.academicYearId,
      name: parsed.data.name,
      type: parsed.data.type,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
    });
    revalidatePath("/app/academic-years");
    return { ok: true, message: "Term added." };
  } catch (e) {
    return fail(e);
  }
}

export async function createGradeLevelAction(
  _prev: AcademicActionResult | undefined,
  formData: FormData,
): Promise<AcademicActionResult> {
  const parsed = z
    .object({
      name: z.string().min(1, "Enter a name."),
      code: z.string().min(1, "Enter a code."),
      sequence: z.coerce.number().int().min(0),
      stage: z.string().optional(),
    })
    .safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
      sequence: formData.get("sequence") ?? 0,
      stage: formData.get("stage") ?? "",
    });
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const actor = await requireActor();
    await createGradeLevel(actor, parsed.data);
    revalidatePath("/app/classes");
    return { ok: true, message: "Grade level added." };
  } catch (e) {
    return fail(e);
  }
}

export async function createDepartmentAction(
  _prev: AcademicActionResult | undefined,
  formData: FormData,
): Promise<AcademicActionResult> {
  const parsed = z
    .object({ name: z.string().min(1), code: z.string().min(1), description: z.string().optional() })
    .safeParse({ name: formData.get("name"), code: formData.get("code"), description: formData.get("description") ?? "" });
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const actor = await requireActor();
    await createDepartment(actor, parsed.data);
    revalidatePath("/app/subjects");
    return { ok: true, message: "Department added." };
  } catch (e) {
    return fail(e);
  }
}

export async function createSubjectAction(
  _prev: AcademicActionResult | undefined,
  formData: FormData,
): Promise<AcademicActionResult> {
  const parsed = z
    .object({
      code: z.string().min(1, "Enter a subject code."),
      name: z.string().min(1, "Enter a subject name."),
      credits: z.coerce.number().int().min(0).default(1),
      departmentId: z.string().optional(),
      description: z.string().optional(),
      learningObjectives: z.string().optional(),
    })
    .safeParse({
      code: formData.get("code"),
      name: formData.get("name"),
      credits: formData.get("credits") ?? 1,
      departmentId: formData.get("departmentId") ?? "",
      description: formData.get("description") ?? "",
      learningObjectives: formData.get("learningObjectives") ?? "",
    });
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const actor = await requireActor();
    await createSubject(actor, parsed.data);
    revalidatePath("/app/subjects");
    return { ok: true, message: "Subject added." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateSubjectAction(
  _prev: AcademicActionResult | undefined,
  formData: FormData,
): Promise<AcademicActionResult> {
  const subjectId = String(formData.get("subjectId") ?? "");
  if (!subjectId) return { ok: false, message: "Missing subject." };
  const parsed = z
    .object({
      code: z.string().min(1),
      name: z.string().min(1),
      credits: z.coerce.number().int().min(0).default(1),
      departmentId: z.string().optional(),
      description: z.string().optional(),
      learningObjectives: z.string().optional(),
      isActive: z.coerce.boolean().optional(),
    })
    .safeParse({
      code: formData.get("code"),
      name: formData.get("name"),
      credits: formData.get("credits") ?? 1,
      departmentId: formData.get("departmentId") ?? "",
      description: formData.get("description") ?? "",
      learningObjectives: formData.get("learningObjectives") ?? "",
      isActive: formData.get("isActive") === "on",
    });
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const actor = await requireActor();
    await updateSubject(actor, subjectId, parsed.data);
    revalidatePath("/app/subjects");
    return { ok: true, message: "Subject updated." };
  } catch (e) {
    return fail(e);
  }
}

export async function createClassAction(
  _prev: AcademicActionResult | undefined,
  formData: FormData,
): Promise<AcademicActionResult> {
  const parsed = z
    .object({
      name: z.string().min(1, "Enter a class name."),
      code: z.string().min(1, "Enter a class code."),
      academicYearId: z.string().optional(),
      gradeLevelId: z.string().optional(),
      campusId: z.string().optional(),
      stream: z.string().optional(),
      capacity: z.coerce.number().int().min(1).default(30),
      homeroomTeacherId: z.string().optional(),
    })
    .safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
      academicYearId: formData.get("academicYearId") ?? "",
      gradeLevelId: formData.get("gradeLevelId") ?? "",
      campusId: formData.get("campusId") ?? "",
      stream: formData.get("stream") ?? "",
      capacity: formData.get("capacity") ?? 30,
      homeroomTeacherId: formData.get("homeroomTeacherId") ?? "",
    });
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const actor = await requireActor();
    const k = await createClass(actor, parsed.data);
    revalidatePath("/app/classes");
    return { ok: true, message: "Class created.", id: k.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateClassAction(
  _prev: AcademicActionResult | undefined,
  formData: FormData,
): Promise<AcademicActionResult> {
  const classId = String(formData.get("classId") ?? "");
  if (!classId) return { ok: false, message: "Missing class." };
  const parsed = z
    .object({
      name: z.string().min(1),
      code: z.string().min(1),
      academicYearId: z.string().optional(),
      gradeLevelId: z.string().optional(),
      campusId: z.string().optional(),
      stream: z.string().optional(),
      capacity: z.coerce.number().int().min(1).default(30),
      homeroomTeacherId: z.string().optional(),
    })
    .safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
      academicYearId: formData.get("academicYearId") ?? "",
      gradeLevelId: formData.get("gradeLevelId") ?? "",
      campusId: formData.get("campusId") ?? "",
      stream: formData.get("stream") ?? "",
      capacity: formData.get("capacity") ?? 30,
      homeroomTeacherId: formData.get("homeroomTeacherId") ?? "",
    });
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const actor = await requireActor();
    await updateClass(actor, classId, parsed.data);
    revalidatePath("/app/classes");
    revalidatePath(`/app/classes/${classId}`);
    return { ok: true, message: "Class updated." };
  } catch (e) {
    return fail(e);
  }
}
