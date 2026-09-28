"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import { requireTenantId } from "@/server/db/tenant";
import { updateTenant } from "@/server/services/tenant.service";
import { upsertRetentionPolicy, applyRetention, type RetentionAction } from "@/server/services/retention.service";

export type SettingsResult = { ok: true; summary?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(e: unknown): SettingsResult {
  if (isAppError(e)) return { ok: false, error: e.userMessage };
  throw e;
}
function fieldErrorsFrom(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] = i.message;
  return out;
}

const FEATURE_KEYS = ["library", "finance", "ai", "counseling", "discipline", "admissions"];

export async function updateSchoolProfileAction(_prev: SettingsResult | null, formData: FormData): Promise<SettingsResult> {
  try {
    const actor = await requireActor();
    const tenantId = requireTenantId(actor);
    const schema = z.object({
      name: z.string().trim().min(2, "Name is too short").max(200),
      timezone: z.string().trim().min(1).max(64),
      locale: z.string().trim().min(2).max(16),
      currency: z.string().trim().min(1).max(8),
      gradeLabel: z.string().trim().max(40).optional().or(z.literal("")),
      classLabel: z.string().trim().max(40).optional().or(z.literal("")),
      studentIdLabel: z.string().trim().max(40).optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({
      name: formData.get("name"),
      timezone: formData.get("timezone"),
      locale: formData.get("locale"),
      currency: formData.get("currency"),
      gradeLabel: formData.get("gradeLabel") ?? undefined,
      classLabel: formData.get("classLabel") ?? undefined,
      studentIdLabel: formData.get("studentIdLabel") ?? undefined,
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };

    const featureFlags: Record<string, boolean> = {};
    for (const key of FEATURE_KEYS) featureFlags[key] = formData.get(`flag_${key}`) === "on";

    await updateTenant(actor, tenantId, {
      name: parsed.data.name,
      timezone: parsed.data.timezone,
      locale: parsed.data.locale,
      currency: parsed.data.currency,
      gradeLabel: parsed.data.gradeLabel || undefined,
      classLabel: parsed.data.classLabel || undefined,
      studentIdLabel: parsed.data.studentIdLabel || undefined,
      featureFlags,
    });
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function upsertRetentionPolicyAction(_prev: SettingsResult | null, formData: FormData): Promise<SettingsResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      entity: z.string().min(1),
      retentionDays: z.coerce.number().int().min(1).max(3650),
      action: z.enum(["delete", "anonymize", "archive"]),
    });
    const parsed = schema.safeParse({
      entity: formData.get("entity"),
      retentionDays: formData.get("retentionDays"),
      action: formData.get("action"),
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    await upsertRetentionPolicy(actor, { entity: parsed.data.entity, retentionDays: parsed.data.retentionDays, action: parsed.data.action as RetentionAction });
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function applyRetentionAction(): Promise<SettingsResult> {
  try {
    const actor = await requireActor();
    const results = await applyRetention(actor);
    revalidatePath("/app/settings");
    const total = results.reduce((sum, r) => sum + Math.max(0, r.affected), 0);
    return { ok: true, summary: `Applied ${results.length} policies, affecting ${total} records.` };
  } catch (e) {
    return fail(e);
  }
}
