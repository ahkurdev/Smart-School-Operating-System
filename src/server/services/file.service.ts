import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { requireTenantId } from "@/server/db/tenant";
import { getStorage } from "@/server/storage";
import type { Actor } from "@/types/actor";

/**
 * File service. Validates uploads (size and an allow-list of MIME types), stores
 * bytes through the provider abstraction, and records only metadata plus the
 * storage key in the database. Allowed types are conservative by default; nothing
 * executable is accepted. Callers must hold a permission to attach a file to a
 * record (checked in their own service).
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};

export const ALLOWED_MIME_TYPES = Object.keys(ALLOWED);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export type UploadInput = {
  file: { name: string; type: string; size: number; bytes: Buffer };
  /** Logical folder, e.g. "student-photo", "ppdb-document". */
  purpose: string;
  isPublic?: boolean;
};

export async function storeFile(actor: Actor, input: UploadInput) {
  const tenantId = requireTenantId(actor);
  const { file } = input;

  if (file.size <= 0) throw Errors.validation("The file is empty.");
  if (file.size > MAX_BYTES) {
    throw Errors.validation(`Files must be ${MAX_BYTES / 1024 / 1024} MB or smaller.`);
  }
  const allowedExts = ALLOWED[file.type];
  if (!allowedExts) {
    throw Errors.validation("Only JPEG, PNG, WebP, and PDF files are allowed.");
  }
  if (!allowedExts.includes(extOf(file.name))) {
    throw Errors.validation("The file extension does not match its content type.");
  }
  // Reject obvious script payloads masquerading as images.
  const head = file.bytes.subarray(0, 8).toString("hex");
  const looksPng = head.startsWith("89504e47");
  const looksJpg = head.startsWith("ffd8ff");
  const looksPdf = file.bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  const looksWebp = file.bytes.subarray(0, 4).toString("latin1") === "RIFF";
  if (!(looksPng || looksJpg || looksPdf || looksWebp)) {
    throw Errors.validation("The file does not look like a valid image or PDF.");
  }

  const key = `${tenantId}/${input.purpose}/${randomUUID()}${extOf(file.name)}`;
  const stored = await getStorage().put(key, file.bytes, file.type);

  const record = await prisma.fileObject.create({
    data: {
      tenantId,
      key: stored.key,
      provider: "local",
      fileName: file.name,
      mimeType: file.type,
      size: stored.size,
      isPublic: input.isPublic ?? false,
      uploadedByUserId: actor.userId,
    },
    select: { id: true, fileName: true, mimeType: true, size: true },
  });
  return record;
}

/** Fetch metadata for a file the actor's tenant owns. */
export async function getFileMeta(actor: Actor, fileId: string) {
  const tenantId = requireTenantId(actor);
  const file = await prisma.fileObject.findFirst({
    where: { id: fileId, deletedAt: null, OR: [{ tenantId }, { isPublic: true }] },
    select: { id: true, tenantId: true, key: true, mimeType: true, fileName: true, size: true, isPublic: true },
  });
  if (!file) throw Errors.notFound();
  return file;
}
