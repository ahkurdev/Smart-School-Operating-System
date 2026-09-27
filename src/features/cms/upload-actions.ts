"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import { storeFile } from "@/server/services/file.service";
import { registerMedia } from "@/server/services/cms.service";
import { authorize } from "@/server/policies";

export type UploadResult = { ok: true; fileId: string } | { ok: false; error: string };

/**
 * Media upload (Phase 27). The browser posts a File in FormData; we read the
 * bytes, hand them to `storeFile` (which validates size, MIME, extension and
 * magic bytes) and then register the asset in the media library.
 */
export async function uploadMediaAction(_prev: UploadResult | null, formData: FormData): Promise<UploadResult> {
  try {
    const actor = await requireActor();
    authorize(actor, "media.manage");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a file to upload." };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = await storeFile(actor, {
      file: { name: file.name, type: file.type, size: file.size, bytes },
      purpose: "media",
      isPublic: true,
    });
    await registerMedia(actor, {
      fileId: stored.id,
      title: file.name,
      alt: String(formData.get("alt") ?? "").trim() || undefined,
    });
    revalidatePath("/app/cms/media");
    return { ok: true, fileId: stored.id };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}
