"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import {
  createLibraryItem,
  addLibraryCopy,
  borrowItem,
  returnItem,
  reserveItem,
} from "@/server/services/library.service";

export type LibraryResult = { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(e: unknown): LibraryResult {
  if (isAppError(e)) return { ok: false, error: e.userMessage };
  throw e;
}

function fieldErrorsFrom(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] = i.message;
  return out;
}

export async function createLibraryItemAction(_prev: LibraryResult | null, formData: FormData): Promise<LibraryResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      title: z.string().trim().min(1, "Title is required").max(300),
      author: z.string().trim().max(200).optional().or(z.literal("")),
      publisher: z.string().trim().max(200).optional().or(z.literal("")),
      year: z.coerce.number().int().optional(),
      isbn: z.string().trim().max(40).optional().or(z.literal("")),
      category: z.string().trim().max(120).optional().or(z.literal("")),
      description: z.string().trim().max(4000).optional().or(z.literal("")),
      type: z.enum(["PHYSICAL", "EBOOK", "DOCUMENT", "LINK"]).optional(),
      accessLevel: z.enum(["public", "student", "staff", "restricted"]).optional(),
      externalUrl: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
      copyCount: z.coerce.number().int().min(0).max(500).optional(),
    });
    const parsed = schema.safeParse({
      title: formData.get("title"),
      author: formData.get("author") ?? undefined,
      publisher: formData.get("publisher") ?? undefined,
      year: formData.get("year") || undefined,
      isbn: formData.get("isbn") ?? undefined,
      category: formData.get("category") ?? undefined,
      description: formData.get("description") ?? undefined,
      type: formData.get("type") ?? undefined,
      accessLevel: formData.get("accessLevel") ?? undefined,
      externalUrl: formData.get("externalUrl") ?? undefined,
      copyCount: formData.get("copyCount") || undefined,
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };

    const item = await createLibraryItem(actor, {
      ...parsed.data,
      author: parsed.data.author || undefined,
      publisher: parsed.data.publisher || undefined,
      isbn: parsed.data.isbn || undefined,
      category: parsed.data.category || undefined,
      description: parsed.data.description || undefined,
      externalUrl: parsed.data.externalUrl || undefined,
    });
    revalidatePath("/app/library");
    return { ok: true, id: item.id };
  } catch (e) {
    return fail(e);
  }
}

export async function addLibraryCopyAction(_prev: LibraryResult | null, formData: FormData): Promise<LibraryResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      itemId: z.string().min(1),
      barcode: z.string().trim().max(60).optional().or(z.literal("")),
      location: z.string().trim().max(120).optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({
      itemId: formData.get("itemId"),
      barcode: formData.get("barcode") ?? undefined,
      location: formData.get("location") ?? undefined,
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    const copy = await addLibraryCopy(actor, parsed.data.itemId, {
      barcode: parsed.data.barcode || undefined,
      location: parsed.data.location || undefined,
    });
    revalidatePath(`/app/library/${parsed.data.itemId}`);
    revalidatePath("/app/library");
    return { ok: true, id: copy.id };
  } catch (e) {
    return fail(e);
  }
}

export async function borrowItemAction(_prev: LibraryResult | null, formData: FormData): Promise<LibraryResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      copyId: z.string().min(1, "Copy is required"),
      studentId: z.string().optional().or(z.literal("")),
      days: z.coerce.number().int().min(1).max(120).optional(),
    });
    const parsed = schema.safeParse({
      copyId: formData.get("copyId"),
      studentId: formData.get("studentId") ?? undefined,
      days: formData.get("days") || undefined,
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    const loan = await borrowItem(actor, {
      copyId: parsed.data.copyId,
      studentId: parsed.data.studentId || undefined,
      days: parsed.data.days,
    });
    revalidatePath("/app/library");
    return { ok: true, id: loan.id };
  } catch (e) {
    return fail(e);
  }
}

export async function returnLoanAction(loanId: string, opts: { waiveFine?: boolean } = {}): Promise<LibraryResult> {
  try {
    const actor = await requireActor();
    await returnItem(actor, loanId, opts);
    revalidatePath("/app/library");
    revalidatePath("/app/library/loans");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reserveItemAction(itemId: string, studentId?: string): Promise<LibraryResult> {
  try {
    const actor = await requireActor();
    const reservation = await reserveItem(actor, { itemId, studentId });
    revalidatePath(`/app/library/${itemId}`);
    return { ok: true, id: reservation.id };
  } catch (e) {
    return fail(e);
  }
}
