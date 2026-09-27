import { prisma } from "@/server/db/client";
import { Prisma } from "@prisma/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * CMS service (Phases 24-30).
 *
 * Content is tenant-scoped and built from a bounded set of block types (see
 * `CmsBlockType`). Blocks store structured `data` only — never raw HTML the
 * tenant did not author — so a page cannot become a script-injection vector.
 * Pages move through DRAFT -> SCHEDULED -> PUBLISHED -> ARCHIVED; only the
 * PUBLISHED rows (or SCHEDULED whose time has come) are ever public.
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type BlockType =
  | "HEADING"
  | "PARAGRAPH"
  | "RICH_TEXT"
  | "IMAGE"
  | "GALLERY"
  | "VIDEO"
  | "BUTTON"
  | "CTA"
  | "STATISTICS"
  | "STAFF_LISTING"
  | "ANNOUNCEMENT_LIST"
  | "EVENT_LIST"
  | "FAQ"
  | "TABLE"
  | "EMBED"
  | "DOWNLOAD"
  | "MAP"
  | "CUSTOM_HTML";

/** Per-block shape validation. Keeps writers honest without a schema engine. */
export function validateBlock(type: BlockType, data: unknown): Record<string, unknown> {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw Errors.validation("Block data must be an object.");
  }
  const d = data as Record<string, unknown>;
  const str = (k: string, required = true): string | undefined => {
    const v = d[k];
    if (v === undefined || v === null || v === "") {
      if (required) throw Errors.validation(`Block ${type} requires "${k}".`);
      return undefined;
    }
    if (typeof v !== "string") throw Errors.validation(`Block ${type}.${k} must be a string.`);
    return v;
  };
  switch (type) {
    case "HEADING":
      str("text");
      if (d.level !== undefined && ![1, 2, 3, 4].includes(d.level as number))
        throw Errors.validation("HEADING level must be 1-4.");
      break;
    case "PARAGRAPH":
      str("text");
      break;
    case "RICH_TEXT":
      str("html");
      break;
    case "IMAGE":
      str("fileId");
      str("alt", false);
      break;
    case "GALLERY":
      if (!Array.isArray(d.fileIds) || d.fileIds.length === 0)
        throw Errors.validation("GALLERY requires a non-empty fileIds array.");
      break;
    case "VIDEO":
      str("url");
      break;
    case "BUTTON":
      str("label");
      str("href");
      break;
    case "CTA":
      str("title");
      str("href");
      str("body", false);
      break;
    case "STATISTICS":
      if (!Array.isArray(d.items)) throw Errors.validation("STATISTICS requires items[].");
      break;
    case "FAQ":
      if (!Array.isArray(d.items)) throw Errors.validation("FAQ requires items[].");
      break;
    case "TABLE":
      if (!Array.isArray(d.rows)) throw Errors.validation("TABLE requires rows[].");
      break;
    case "DOWNLOAD":
      str("fileId");
      str("label");
      break;
    case "MAP":
      if (typeof d.lat !== "number" || typeof d.lng !== "number")
        throw Errors.validation("MAP requires numeric lat and lng.");
      break;
    case "EMBED":
    case "CUSTOM_HTML":
      // Allowed but sandboxed at render time; kept for advanced tenants.
      str("html");
      break;
    case "STAFF_LISTING":
    case "ANNOUNCEMENT_LIST":
    case "EVENT_LIST":
      // These hydrate from live data at render time; data may hold a limit.
      break;
    default:
      break;
  }
  return d;
}

export function normalizeSlug(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!SLUG_RE.test(slug)) throw Errors.validation("Slug must contain letters, numbers and dashes.");
  return slug;
}

export async function listPages(actor: Actor, opts: { status?: string; search?: string } = {}) {
  authorize(actor, "cms.read");
  const tenantId = requireTenantId(actor);
  const where: Record<string, unknown> = { tenantId, deletedAt: null };
  if (opts.status) where.status = opts.status;
  if (opts.search) where.title = { contains: opts.search, mode: "insensitive" };
  return prisma.cmsPage.findMany({
    where,
    orderBy: [{ isHomepage: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      isHomepage: true,
      publishedAt: true,
      updatedAt: true,
      _count: { select: { blocks: true } },
    },
  });
}

export async function getPage(actor: Actor, id: string) {
  authorize(actor, "cms.read");
  const tenantId = requireTenantId(actor);
  const page = await prisma.cmsPage.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { blocks: { orderBy: { sequence: "asc" } } },
  });
  if (!page) throw Errors.notFound("Page not found.");
  return page;
}

