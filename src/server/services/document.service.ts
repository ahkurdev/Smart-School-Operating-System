import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize, can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Secure documents (Phase 79).
 *
 * A Document wraps an uploaded FileObject with a title, category, optional owner
 * (student/teacher) and an access level. Reading a document's metadata re-checks
 * the access level against the actor: PUBLIC/STAFF are broad, RESTRICTED needs
 * document.read, and PRIVATE is only the uploader or an admin. Bytes are served
 * through the file route which re-checks the same rules - never a public URL.
 */

type DocumentAccess = "PUBLIC" | "STAFF" | "RESTRICTED" | "PRIVATE";

export type DocumentInput = {
  fileId: string;
  title: string;
  category: string;
  accessLevel?: DocumentAccess;
  studentId?: string;
  teacherId?: string;
  expiresAt?: Date;
};

/** The Prisma `where` fragment an actor is allowed to read documents under. */
function readableWhere(actor: Actor, tenantId: string) {
  if (actor.isPlatform || can(actor, "document.manage")) return { tenantId, deletedAt: null };
  if (can(actor, "document.read")) {
    return { tenantId, deletedAt: null, accessLevel: { in: ["PUBLIC", "STAFF", "RESTRICTED"] as never } };
  }
  return { tenantId, deletedAt: null, accessLevel: "PUBLIC" as never };
}

export async function listDocuments(
  actor: Actor,
  opts: { category?: string; studentId?: string; search?: string } = {},
) {
  const tenantId = requireTenantId(actor);
  // Everyone with any read ability can list; PRIVATE is filtered out unless admin.
  const base = readableWhere(actor, tenantId);
  return prisma.document.findMany({
    where: {
      ...base,
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.studentId ? { studentId: opts.studentId } : {}),
      ...(opts.search ? { title: { contains: opts.search, mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      file: { select: { id: true, fileName: true, mimeType: true, size: true } },
      student: { select: { id: true, fullName: true, studentNumber: true } },
    },
  });
}

/** Read one document's metadata under the access rules. */
export async function getDocument(actor: Actor, id: string) {
  const tenantId = requireTenantId(actor);
  const doc = await prisma.document.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      file: { select: { id: true, fileName: true, mimeType: true, size: true } },
      student: { select: { id: true, fullName: true, studentNumber: true } },
    },
  });
  if (!doc) throw Errors.notFound("Document not found.");
  if (doc.expiresAt && doc.expiresAt.getTime() < Date.now()) {
    throw Errors.notFound("This document is no longer available.");
  }

  const isOwner = doc.uploadedByUserId === actor.userId;
  const allowed =
    actor.isPlatform ||
    isOwner ||
    can(actor, "document.manage") ||
    (doc.accessLevel === "PUBLIC") ||
    (doc.accessLevel === "STAFF" && can(actor, "document.read")) ||
    (doc.accessLevel === "RESTRICTED" && can(actor, "document.read"));

  if (!allowed) throw Errors.forbidden("You cannot view this document.");
  return doc;
}

export async function createDocument(actor: Actor, input: DocumentInput) {
  authorize(actor, "document.manage");
  const tenantId = requireTenantId(actor);
  if (!input.title.trim()) throw Errors.validation("A title is required.");
  if (!input.category.trim()) throw Errors.validation("A category is required.");

  const file = await prisma.fileObject.findFirst({ where: { id: input.fileId, tenantId, deletedAt: null }, select: { id: true } });
  if (!file) throw Errors.notFound("Uploaded file not found.");

  if (input.studentId) {
    const student = await prisma.student.findFirst({ where: { id: input.studentId, tenantId, deletedAt: null }, select: { id: true } });
    if (!student) throw Errors.notFound("Student not found.");
  }

  const doc = await prisma.document.create({
    data: {
      tenantId,
      fileId: input.fileId,
      title: input.title.trim(),
      category: input.category.trim(),
      accessLevel: (input.accessLevel as never) ?? "RESTRICTED",
      studentId: input.studentId || null,
      teacherId: input.teacherId || null,
      expiresAt: input.expiresAt ?? null,
      uploadedByUserId: actor.userId,
    },
  });
  await recordAudit({ actor, action: "document.create", resource: "Document", resourceId: doc.id, metadata: { category: doc.category, accessLevel: doc.accessLevel } });
  return doc;
}

export async function deleteDocument(actor: Actor, id: string) {
  authorize(actor, "document.manage");
  const tenantId = requireTenantId(actor);
  const doc = await prisma.document.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
  if (!doc) throw Errors.notFound("Document not found.");
  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  await recordAudit({ actor, action: "document.delete", resource: "Document", resourceId: id });
}

/** Documents attached to a single student, under the actor's read rules. */
export async function listStudentDocuments(actor: Actor, studentId: string) {
  const tenantId = requireTenantId(actor);
  return prisma.document.findMany({
    where: { ...readableWhere(actor, tenantId), studentId },
    orderBy: { createdAt: "desc" },
    include: { file: { select: { id: true, fileName: true, mimeType: true, size: true } } },
  });
}
