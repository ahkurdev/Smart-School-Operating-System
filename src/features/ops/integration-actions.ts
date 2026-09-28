"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import { createApiKey, revokeApiKey, createWebhook, deleteWebhook, API_SCOPES, WEBHOOK_EVENTS, type ApiScope, type WebhookEvent } from "@/server/services/integration.service";

export type IntegrationResult =
  | { ok: true; id?: string; secret?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(e: unknown): IntegrationResult {
  if (isAppError(e)) return { ok: false, error: e.userMessage };
  throw e;
}
function fieldErrorsFrom(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] = i.message;
  return out;
}

export async function createApiKeyAction(_prev: IntegrationResult | null, formData: FormData): Promise<IntegrationResult> {
  try {
    const actor = await requireActor();
    const scopes = formData.getAll("scopes").map(String) as ApiScope[];
    const schema = z.object({
      name: z.string().trim().min(1, "Name is required").max(120),
      rateLimit: z.coerce.number().int().positive().max(1_000_000).optional(),
    });
    const parsed = schema.safeParse({ name: formData.get("name"), rateLimit: formData.get("rateLimit") || undefined });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    const validScopes = scopes.filter((s) => (API_SCOPES as readonly string[]).includes(s));
    if (validScopes.length === 0) return { ok: false, error: "Choose at least one scope." };
    const key = await createApiKey(actor, { name: parsed.data.name, scopes: validScopes, rateLimit: parsed.data.rateLimit });
    revalidatePath("/app/integrations");
    return { ok: true, id: key.id, secret: key.secret };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeApiKeyAction(id: string): Promise<IntegrationResult> {
  try {
    const actor = await requireActor();
    await revokeApiKey(actor, id);
    revalidatePath("/app/integrations");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createWebhookAction(_prev: IntegrationResult | null, formData: FormData): Promise<IntegrationResult> {
  try {
    const actor = await requireActor();
    const events = formData.getAll("events").map(String) as WebhookEvent[];
    const schema = z.object({ url: z.string().trim().url("Enter a valid URL").refine((u) => u.startsWith("https://"), "The URL must use https") });
    const parsed = schema.safeParse({ url: formData.get("url") });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    const validEvents = events.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
    if (validEvents.length === 0) return { ok: false, error: "Choose at least one event." };
    const hook = await createWebhook(actor, { url: parsed.data.url, events: validEvents });
    revalidatePath("/app/integrations");
    return { ok: true, id: hook.id, secret: hook.secret };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteWebhookAction(id: string): Promise<IntegrationResult> {
  try {
    const actor = await requireActor();
    await deleteWebhook(actor, id);
    revalidatePath("/app/integrations");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
