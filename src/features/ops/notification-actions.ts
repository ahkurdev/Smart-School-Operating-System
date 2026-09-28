"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import { markNotificationRead, markAllRead, purgeNotification } from "@/server/services/notification.service";

export type NotificationResult = { ok: true } | { ok: false; error: string };

function fail(e: unknown): NotificationResult {
  if (isAppError(e)) return { ok: false, error: e.userMessage };
  throw e;
}

export async function markReadAction(id: string): Promise<NotificationResult> {
  try {
    const actor = await requireActor();
    await markNotificationRead(actor, id);
    revalidatePath("/app/notifications");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function markAllReadAction(): Promise<NotificationResult> {
  try {
    const actor = await requireActor();
    await markAllRead(actor);
    revalidatePath("/app/notifications");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function purgeNotificationAction(id: string): Promise<NotificationResult> {
  try {
    const actor = await requireActor();
    await purgeNotification(actor, id);
    revalidatePath("/app/notifications");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