export async function createPage(
  actor: Actor,
  input: { title: string; slug: string; description?: string; isHomepage?: boolean },
) {
  authorize(actor, "cms.create");
  const tenantId = requireTenantId(actor);
  const slug = normalizeSlug(input.slug);
  const clash = await prisma.cmsPage.findFirst({ where: { tenantId, slug } });
  if (clash) throw Errors.conflict("A page with this slug already exists.");

  const page = await prisma.cmsPage.create({
    data: {
      tenantId,
      slug,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      isHomepage: input.isHomepage ?? false,
    },
  });
  if (input.isHomepage) await demoteOtherHomepages(tenantId, page.id);
  await recordAudit({ actor, action: "cms.page.create", resource: "CmsPage", resourceId: page.id });
  return page;
}

export async function updatePage(
  actor: Actor,
  id: string,
  input: { title?: string; slug?: string; description?: string; isHomepage?: boolean },
) {
  authorize(actor, "cms.update");
  const tenantId = requireTenantId(actor);
  const existing = await prisma.cmsPage.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!existing) throw Errors.notFound("Page not found.");

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.slug !== undefined) {
    const slug = normalizeSlug(input.slug);
    const clash = await prisma.cmsPage.findFirst({ where: { tenantId, slug, id: { not: id } } });
    if (clash) throw Errors.conflict("A page with this slug already exists.");
    data.slug = slug;
  }
  if (input.isHomepage !== undefined) data.isHomepage = input.isHomepage;

  const page = await prisma.cmsPage.update({ where: { id }, data });
  if (input.isHomepage) await demoteOtherHomepages(tenantId, page.id);
  await recordAudit({ actor, action: "cms.page.update", resource: "CmsPage", resourceId: id });
  return page;
}

async function demoteOtherHomepages(tenantId: string, keepId: string) {
  await prisma.cmsPage.updateMany({
    where: { tenantId, isHomepage: true, id: { not: keepId } },
    data: { isHomepage: false },
  });
}

export async function setPageStatus(
  actor: Actor,
  id: string,
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED",
  scheduledAt?: Date,
) {
  const tenantId = requireTenantId(actor);
  if (status === "PUBLISHED" || status === "SCHEDULED") authorize(actor, "cms.publish");
  else authorize(actor, "cms.update");

  const page = await prisma.cmsPage.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!page) throw Errors.notFound("Page not found.");

  const updated = await prisma.cmsPage.update({
    where: { id },
    data: {
      status,
      // `publishedAt` doubles as the schedule time: future for SCHEDULED, past
      // (set once) for PUBLISHED. Keeps the public query a single comparison.
      publishedAt:
        status === "PUBLISHED"
          ? (page.publishedAt && page.publishedAt <= new Date() ? page.publishedAt : new Date())
          : status === "SCHEDULED"
            ? (scheduledAt ?? null)
            : page.publishedAt,
    },
  });
  await recordAudit({ actor, action: `cms.page.${status.toLowerCase()}`, resource: "CmsPage", resourceId: id });
  return updated;
}

export async function deletePage(actor: Actor, id: string) {
  authorize(actor, "cms.delete");
  const tenantId = requireTenantId(actor);
  const page = await prisma.cmsPage.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!page) throw Errors.notFound("Page not found.");
  if (page.isHomepage) throw Errors.conflict("Cannot delete the homepage. Set another page as home first.");
  await prisma.cmsPage.update({ where: { id }, data: { deletedAt: new Date() } });
  await recordAudit({ actor, action: "cms.page.delete", resource: "CmsPage", resourceId: id });
}

/** Replace all blocks of a page atomically (the editor saves the whole tree). */
export async function replaceBlocks(
  actor: Actor,
  pageId: string,
  blocks: { type: BlockType; data: unknown }[],
) {
  authorize(actor, "cms.update");
  const tenantId = requireTenantId(actor);
  const page = await prisma.cmsPage.findFirst({ where: { id: pageId, tenantId, deletedAt: null } });
  if (!page) throw Errors.notFound("Page not found.");

  const validated = blocks.map((b, i) => ({
    tenantId,
    pageId,
    type: b.type,
    sequence: i,
    data: validateBlock(b.type, b.data) as Prisma.InputJsonValue,
  }));

  await prisma.$transaction([
    prisma.cmsBlock.deleteMany({ where: { tenantId, pageId } }),
    ...(validated.length ? [prisma.cmsBlock.createMany({ data: validated })] : []),
  ]);
  await recordAudit({ actor, action: "cms.blocks.replace", resource: "CmsPage", resourceId: pageId });
  return { count: validated.length };
}

