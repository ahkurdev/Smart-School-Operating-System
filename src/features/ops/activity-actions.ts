"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import {
  createExtracurricular,
  addMember,
  removeMember,
  createAchievement,
  createCounseling,
  updateCounselingStatus,
  createDiscipline,
  updateDisciplineStatus,
} from "@/server/services/activity.service";

export type ActivityResult = { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(e: unknown): ActivityResult {
  if (isAppError(e)) return { ok: false, error: e.userMessage };
  throw e;
}
function fieldErrorsFrom(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] = i.message;
  return out;
}

export async function createExtracurricularAction(_prev: ActivityResult | null, formData: FormData): Promise<ActivityResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      name: z.string().trim().min(1, "Name is required").max(200),
      description: z.string().trim().max(2000).optional().or(z.literal("")),
      schedule: z.string().trim().max(200).optional().or(z.literal("")),
      location: z.string().trim().max(160).optional().or(z.literal("")),
      capacity: z.coerce.number().int().min(0).optional(),
    });
    const parsed = schema.safeParse({
      name: formData.get("name"),
      description: formData.get("description") ?? undefined,
      schedule: formData.get("schedule") ?? undefined,
      location: formData.get("location") ?? undefined,
      capacity: formData.get("capacity") || undefined,
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    const club = await createExtracurricular(actor, {
      name: parsed.data.name,
      description: parsed.data.description || undefined,
      schedule: parsed.data.schedule || undefined,
      location: parsed.data.location || undefined,
      capacity: parsed.data.capacity,
    });
    revalidatePath("/app/extracurricular");
    return { ok: true, id: club.id };
  } catch (e) {
    return fail(e);
  }
}

export async function addMemberAction(_prev: ActivityResult | null, formData: FormData): Promise<ActivityResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      clubId: z.string().min(1),
      studentId: z.string().min(1, "Student is required"),
      role: z.string().trim().max(80).optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({
      clubId: formData.get("clubId"),
      studentId: formData.get("studentId"),
      role: formData.get("role") ?? undefined,
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    await addMember(actor, parsed.data.clubId, { studentId: parsed.data.studentId, role: parsed.data.role || undefined });
    revalidatePath(`/app/extracurricular/${parsed.data.clubId}`);
    revalidatePath("/app/extracurricular");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeMemberAction(memberId: string): Promise<ActivityResult> {
  try {
    const actor = await requireActor();
    await removeMember(actor, memberId);
    revalidatePath("/app/extracurricular");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createAchievementAction(_prev: ActivityResult | null, formData: FormData): Promise<ActivityResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      title: z.string().trim().min(1, "Title is required").max(300),
      studentId: z.string().optional().or(z.literal("")),
      competition: z.string().trim().max(200).optional().or(z.literal("")),
      level: z.enum(["SCHOOL", "DISTRICT", "REGIONAL", "NATIONAL", "INTERNATIONAL"]).optional(),
      rank: z.string().trim().max(60).optional().or(z.literal("")),
      achievedAt: z.string().min(1, "Date is required"),
      publishToCms: z.coerce.boolean().optional(),
    });
    const parsed = schema.safeParse({
      title: formData.get("title"),
      studentId: formData.get("studentId") ?? undefined,
      competition: formData.get("competition") ?? undefined,
      level: formData.get("level") ?? undefined,
      rank: formData.get("rank") ?? undefined,
      achievedAt: formData.get("achievedAt"),
      publishToCms: formData.get("publishToCms") === "on",
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    const a = await createAchievement(actor, {
      title: parsed.data.title,
      studentId: parsed.data.studentId || undefined,
      competition: parsed.data.competition || undefined,
      level: parsed.data.level,
      rank: parsed.data.rank || undefined,
      achievedAt: new Date(parsed.data.achievedAt),
      publishToCms: parsed.data.publishToCms,
    });
    revalidatePath("/app/achievements");
    return { ok: true, id: a.id };
  } catch (e) {
    return fail(e);
  }
}

export async function createCounselingAction(_prev: ActivityResult | null, formData: FormData): Promise<ActivityResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      studentId: z.string().min(1, "Student is required"),
      type: z.enum(["APPOINTMENT", "SESSION", "REFERRAL", "FOLLOW_UP"]).optional(),
      summary: z.string().trim().min(1, "Summary is required").max(4000),
      notes: z.string().trim().max(8000).optional().or(z.literal("")),
      confidentiality: z.enum(["confidential", "shared"]).optional(),
      occurredAt: z.string().optional().or(z.literal("")),
      followUpAt: z.string().optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({
      studentId: formData.get("studentId"),
      type: formData.get("type") ?? undefined,
      summary: formData.get("summary"),
      notes: formData.get("notes") ?? undefined,
      confidentiality: formData.get("confidentiality") ?? undefined,
      occurredAt: formData.get("occurredAt") ?? undefined,
      followUpAt: formData.get("followUpAt") ?? undefined,
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    const rec = await createCounseling(actor, {
      studentId: parsed.data.studentId,
      type: parsed.data.type,
      summary: parsed.data.summary,
      notes: parsed.data.notes || undefined,
      confidentiality: parsed.data.confidentiality,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : undefined,
      followUpAt: parsed.data.followUpAt ? new Date(parsed.data.followUpAt) : undefined,
    });
    revalidatePath("/app/counseling");
    return { ok: true, id: rec.id };
  } catch (e) {
    return fail(e);
  }
}

export async function setCounselingStatusAction(id: string, status: "OPEN" | "IN_PROGRESS" | "CLOSED"): Promise<ActivityResult> {
  try {
    const actor = await requireActor();
    await updateCounselingStatus(actor, id, status);
    revalidatePath("/app/counseling");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createDisciplineAction(_prev: ActivityResult | null, formData: FormData): Promise<ActivityResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      studentId: z.string().min(1, "Student is required"),
      category: z.string().trim().min(1, "Category is required").max(120),
      description: z.string().trim().min(1, "Description is required").max(4000),
      severity: z.enum(["MINOR", "MODERATE", "MAJOR", "CRITICAL"]).optional(),
      action: z.string().trim().max(2000).optional().or(z.literal("")),
      occurredAt: z.string().min(1, "Date is required"),
      followUpAt: z.string().optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({
      studentId: formData.get("studentId"),
      category: formData.get("category"),
      description: formData.get("description"),
      severity: formData.get("severity") ?? undefined,
      action: formData.get("action") ?? undefined,
      occurredAt: formData.get("occurredAt"),
      followUpAt: formData.get("followUpAt") ?? undefined,
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    const rec = await createDiscipline(actor, {
      studentId: parsed.data.studentId,
      category: parsed.data.category,
      description: parsed.data.description,
      severity: parsed.data.severity,
      action: parsed.data.action || undefined,
      occurredAt: new Date(parsed.data.occurredAt),
      followUpAt: parsed.data.followUpAt ? new Date(parsed.data.followUpAt) : undefined,
    });
    revalidatePath("/app/discipline");
    return { ok: true, id: rec.id };
  } catch (e) {
    return fail(e);
  }
}

export async function setDisciplineStatusAction(id: string, status: "OPEN" | "RESOLVED" | "APPEALED" | "CLOSED"): Promise<ActivityResult> {
  try {
    const actor = await requireActor();
    await updateDisciplineStatus(actor, id, status);
    revalidatePath("/app/discipline");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
