import { prisma } from "@/server/db/client";
import { registerJob } from "@/server/jobs/queue";
import { signWebhookBody } from "@/server/services/integration.service";

/**
 * Job handler registration (Phase 91). Imported once at server start (see
 * `src/server/jobs/index.ts`). Handlers are pure functions of a JSON payload so
 * a future worker process can reuse them unchanged.
 */

let registered = false;

export function registerAllJobs(): void {
  if (registered) return;
  registered = true;

  // Deliver a webhook: sign the body, POST it, record the outcome. Retries are
  // handled by the queue (attempts/maxAttempts); this handler throws on a
  // non-2xx so the queue can schedule a retry.
  registerJob("webhook.deliver", async (payload) => {
    const deliveryId = String(payload.deliveryId ?? "");
    const url = String(payload.url ?? "");
    const secret = await webhookSecret(String(payload.webhookId ?? ""));
    const body = JSON.stringify(payload.body ?? {});
    const signature = signWebhookBody(secret, body);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-school-signature": `sha256=${signature}` },
        body,
        signal: controller.signal,
      });
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: res.ok ? "SUCCESS" : res.status >= 500 ? "RETRYING" : "FAILED", responseCode: res.status, attempts: { increment: 1 } },
      });
      if (!res.ok && res.status >= 500) throw new Error(`Webhook endpoint returned ${res.status}`);
    } catch (e) {
      await prisma.webhookDelivery
        .update({ where: { id: deliveryId }, data: { status: "RETRYING", attempts: { increment: 1 }, lastError: e instanceof Error ? e.message.slice(0, 300) : "error" } })
        .catch(() => {});
      throw e;
    } finally {
      clearTimeout(timer);
    }
  });

  // Deliver a notification on an external channel. In dev the console provider
  // just logs; a real provider adapter would send here. Marks the row SENT/FAILED.
  registerJob("notification.deliver", async (payload) => {
    const id = String(payload.notificationId ?? "");
    const row = await prisma.notification.findUnique({ where: { id }, select: { id: true, channel: true, title: true } });
    if (!row) return { ok: false };
    try {
      const { sendExternalNotification } = await import("@/server/services/notification-provider");
      await sendExternalNotification(row.channel, { title: row.title });
      await prisma.notification.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
    } catch (e) {
      await prisma.notification.update({ where: { id }, data: { status: "FAILED" } }).catch(() => {});
      throw e;
    }
  });

  // A no-op example handler proving the queue surface (used by tests).
  registerJob("noop", async () => ({ ok: true }));
}

async function webhookSecret(webhookId: string): Promise<string> {
  const hook = await prisma.webhook.findUnique({ where: { id: webhookId }, select: { secret: true } });
  return hook?.secret ?? "";
}