// ---------------------------------------------------------------------------
// Posts (news / articles) — Phases 27, 29
// ---------------------------------------------------------------------------

export async function listPosts(actor: Actor, opts: { status?: string; search?: string } = {}) {
  authorize(actor, "cms.read");
  const tenantId = requireTenantId(actor);
  const where: Record<string, unknown> = { tenantId, deletedAt: null };
  if (opts.status) where.status = opts.status;
  if (opts.search) where.title = { contains: opts.search, mode: "insensitive" };
  return prisma.post.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      category: { select: { name: true } },
    },
  });
}

export async function getPost(actor: Actor, id: string) {
  authorize(actor, "cms.read");
  const tenantId = requireTenantId(actor);
  const post = await prisma.post.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!post) throw Errors.notFound("Post not found.");
  return post;
}

export async function createPost(
  actor: Actor,
  input: { title: string; slug: string; excerpt?: string; content?: string; type?: string },
) {
  authorize(actor, "cms.create");
  const tenantId = requireTenantId(actor);
  const slug = normalizeSlug(input.slug);
  const clash = await prisma.post.findFirst({ where: { tenantId, slug } });
  if (clash) throw Errors.conflict("A post with this slug already exists.");
  const post = await prisma.post.create({
    data: {
      tenantId,
      slug,
      title: input.title.trim(),
      excerpt: input.excerpt?.trim() || null,
      content: input.content?.trim() || null,
      type: (input.type as never) ?? "NEWS",
      authorUserId: actor.userId,
    },
  });
  await recordAudit({ actor, action: "cms.post.create", resource: "Post", resourceId: post.id });
  return post;
}

export async function updatePost(
  actor: Actor,
  id: string,
  input: { title?: string; slug?: string; excerpt?: string; content?: string; type?: string },
) {
  authorize(actor, "cms.update");
  const tenantId = requireTenantId(actor);
  const existing = await prisma.post.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!existing) throw Errors.notFound("Post not found.");
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.excerpt !== undefined) data.excerpt = input.excerpt?.trim() || null;
  if (input.content !== undefined) data.content = input.content?.trim() || null;
  if (input.type !== undefined) data.type = input.type;
  if (input.slug !== undefined) {
    const slug = normalizeSlug(input.slug);
    const clash = await prisma.post.findFirst({ where: { tenantId, slug, id: { not: id } } });
    if (clash) throw Errors.conflict("A post with this slug already exists.");
    data.slug = slug;
  }
  const post = await prisma.post.update({ where: { id }, data });
  await recordAudit({ actor, action: "cms.post.update", resource: "Post", resourceId: id });
  return post;
}

export async function setPostStatus(
  actor: Actor,
  id: string,
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED",
  scheduledAt?: Date,
) {
  const tenantId = requireTenantId(actor);
  if (status === "PUBLISHED" || status === "SCHEDULED") authorize(actor, "cms.publish");
  else authorize(actor, "cms.update");
  const existing = await prisma.post.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!existing) throw Errors.notFound("Post not found.");
  const now = new Date();
  const post = await prisma.post.update({
    where: { id },
    data: {
      status,
      publishedAt:
        status === "PUBLISHED"
          ? (existing.publishedAt && existing.publishedAt <= now ? existing.publishedAt : now)
          : status === "SCHEDULED"
            ? (scheduledAt ?? null)
            : existing.publishedAt,
    },
  });
  await recordAudit({ actor, action: `cms.post.${status.toLowerCase()}`, resource: "Post", resourceId: id });
  return post;
}

export async function deletePost(actor: Actor, id: string) {
  authorize(actor, "cms.delete");
  const tenantId = requireTenantId(actor);
  const post = await prisma.post.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!post) throw Errors.notFound("Post not found.");
  await prisma.post.update({ where: { id }, data: { deletedAt: new Date() } });
  await recordAudit({ actor, action: "cms.post.delete", resource: "Post", resourceId: id });
}

