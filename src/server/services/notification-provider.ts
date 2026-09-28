import { getEnv } from "@/lib/env";

/**
 * External notification delivery (Phase 48/67).
 *
 * Provider-agnostic: in development the `console` provider logs; production can
 * plug an email/SMS/push adapter here without touching the notification service.
 * Kept deliberately small — the abstraction boundary is the point, not a vendor.
 */

export type NotificationChannel = "IN_APP" | "EMAIL" | "PUSH" | "SMS" | "WHATSAPP";

export type ExternalMessage = { title: string; body?: string; to?: string };

export interface NotificationProvider {
  readonly name: string;
  send(channel: NotificationChannel, message: ExternalMessage): Promise<void>;
}

class ConsoleNotificationProvider implements NotificationProvider {
  readonly name = "console";
  async send(channel: NotificationChannel, message: ExternalMessage): Promise<void> {
    // Structured, secret-free log line. No payloads or PII dumped.
    console.info(`[notify:${channel}] ${message.title}`);
  }
}

let cached: NotificationProvider | null = null;

export function getNotificationProvider(): NotificationProvider {
  if (cached) return cached;
  // Future: read NOTIFICATION_PROVIDER and return an SMTP/SMS/push adapter.
  void getEnv();
  cached = new ConsoleNotificationProvider();
  return cached;
}

export async function sendExternalNotification(channel: NotificationChannel, message: ExternalMessage): Promise<void> {
  await getNotificationProvider().send(channel, message);
}
