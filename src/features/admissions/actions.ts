"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import {
  createPeriod,
  setPeriodStatus,
  createTrack,
  replaceFormFields,
  upsertApplicant,
  startApplication,
  saveApplicationValues,
  submitApplication,
  attachDocument,
  verifyDocument,
  setApplicationStatus,
  scoreApplication,
  rankPeriod,
  decide,
  convertToStudent,
  type FieldInput,
} from "@/server/services/admission.service";

export type AdmissionResult = { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(e: unknown): AdmissionResult {
  if (isAppError(e)) return { ok: false, error: e.userMessage };
  throw e;
}

// --- Periods -----------------------------------------------------------------

const periodSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(160),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  openAt: z.string().min(1, "Opening date is required"),
  closeAt: z.string().min(1, "Closing date is required"),
  quota: z.coerce.number().int().positive().optional(),
});

export async function createPeriodAction(_prev: AdmissionResult | null, formData: FormData): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    const parsed = periodSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description") ?? undefined,
      openAt: formData.get("openAt"),
      closeAt: formData.get("closeAt"),
      quota: formData.get("quota") || undefined,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
    }
    const period = await createPeriod(actor, {
      name: parsed.data.name,
      description: parsed.data.description || undefined,
      openAt: new Date(parsed.data.openAt),
      closeAt: new Date(parsed.data.closeAt),
      quota: parsed.data.quota,
    });
    revalidatePath("/app/admissions/periods");
    return { ok: true, id: period.id };
  } catch (e) {
    return fail(e);
  }
}

export async function setPeriodStatusAction(id: string, status: "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED"): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    await setPeriodStatus(actor, id, status);
    revalidatePath(`/app/admissions/periods/${id}`);
    revalidatePath("/app/admissions/periods");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createTrackAction(periodId: string, input: { name: string; code: string; quota?: number; requiresTest?: boolean; requiresInterview?: boolean }): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    const track = await createTrack(actor, periodId, input);
    revalidatePath(`/app/admissions/periods/${periodId}`);
    return { ok: true, id: track.id };
  } catch (e) {
    return fail(e);
  }
}

export async function saveFormAction(periodId: string, fields: FieldInput[]): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    await replaceFormFields(actor, periodId, fields);
    revalidatePath(`/app/admissions/periods/${periodId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// --- Applicant portal --------------------------------------------------------

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(160),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  gender: z.string().trim().max(30).optional().or(z.literal("")),
  previousSchool: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function saveProfileAction(_prev: AdmissionResult | null, formData: FormData): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    const parsed = profileSchema.safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email") ?? undefined,
      phone: formData.get("phone") ?? undefined,
      birthDate: formData.get("birthDate") ?? undefined,
      gender: formData.get("gender") ?? undefined,
      previousSchool: formData.get("previousSchool") ?? undefined,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
    }
    await upsertApplicant(actor, {
      fullName: parsed.data.fullName,
      email: parsed.data.email || undefined,
      phone: parsed.data.phone || undefined,
      birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : undefined,
      gender: parsed.data.gender || undefined,
      previousSchool: parsed.data.previousSchool || undefined,
    });
    revalidatePath("/apply");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function startApplicationAction(periodId: string, trackId?: string): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    const app = await startApplication(actor, periodId, trackId);
    revalidatePath("/apply");
    return { ok: true, id: app.id };
  } catch (e) {
    return fail(e);
  }
}

export async function saveApplicationAction(applicationId: string, values: { fieldId: string; value: unknown }[]): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    const parsed = z.array(z.object({ fieldId: z.string(), value: z.unknown() })).max(200).safeParse(values);
    if (!parsed.success) return { ok: false, error: "Invalid values." };
    await saveApplicationValues(actor, applicationId, parsed.data as { fieldId: string; value: unknown }[]);
    revalidatePath(`/apply/${applicationId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function submitApplicationAction(applicationId: string): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    await submitApplication(actor, applicationId);
    revalidatePath(`/apply/${applicationId}`);
    revalidatePath("/apply");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function attachDocumentAction(applicationId: string, fileId: string, documentType: string): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    const doc = await attachDocument(actor, applicationId, fileId, documentType);
    revalidatePath(`/apply/${applicationId}`);
    return { ok: true, id: doc.id };
  } catch (e) {
    return fail(e);
  }
}

// --- Staff review ------------------------------------------------------------

export async function verifyDocumentAction(documentId: string, verified: boolean, notes?: string): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    await verifyDocument(actor, documentId, verified, notes);
    revalidatePath("/app/admissions/verification");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setApplicationStatusAction(id: string, status: string): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    await setApplicationStatus(actor, id, status);
    revalidatePath(`/app/admissions/${id}`);
    revalidatePath("/app/admissions");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function scoreApplicationAction(id: string, score: number): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    await scoreApplication(actor, id, score);
    revalidatePath(`/app/admissions/${id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function rankPeriodAction(periodId: string): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    await rankPeriod(actor, periodId);
    revalidatePath(`/app/admissions/periods/${periodId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function decideAction(id: string, decision: "ACCEPTED" | "WAITLISTED" | "REJECTED", notes?: string): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    await decide(actor, id, decision, notes);
    revalidatePath(`/app/admissions/${id}`);
    revalidatePath("/app/admissions");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function convertAction(id: string, studentNumber: string, classroomId?: string): Promise<AdmissionResult> {
  try {
    const actor = await requireActor();
    const student = await convertToStudent(actor, id, { studentNumber, classroomId });
    revalidatePath(`/app/admissions/${id}`);
    revalidatePath("/app/admissions");
    return { ok: true, id: student.id };
  } catch (e) {
    return fail(e);
  }
}
