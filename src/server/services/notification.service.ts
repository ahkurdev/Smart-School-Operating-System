import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import { enqueue } from "@/server/jobs/queue";
import type { Actor } from "@/types/actor";

/**
 * Notification center (Phase 48 / 67).
 *
 * A notification is a per-user in-app message (optionally also queued for an
 * external channel via the job queue). Delivery to other channels goes through a
 * provider abstraction rather than a hard-coded vendor.
 */

export type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  channel?: "IN_APP" | "EMAIL" | "PUSH" | "SMS" | "WHATSAPP";
  metadata?: Record<string, unknown>;
};

/** Create a notification for a single user. Tenant is taken from the actor. */
export async function notify(actor: Actor, input: NotifyInput) {
  const tenantId = requireTenantId(actor);
  const notification = await prisma.notification.create({
    data: {
      tenantId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      channel: input.channel ?? "IN_APP",
      status: input.channel && input.channel !== "IN_APP" ? "PENDING" : "SENT",
      sentAt: new Date(),
      metadata: (input.metadata as object) ?? {},
    },
    select: { id: true },
  });

  // External channels are delivered asynchronously so the caller is never blocked.
  if (input.channel && input.channel !== "IN_APP") {
    await enqueue({ name: "notification.deliver", tenantId, payload: { notificationId: notification.id } }).catch(() => {});
  }
  return notification;
}

/** Fan out an announcement to every active user in a tenant (in-app). */
export async function notifyTenant(actor: Actor, input: Omit<NotifyInput, "userId">) {
  const tenantId = requireTenantId(actor);
  const users = await prisma.membership.findMany({ where: { tenantId, status: "ACTIVE" }, select: { userId: true } });
  if (users.length === 0) return { created: 0 };
  await prisma.notification.createMany({
    data: users.map((u) => ({
      tenantId,
      userId: u.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      channel: "IN_APP" as const,
      status: "SENT" as const,
      sentAt: new Date(),
      metadata: (input.metadata as object) ?? {},
    })),
  });
  return { created: users.length };
}

/** The current user's notifications, newest first. */
export async function listMyNotifications(actor: Actor, opts: { unreadOnly?: boolean; limit?: number } = {}) {
  const tenantId = requireTenantId(actor);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
  return prisma.notification.findMany({
    where: { tenantId, userId: actor.userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
  });
}

export async function unreadCount(actor: Actor): Promise<number> {
  const tenantId = requireTenantId(actor);
  return prisma.notification.count({ where: { tenantId, userId: actor.userId, readAt: null } });
}

/** Mark one of the actor's own notifications read. */
export async function markNotificationRead(actor: Actor, id: string) {
  const tenantId = requireTenantId(actor);
  const existing = await prisma.notification.findFirst({ where: { id, tenantId, userId: actor.userId }, select: { id: true } });
  if (!existing) throw Errors.notFound("That notification was not found.");
  await prisma.notification.update({ where: { id }, data: { readAt: new Date(), status: "READ" } });
  return { ok: true } as const;
}

export async function markAllRead(actor: Actor) {
  const tenantId = requireTenantId(actor);
  const res = await prisma.notification.updateMany({
    where: { tenantId, userId: actor.userId, readAt: null },
    data: { readAt: new Date(), status: "READ" },
  });
  return { updated: res.count };
}

/** Admin view of notification templates/dispatch is a manager concern. */
export async function listRecentNotifications(actor: Actor, limit = 50) {
  authorize(actor, "notification.manage");
  const tenantId = requireTenantId(actor);
  return prisma.notification.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, limit)),
    select: { id: true, type: true, title: true, channel: true, status: true, userId: true, createdAt: true },
  });
}

export async function purgeNotification(actor: Actor, id: string) {
  const tenantId = requireTenantId(actor);
  const existing = await prisma.notification.findFirst({ where: { id, tenantId, userId: actor.userId }, select: { id: true } });
  if (!existing) throw Errors.notFound("That notification was not found.");
  await prisma.notification.delete({ where: { id } });
  await recordAudit({ actor, action: "notification.delete", resource: "Notification", resourceId: id });
  return { ok: true } as const;
}
