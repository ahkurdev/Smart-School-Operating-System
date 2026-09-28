"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import { runAssistant, type AiContext, type AssistantReply } from "@/server/ai/assistant.service";

export type AssistantActionResult = { ok: true; reply: AssistantReply } | { ok: false; error: string };

export async function askAssistantAction(_prev: AssistantActionResult | null, formData: FormData): Promise<AssistantActionResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      message: z.string().trim().min(1, "Type a message").max(4000),
      context: z.enum(["admin", "teacher", "student", "parent"]).optional(),
      conversationId: z.string().optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({
      message: formData.get("message"),
      context: formData.get("context") ?? undefined,
      conversationId: formData.get("conversationId") ?? undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    const reply = await runAssistant(actor, {
      context: (parsed.data.context as AiContext) ?? "admin",
      message: parsed.data.message,
      conversationId: parsed.data.conversationId || undefined,
    });
    revalidatePath("/app/assistant");
    return { ok: true, reply };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}
