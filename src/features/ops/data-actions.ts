"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import { createDocument, deleteDocument } from "@/server/services/document.service";
import { previewStudentImport, commitStudentImport, exportStudents, exportAttendance, toCsv, toXlsxXml, type ExportFormat } from "@/server/services/data.service";

export type DataResult = { ok: true; id?: string; summary?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };
export type ExportResult = { ok: true; filename: string; mime: string; content: string } | { ok: false; error: string };
export type PreviewResult =
  | { ok: true; preview: Awaited<ReturnType<typeof previewStudentImport>> }
  | { ok: false; error: string };

function fail(e: unknown): DataResult {
  if (isAppError(e)) return { ok: false, error: e.userMessage };
  throw e;
}
function fieldErrorsFrom(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] = i.message;
  return out;
}

// --- Documents ---------------------------------------------------------------

export async function createDocumentAction(_prev: DataResult | null, formData: FormData): Promise<DataResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      fileId: z.string().min(1, "A file is required"),
      title: z.string().trim().min(1, "Title is required").max(300),
      category: z.string().trim().min(1, "Category is required").max(120),
      accessLevel: z.enum(["PUBLIC", "STAFF", "RESTRICTED", "PRIVATE"]).optional(),
      studentId: z.string().optional().or(z.literal("")),
      expiresAt: z.string().optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({
      fileId: formData.get("fileId"),
      title: formData.get("title"),
      category: formData.get("category"),
      accessLevel: formData.get("accessLevel") ?? undefined,
      studentId: formData.get("studentId") ?? undefined,
      expiresAt: formData.get("expiresAt") ?? undefined,
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    const doc = await createDocument(actor, {
      fileId: parsed.data.fileId,
      title: parsed.data.title,
      category: parsed.data.category,
      accessLevel: parsed.data.accessLevel,
      studentId: parsed.data.studentId || undefined,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    });
    revalidatePath("/app/documents");
    return { ok: true, id: doc.id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDocumentAction(id: string): Promise<DataResult> {
  try {
    const actor = await requireActor();
    await deleteDocument(actor, id);
    revalidatePath("/app/documents");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// --- Import ------------------------------------------------------------------

export async function previewStudentImportAction(_prev: PreviewResult | null, formData: FormData): Promise<PreviewResult> {
  try {
    const actor = await requireActor();
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Choose a CSV file to upload." };
    if (file.size > 5 * 1024 * 1024) return { ok: false, error: "CSV files must be 5 MB or smaller." };
    const text = await file.text();
    const preview = await previewStudentImport(actor, text);
    return { ok: true, preview };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

export async function commitStudentImportAction(rows: { fullName: string; studentNumber: string; email?: string }[]): Promise<DataResult> {
  try {
    const actor = await requireActor();
    const result = await commitStudentImport(actor, rows);
    revalidatePath("/app/students");
    revalidatePath("/app/import");
    return { ok: true, id: undefined, summary: `${result.created} created, ${result.skipped} skipped` };
  } catch (e) {
    return fail(e);
  }
}

// --- Export ------------------------------------------------------------------

export async function exportStudentsAction(format: ExportFormat): Promise<ExportResult> {
  try {
    const actor = await requireActor();
    const { headers, rows, filename } = await exportStudents(actor, format);
    const content = format === "xlsx" ? toXlsxXml("Students", headers, rows) : toCsv(headers, rows);
    const mime = format === "xlsx" ? "application/vnd.ms-excel" : "text/csv;charset=utf-8";
    return { ok: true, filename: `${filename}.${format}`, mime, content };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}

export async function exportAttendanceAction(from: string, to: string, format: ExportFormat): Promise<ExportResult> {
  try {
    const actor = await requireActor();
    const { headers, rows, filename } = await exportAttendance(actor, new Date(from), new Date(to), format);
    const content = format === "xlsx" ? toXlsxXml("Attendance", headers, rows) : toCsv(headers, rows);
    const mime = format === "xlsx" ? "application/vnd.ms-excel" : "text/csv;charset=utf-8";
    return { ok: true, filename: `${filename}.${format}`, mime, content };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.userMessage };
    throw e;
  }
}
