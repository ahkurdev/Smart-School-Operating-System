import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize, can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Announcements / communication (Phases 67-68).
 *
 * Staff draft and publish announcements to an audience (all, parents, staff,
 * specific classes…). Publishing is separated from drafting so nothing goes out
 * by accident. A published announcement can require acknowledgement, which is
 * recorded per user and surfaced as a read count.
 */

type Audience = "ALL" | "STUDENTS" | "TEACHERS" | "PARENTS" | "STAFF" | "CLASS" | "GRADE" | "CUSTOM";

export async function listAnnouncements(actor: Actor, opts: { includeDrafts?: boolean } = {}) {
  authorize(actor, "announcement.read");
  const tenantId = requireTenantId(actor);
  const canManage = can(actor, "announcement.manage");
  const now = new Date();

  return prisma.announcement.findMany({
    where: {
      tenantId,
      deletedAt: null,
      // Non-managers only see live, published announcements.
      ...(canManage && opts.includeDrafts
        ? {}
        : {
            status: "PUBLISHED" as const,
            AND: [
              { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
              { OR: [{ expireAt: null }, { expireAt: { gt: now } }] },
            ],
          }),
    },
    orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { acknowledgments: true } }, classLinks: { select: { classroomId: true } } },
  });
}

export async function createAnnouncement(
  actor: Actor,
  input: { title: string; body: string; audience?: Audience; priority?: string; requiresAcknowledgment?: boolean; publishAt?: Date; expireAt?: Date; classroomIds?: string[]; attachmentFileId?: string },
) {
  authorize(actor, "announcement.manage");
  const tenantId = requireTenantId(actor);
  if (!input.title.trim()) throw Errors.validation("A title is required.");
  if (!input.body.trim()) throw Errors.validation("Announcement body cannot be empty.");

  const audience: Audience = input.audience ?? "ALL";
  if (audience === "CLASS" && (!input.classroomIds || input.classroomIds.length === 0)) {
    throw Errors.validation("Choose at least one class for a class announcement.");
  }

  const announcement = await prisma.announcement.create({
    data: {
      tenantId,
      title: input.title.trim(),
      body: input.body.trim(),
      audience,
      priority: (input.priority as never) ?? "NORMAL",
      authorUserId: actor.userId,
      requiresAcknowledgment: input.requiresAcknowledgment ?? false,
      publishAt: input.publishAt ?? null,
      expireAt: input.expireAt ?? null,
      attachmentFileId: input.attachmentFileId || null,
      status: "DRAFT",
      ...(audience === "CLASS" && input.classroomIds
        ? { classLinks: { create: input.classroomIds.map((classroomId) => ({ classroomId })) } }
        : {}),
    },
  });
  await recordAudit({ actor, action: "announcement.create", resource: "Announcement", resourceId: announcement.id });
  return announcement;
}

export async function publishAnnouncement(actor: Actor, id: string) {
  authorize(actor, "announcement.manage");
  const tenantId = requireTenantId(actor);
  const existing = await prisma.announcement.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!existing) throw Errors.notFound("Announcement not found.");
  const updated = await prisma.announcement.update({
    where: { id },
    data: { status: "PUBLISHED", publishAt: existing.publishAt ?? new Date() },
  });
  await recordAudit({ actor, action: "announcement.publish", resource: "Announcement", resourceId: id });
  return updated;
}

export async function archiveAnnouncement(actor: Actor, id: string) {
  authorize(actor, "announcement.manage");
  const tenantId = requireTenantId(actor);
  const existing = await prisma.announcement.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!existing) throw Errors.notFound("Announcement not found.");
  const updated = await prisma.announcement.update({ where: { id }, data: { status: "ARCHIVED" } });
  await recordAudit({ actor, action: "announcement.archive", resource: "Announcement", resourceId: id });
  return updated;
}

/** Mark an announcement read/acknowledged by the current user (idempotent). */
export async function acknowledgeAnnouncement(actor: Actor, id: string) {
  authorize(actor, "announcement.read");
  const tenantId = requireTenantId(actor);
  const ann = await prisma.announcement.findFirst({ where: { id, tenantId, status: "PUBLISHED", deletedAt: null }, select: { id: true } });
  if (!ann) throw Errors.notFound("Announcement not found.");
  await prisma.announcementAcknowledgment.upsert({
    where: { announcementId_userId: { announcementId: id, userId: actor.userId } },
    update: {},
    create: { tenantId, announcementId: id, userId: actor.userId },
  });
  return { ok: true };
}

export async function getAnnouncement(actor: Actor, id: string) {
  authorize(actor, "announcement.read");
  const tenantId = requireTenantId(actor);
  const ann = await prisma.announcement.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { _count: { select: { acknowledgments: true } }, classLinks: { include: { classroom: { select: { name: true } } } } },
  });
  if (!ann) throw Errors.notFound("Announcement not found.");
  if (ann.status !== "PUBLISHED" && !can(actor, "announcement.manage")) throw Errors.forbidden("This announcement is not published.");
  const acknowledgedByMe = await prisma.announcementAcknowledgment.findUnique({
    where: { announcementId_userId: { announcementId: id, userId: actor.userId } },
    select: { id: true },
  });
  return { ...ann, acknowledgedByMe: !!acknowledgedByMe };
}
