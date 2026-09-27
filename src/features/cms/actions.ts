"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import {
  createPage,
  updatePage,
  setPageStatus,
  deletePage,
  replaceBlocks,
  normalizeSlug,
  createPost,
  updatePost,
  setPostStatus,
  deletePost,
  createEvent,
  setEventStatus,
  deleteEvent,
  registerMedia,
  deleteMedia,
  type BlockType,
} from "@/server/services/cms.service";

export type CmsResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const blockSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

const createSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(160),
  slug: z.string().trim().min(1, "Slug is required").max(160),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  isHomepage: z.coerce.boolean().optional(),
});

export async function createPageAction(_prev: CmsResult | null, formData: FormData): Promise<CmsResult> {
  try {
    const actor = await requireActor();
    const parsed = createSchema.safeParse({
      title: formData.get("title"),
      slug: formData.get("slug") || String(formData.get("title") ?? ""),
      description: formData.get("description") ?? undefined,
      isHomepage: formData.get("isHomepage") === "on",
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
    }
    const page = await createPage(actor, {
      title: parsed.data.title,
      slug: normalizeSlug(parsed.data.slug),
      description: parsed.data.description || undefined,
      isHomepage: parsed.data.isHomepage,
    });
    revalidatePath("/app/cms/pages");
    return { ok: true, id: page.id };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

export async function updatePageAction(id: string, input: { title: string; slug: string; description?: string; isHomepage?: boolean }): Promise<CmsResult> {
  try {
    const actor = await requireActor();
    await updatePage(actor, id, input);
    revalidatePath(`/app/cms/pages/${id}`);
    revalidatePath("/app/cms/pages");
    return { ok: true };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

export async function setPageStatusAction(
  id: string,
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED",
  scheduledAtIso?: string,
): Promise<CmsResult> {
  try {
    const actor = await requireActor();
    await setPageStatus(actor, id, status, scheduledAtIso ? new Date(scheduledAtIso) : undefined);
    revalidatePath(`/app/cms/pages/${id}`);
    revalidatePath("/app/cms/pages");
    return { ok: true };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

export async function deletePageAction(id: string): Promise<CmsResult> {
  try {
    const actor = await requireActor();
    await deletePage(actor, id);
    revalidatePath("/app/cms/pages");
    return { ok: true };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

export async function saveBlocksAction(pageId: string, blocks: { type: string; data: Record<string, unknown> }[]): Promise<CmsResult> {
  try {
    const actor = await requireActor();
    const parsed = z.array(blockSchema).max(200).safeParse(blocks);
    if (!parsed.success) return { ok: false, error: "Invalid block data." };
    await replaceBlocks(
      actor,
      pageId,
      parsed.data.map((b) => ({ type: b.type as BlockType, data: b.data })),
    );
    revalidatePath(`/app/cms/pages/${pageId}`);
    return { ok: true };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

const postSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(200),
  slug: z.string().trim().max(200).optional().or(z.literal("")),
  excerpt: z.string().trim().max(600).optional().or(z.literal("")),
  content: z.string().max(50000).optional().or(z.literal("")),
  type: z.enum(["NEWS", "ANNOUNCEMENT", "ARTICLE", "BLOG"]).optional(),
});

export async function createPostAction(_prev: CmsResult | null, formData: FormData): Promise<CmsResult> {
  try {
    const actor = await requireActor();
    const parsed = postSchema.safeParse({
      title: formData.get("title"),
      slug: formData.get("slug") || String(formData.get("title") ?? ""),
      excerpt: formData.get("excerpt") ?? undefined,
      content: formData.get("content") ?? undefined,
      type: formData.get("type") ?? undefined,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
    }
    const post = await createPost(actor, {
      title: parsed.data.title,
      slug: normalizeSlug(parsed.data.slug || parsed.data.title),
      excerpt: parsed.data.excerpt || undefined,
      content: parsed.data.content || undefined,
      type: parsed.data.type,
    });
    revalidatePath("/app/cms/posts");
    return { ok: true, id: post.id };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

export async function updatePostAction(id: string, input: { title: string; slug: string; excerpt?: string; content?: string; type?: string }): Promise<CmsResult> {
  try {
    const actor = await requireActor();
    await updatePost(actor, id, { ...input, slug: normalizeSlug(input.slug) });
    revalidatePath(`/app/cms/posts/${id}`);
    revalidatePath("/app/cms/posts");
    return { ok: true };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

export async function setPostStatusAction(id: string, status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED"): Promise<CmsResult> {
  try {
    const actor = await requireActor();
    await setPostStatus(actor, id, status);
    revalidatePath(`/app/cms/posts/${id}`);
    revalidatePath("/app/cms/posts");
    return { ok: true };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

export async function deletePostAction(id: string): Promise<CmsResult> {
  try {
    const actor = await requireActor();
    await deletePost(actor, id);
    revalidatePath("/app/cms/posts");
    return { ok: true };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const eventSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  startAt: z.string().min(1, "Start time is required"),
  endAt: z.string().min(1, "End time is required"),
  allDay: z.coerce.boolean().optional(),
  isPublic: z.coerce.boolean().optional(),
});

export async function createEventAction(_prev: CmsResult | null, formData: FormData): Promise<CmsResult> {
  try {
    const actor = await requireActor();
    const parsed = eventSchema.safeParse({
      title: formData.get("title"),
      description: formData.get("description") ?? undefined,
      location: formData.get("location") ?? undefined,
      startAt: formData.get("startAt"),
      endAt: formData.get("endAt"),
      allDay: formData.get("allDay") === "on",
      isPublic: formData.get("isPublic") !== "off",
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
    }
    const event = await createEvent(actor, {
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      location: parsed.data.location || undefined,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      allDay: parsed.data.allDay,
      isPublic: parsed.data.isPublic,
    });
    revalidatePath("/app/cms/events");
    return { ok: true, id: event.id };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

export async function setEventStatusAction(id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED"): Promise<CmsResult> {
  try {
    const actor = await requireActor();
    await setEventStatus(actor, id, status);
    revalidatePath("/app/cms/events");
    return { ok: true };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

export async function deleteEventAction(id: string): Promise<CmsResult> {
  try {
    const actor = await requireActor();
    await deleteEvent(actor, id);
    revalidatePath("/app/cms/events");
    return { ok: true };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export async function registerMediaAction(_prev: CmsResult | null, formData: FormData): Promise<CmsResult> {
  try {
    const actor = await requireActor();
    const fileId = String(formData.get("fileId") ?? "").trim();
    if (!fileId) return { ok: false, error: "Select a file to register." };
    const alt = String(formData.get("alt") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const asset = await registerMedia(actor, { fileId, alt: alt || undefined, title: title || undefined });
    revalidatePath("/app/cms/media");
    return { ok: true, id: asset.id };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

export async function deleteMediaAction(id: string): Promise<CmsResult> {
  try {
    const actor = await requireActor();
    await deleteMedia(actor, id);
    revalidatePath("/app/cms/media");
    return { ok: true };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}
