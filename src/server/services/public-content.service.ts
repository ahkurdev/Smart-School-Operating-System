import { prisma } from "@/server/db/client";
/**
 * Public content reader (Phases 24-30).
 *
 * Deliberately separate from `cms.service`: this runs on the PUBLIC website,
 * has NO actor and NO permission checks, and therefore only ever returns rows
 * that are PUBLISHED (or SCHEDULED whose time has arrived). Every function
 * takes an explicit tenantId resolved from the host, never from user input.
 *
 * Draft/archived content can never leak through these queries.
 */

/** Status filter admitting only content the public may see (status + time). */
function publicWhere() {
  const now = new Date();
  return [
    { status: "PUBLISHED" as const, publishedAt: { lte: now } },
    { status: "SCHEDULED" as const, publishedAt: { lte: now } },
  ];
}

export async function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
}

export async function getPublishedPage(tenantId: string, slug: string) {
  const page = await prisma.cmsPage.findFirst({
    where: {
      tenantId,
      slug,
      deletedAt: null,
      OR: publicWhere(),
    },
    include: { blocks: { orderBy: { sequence: "asc" } } },
  });
  return page;
}

export async function getHomepage(tenantId: string) {
  return prisma.cmsPage.findFirst({
    where: { tenantId, isHomepage: true, deletedAt: null, OR: publicWhere() },
    include: { blocks: { orderBy: { sequence: "asc" } } },
  });
}

export async function listPublishedPages(tenantId: string) {
  return prisma.cmsPage.findMany({
    where: { tenantId, deletedAt: null, OR: publicWhere() },
    orderBy: { title: "asc" },
    select: { slug: true, title: true, updatedAt: true },
  });
}

export async function listPublishedPosts(tenantId: string, opts: { type?: string; limit?: number } = {}) {
  return prisma.post.findMany({
    where: {
      tenantId,
      deletedAt: null,
      OR: publicWhere(),
      ...(opts.type ? { type: opts.type as never } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: Math.min(opts.limit ?? 12, 50),
    select: {
      slug: true,
      title: true,
      excerpt: true,
      coverFileId: true,
      publishedAt: true,
      type: true,
      category: { select: { name: true, slug: true } },
    },
  });
}

export async function getPublishedPost(tenantId: string, slug: string) {
  return prisma.post.findFirst({
    where: { tenantId, slug, deletedAt: null, OR: publicWhere() },
    include: { category: { select: { name: true, slug: true } } },
  });
}

export async function listPublishedEvents(tenantId: string, opts: { upcomingOnly?: boolean; limit?: number } = {}) {
  return prisma.event.findMany({
    where: {
      tenantId,
      isPublic: true,
      ...(opts.upcomingOnly ? { startAt: { gte: new Date() } } : {}),
      OR: [{ status: "PUBLISHED" }, { status: "SCHEDULED" }],
    },
    orderBy: { startAt: opts.upcomingOnly ? "asc" : "desc" },
    take: Math.min(opts.limit ?? 12, 50),
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      startAt: true,
      endAt: true,
      allDay: true,
      coverFileId: true,
    },
  });
}

export async function listPublicGalleries(tenantId: string, limit = 12) {
  return prisma.gallery.findMany({
    where: { tenantId, status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    take: Math.min(limit, 24),
    include: {
      items: { orderBy: { sequence: "asc" }, take: 6, select: { fileId: true, caption: true } },
    },
  });
}
