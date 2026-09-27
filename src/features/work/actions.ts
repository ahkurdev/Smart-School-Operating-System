"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import {
  createAssignment,
  setAssignmentStatus,
  submitAssignment,
  gradeSubmission,
  createMaterial,
  setMaterialStatus,
  deleteMaterial,
} from "@/server/services/assignment.service";
import {
  createAssessment,
  setGrade,
  setGradesBulk,
  submitGrades,
  approveGrades,
  publishGrades,
} from "@/server/services/gradebook.service";

export type WorkResult = { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(e: unknown): WorkResult {
  if (isAppError(e)) return { ok: false, error: e.userMessage };
  throw e;
}

// --- Assignments -------------------------------------------------------------

const assignmentSchema = z.object({
  classroomId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
  title: z.string().trim().min(2, "Title is too short").max(200),
  instructions: z.string().max(20000).optional().or(z.literal("")),
  dueAt: z.string().optional().or(z.literal("")),
  maxScore: z.coerce.number().positive().optional(),
  allowResubmission: z.coerce.boolean().optional(),
});

export async function createAssignmentAction(_prev: WorkResult | null, formData: FormData): Promise<WorkResult> {
  try {
    const actor = await requireActor();
    const parsed = assignmentSchema.safeParse({
      classroomId: formData.get("classroomId"),
      subjectId: formData.get("subjectId"),
      title: formData.get("title"),
      instructions: formData.get("instructions") ?? undefined,
      dueAt: formData.get("dueAt") ?? undefined,
      maxScore: formData.get("maxScore") || undefined,
      allowResubmission: formData.get("allowResubmission") === "on",
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
    }
    const assignment = await createAssignment(actor, {
      classroomId: parsed.data.classroomId,
      subjectId: parsed.data.subjectId,
      title: parsed.data.title,
      instructions: parsed.data.instructions || undefined,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
      maxScore: parsed.data.maxScore,
      allowResubmission: parsed.data.allowResubmission,
    });
    revalidatePath("/app/assignments");
    return { ok: true, id: assignment.id };
  } catch (e) {
    return fail(e);
  }
}

export async function setAssignmentStatusAction(id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED"): Promise<WorkResult> {
  try {
    const actor = await requireActor();
    await setAssignmentStatus(actor, id, status);
    revalidatePath("/app/assignments");
    revalidatePath(`/app/assignments/${id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function submitAssignmentAction(assignmentId: string, content: string, fileId?: string): Promise<WorkResult> {
  try {
    const actor = await requireActor();
    await submitAssignment(actor, assignmentId, { content, fileId });
    revalidatePath("/app/assignments");
    revalidatePath(`/app/assignments/${assignmentId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function gradeSubmissionAction(submissionId: string, score: number, feedback?: string): Promise<WorkResult> {
  try {
    const actor = await requireActor();
    await gradeSubmission(actor, submissionId, { score, feedback });
    revalidatePath("/app/assignments");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// --- Materials ---------------------------------------------------------------

const materialSchema = z.object({
  subjectId: z.string().min(1, "Subject is required"),
  title: z.string().trim().min(2, "Title is too short").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  type: z.enum(["TEXT", "DOCUMENT", "SLIDES", "LINK", "VIDEO"]).optional(),
  url: z.string().url().optional().or(z.literal("")),
  unit: z.string().max(120).optional().or(z.literal("")),
  topic: z.string().max(120).optional().or(z.literal("")),
});

export async function createMaterialAction(_prev: WorkResult | null, formData: FormData): Promise<WorkResult> {
  try {
    const actor = await requireActor();
    const parsed = materialSchema.safeParse({
      subjectId: formData.get("subjectId"),
      title: formData.get("title"),
      description: formData.get("description") ?? undefined,
      type: formData.get("type") ?? undefined,
      url: formData.get("url") ?? undefined,
      unit: formData.get("unit") ?? undefined,
      topic: formData.get("topic") ?? undefined,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
    }
    const material = await createMaterial(actor, {
      subjectId: parsed.data.subjectId,
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      type: parsed.data.type,
      url: parsed.data.url || undefined,
      unit: parsed.data.unit || undefined,
      topic: parsed.data.topic || undefined,
    });
    revalidatePath("/app/materials");
    return { ok: true, id: material.id };
  } catch (e) {
    return fail(e);
  }
}

export async function setMaterialStatusAction(id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED"): Promise<WorkResult> {
  try {
    const actor = await requireActor();
    await setMaterialStatus(actor, id, status);
    revalidatePath("/app/materials");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMaterialAction(id: string): Promise<WorkResult> {
  try {
    const actor = await requireActor();
    await deleteMaterial(actor, id);
    revalidatePath("/app/materials");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// --- Gradebook ---------------------------------------------------------------

const assessmentSchema = z.object({
  academicYearId: z.string().min(1, "Academic year is required"),
  classroomId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
  termId: z.string().optional().or(z.literal("")),
  title: z.string().trim().min(2, "Title is too short").max(200),
  type: z.enum(["ASSIGNMENT", "QUIZ", "EXAM", "PROJECT", "PARTICIPATION", "CUSTOM"]).optional(),
  maxScore: z.coerce.number().positive().optional(),
  weight: z.coerce.number().min(0).optional(),
});

export async function createAssessmentAction(_prev: WorkResult | null, formData: FormData): Promise<WorkResult> {
  try {
    const actor = await requireActor();
    const parsed = assessmentSchema.safeParse({
      academicYearId: formData.get("academicYearId"),
      classroomId: formData.get("classroomId"),
      subjectId: formData.get("subjectId"),
      termId: formData.get("termId") ?? undefined,
      title: formData.get("title"),
      type: formData.get("type") ?? undefined,
      maxScore: formData.get("maxScore") || undefined,
      weight: formData.get("weight") || undefined,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
    }
    const assessment = await createAssessment(actor, {
      academicYearId: parsed.data.academicYearId,
      classroomId: parsed.data.classroomId,
      subjectId: parsed.data.subjectId,
      termId: parsed.data.termId || undefined,
      title: parsed.data.title,
      type: parsed.data.type,
      maxScore: parsed.data.maxScore,
      weight: parsed.data.weight,
    });
    revalidatePath("/app/grades");
    return { ok: true, id: assessment.id };
  } catch (e) {
    return fail(e);
  }
}

export async function saveGradeAction(assessmentId: string, studentId: string, score: number | null): Promise<WorkResult> {
  try {
    const actor = await requireActor();
    await setGrade(actor, { assessmentId, studentId, score });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveGradesBulkAction(assessmentId: string, entries: { studentId: string; score: number | null }[]): Promise<WorkResult> {
  try {
    const actor = await requireActor();
    await setGradesBulk(actor, assessmentId, entries);
    revalidatePath("/app/grades");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function gradeWorkflowAction(assessmentId: string, step: "submit" | "approve" | "publish"): Promise<WorkResult> {
  try {
    const actor = await requireActor();
    if (step === "submit") await submitGrades(actor, assessmentId);
    else if (step === "approve") await approveGrades(actor, assessmentId);
    else await publishGrades(actor, assessmentId);
    revalidatePath("/app/grades");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