// ---------------------------------------------------------------------------
// Events — Phase 29
// ---------------------------------------------------------------------------

export async function listEvents(actor: Actor, opts: { upcomingOnly?: boolean } = {}) {
  authorize(actor, "cms.read");
  const tenantId = requireTenantId(actor);
  return prisma.event.findMany({
    where: { tenantId, ...(opts.upcomingOnly ? { startAt: { gte: new Date() } } : {}) },
    orderBy: { startAt: opts.upcomingOnly ? "asc" : "desc" },
  });
}

export async function createEvent(
  actor: Actor,
  input: { title: string; description?: string; location?: string; startAt: Date; endAt: Date; allDay?: boolean; isPublic?: boolean },
) {
  authorize(actor, "cms.create");
  const tenantId = requireTenantId(actor);
  if (input.endAt < input.startAt) throw Errors.validation("The end time must be after the start time.");
  const event = await prisma.event.create({
    data: {
      tenantId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      location: input.location?.trim() || null,
      startAt: input.startAt,
      endAt: input.endAt,
      allDay: input.allDay ?? false,
      isPublic: input.isPublic ?? true,
    },
  });
  await recordAudit({ actor, action: "cms.event.create", resource: "Event", resourceId: event.id });
  return event;
}

export async function setEventStatus(actor: Actor, id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  if (status === "PUBLISHED") authorize(actor, "cms.publish");
  else authorize(actor, "cms.update");
  const tenantId = requireTenantId(actor);
  const existing = await prisma.event.findFirst({ where: { id, tenantId } });
  if (!existing) throw Errors.notFound("Event not found.");
  const event = await prisma.event.update({ where: { id }, data: { status } });
  await recordAudit({ actor, action: `cms.event.${status.toLowerCase()}`, resource: "Event", resourceId: id });
  return event;
}

export async function deleteEvent(actor: Actor, id: string) {
  authorize(actor, "cms.delete");
  const tenantId = requireTenantId(actor);
  const event = await prisma.event.findFirst({ where: { id, tenantId } });
  if (!event) throw Errors.notFound("Event not found.");
  await prisma.event.delete({ where: { id } });
  await recordAudit({ actor, action: "cms.event.delete", resource: "Event", resourceId: id });
}

// ---------------------------------------------------------------------------
// Media library — Phase 27
// ---------------------------------------------------------------------------

export async function listMedia(actor: Actor, opts: { search?: string } = {}) {
  authorize(actor, "media.read");
  const tenantId = requireTenantId(actor);
  const assets = await prisma.mediaAsset.findMany({
    where: { tenantId, ...(opts.search ? { title: { contains: opts.search, mode: "insensitive" } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  // Join file metadata for thumbnails/size.
  const fileIds = assets.map((a) => a.fileId);
  const files = await prisma.fileObject.findMany({
    where: { id: { in: fileIds }, tenantId },
    select: { id: true, fileName: true, mimeType: true, size: true },
  });
  const byId = new Map(files.map((f) => [f.id, f]));
  return assets.map((a) => ({ ...a, file: byId.get(a.fileId) ?? null }));
}

export async function registerMedia(
  actor: Actor,
  input: { fileId: string; alt?: string; title?: string; tags?: string[] },
) {
  authorize(actor, "media.manage");
  const tenantId = requireTenantId(actor);
  const file = await prisma.fileObject.findFirst({ where: { id: input.fileId, tenantId } });
  if (!file) throw Errors.notFound("File not found.");
  const asset = await prisma.mediaAsset.create({
    data: {
      tenantId,
      fileId: input.fileId,
      alt: input.alt?.trim() || null,
      title: input.title?.trim() || file.fileName,
      tags: input.tags ?? [],
    },
  });
  await recordAudit({ actor, action: "cms.media.register", resource: "MediaAsset", resourceId: asset.id });
  return asset;
}

export async function deleteMedia(actor: Actor, id: string) {
  authorize(actor, "media.manage");
  const tenantId = requireTenantId(actor);
  const asset = await prisma.mediaAsset.findFirst({ where: { id, tenantId } });
  if (!asset) throw Errors.notFound("Media not found.");
  await prisma.mediaAsset.delete({ where: { id } });
  await recordAudit({ actor, action: "cms.media.delete", resource: "MediaAsset", resourceId: id });
}
