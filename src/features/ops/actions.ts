"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import { generateReportCard, setReportCardStatus } from "@/server/services/reportcard.service";
import { createAnnouncement, publishAnnouncement, archiveAnnouncement, acknowledgeAnnouncement } from "@/server/services/announcement.service";
import { createInvoice, recordPayment } from "@/server/services/finance.service";

export type OpsResult = { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(e: unknown): OpsResult {
  if (isAppError(e)) return { ok: false, error: e.userMessage };
  throw e;
}

// --- Report cards ------------------------------------------------------------

export async function generateReportCardAction(_prev: OpsResult | null, formData: FormData): Promise<OpsResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      studentId: z.string().min(1, "Student is required"),
      academicYearId: z.string().min(1, "Academic year is required"),
      termId: z.string().optional().or(z.literal("")),
      classroomId: z.string().optional().or(z.literal("")),
      teacherRemarks: z.string().max(2000).optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({
      studentId: formData.get("studentId"),
      academicYearId: formData.get("academicYearId"),
      termId: formData.get("termId") ?? undefined,
      classroomId: formData.get("classroomId") ?? undefined,
      teacherRemarks: formData.get("teacherRemarks") ?? undefined,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
    }
    const card = await generateReportCard(actor, {
      studentId: parsed.data.studentId,
      academicYearId: parsed.data.academicYearId,
      termId: parsed.data.termId || undefined,
      classroomId: parsed.data.classroomId || undefined,
      teacherRemarks: parsed.data.teacherRemarks || undefined,
    });
    revalidatePath("/app/report-cards");
    return { ok: true, id: card.id };
  } catch (e) {
    return fail(e);
  }
}

export async function setReportCardStatusAction(id: string, status: "DRAFT" | "REVIEW" | "PUBLISHED"): Promise<OpsResult> {
  try {
    const actor = await requireActor();
    await setReportCardStatus(actor, id, status);
    revalidatePath("/app/report-cards");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// --- Announcements -----------------------------------------------------------

export async function createAnnouncementAction(_prev: OpsResult | null, formData: FormData): Promise<OpsResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      title: z.string().trim().min(2, "Title is too short").max(200),
      body: z.string().trim().min(1, "Body is required").max(20000),
      audience: z.enum(["ALL", "STUDENTS", "TEACHERS", "PARENTS", "STAFF", "CLASS"]).optional(),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
      requiresAcknowledgment: z.coerce.boolean().optional(),
      expireAt: z.string().optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({
      title: formData.get("title"),
      body: formData.get("body"),
      audience: formData.get("audience") ?? undefined,
      priority: formData.get("priority") ?? undefined,
      requiresAcknowledgment: formData.get("requiresAcknowledgment") === "on",
      expireAt: formData.get("expireAt") ?? undefined,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
    }
    const ann = await createAnnouncement(actor, {
      title: parsed.data.title,
      body: parsed.data.body,
      audience: parsed.data.audience,
      priority: parsed.data.priority,
      requiresAcknowledgment: parsed.data.requiresAcknowledgment,
      expireAt: parsed.data.expireAt ? new Date(parsed.data.expireAt) : undefined,
    });
    revalidatePath("/app/announcements");
    return { ok: true, id: ann.id };
  } catch (e) {
    return fail(e);
  }
}

export async function publishAnnouncementAction(id: string): Promise<OpsResult> {
  try {
    const actor = await requireActor();
    await publishAnnouncement(actor, id);
    revalidatePath("/app/announcements");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveAnnouncementAction(id: string): Promise<OpsResult> {
  try {
    const actor = await requireActor();
    await archiveAnnouncement(actor, id);
    revalidatePath("/app/announcements");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function acknowledgeAnnouncementAction(id: string): Promise<OpsResult> {
  try {
    const actor = await requireActor();
    await acknowledgeAnnouncement(actor, id);
    revalidatePath("/app/announcements");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// --- Finance -----------------------------------------------------------------

export async function createInvoiceAction(_prev: OpsResult | null, formData: FormData): Promise<OpsResult> {
  try {
    const actor = await requireActor();
    // Line items arrive as parallel arrays from the dialog.
    const descriptions = formData.getAll("itemDescription").map(String);
    const prices = formData.getAll("itemPrice").map((v) => Number(v));
    const items = descriptions
      .map((description, i) => ({ description, unitPrice: prices[i] ?? 0 }))
      .filter((it) => it.description.trim() !== "");
    const schema = z.object({
      studentId: z.string().min(1, "Student is required"),
      academicYearId: z.string().optional().or(z.literal("")),
      dueDate: z.string().min(1, "Due date is required"),
      discount: z.coerce.number().min(0).optional(),
      currency: z.string().max(8).optional(),
      notes: z.string().max(2000).optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({
      studentId: formData.get("studentId"),
      academicYearId: formData.get("academicYearId") ?? undefined,
      dueDate: formData.get("dueDate"),
      discount: formData.get("discount") || undefined,
      currency: formData.get("currency") ?? undefined,
      notes: formData.get("notes") ?? undefined,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
    }
    if (items.length === 0) return { ok: false, error: "Add at least one line item." };
    const invoice = await createInvoice(actor, {
      studentId: parsed.data.studentId,
      academicYearId: parsed.data.academicYearId || undefined,
      dueDate: new Date(parsed.data.dueDate),
      discount: parsed.data.discount,
      currency: parsed.data.currency || undefined,
      notes: parsed.data.notes || undefined,
      items,
    });
    revalidatePath("/app/finance");
    return { ok: true, id: invoice.id };
  } catch (e) {
    return fail(e);
  }
}

export async function recordPaymentAction(_prev: OpsResult | null, formData: FormData): Promise<OpsResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      invoiceId: z.string().min(1),
      amount: z.coerce.number().positive("Amount must be positive"),
      method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "EWALLET", "GATEWAY", "OTHER"]).optional(),
      reference: z.string().max(120).optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({
      invoiceId: formData.get("invoiceId"),
      amount: formData.get("amount"),
      method: formData.get("method") ?? undefined,
      reference: formData.get("reference") ?? undefined,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
    }
    await recordPayment(actor, parsed.data.invoiceId, {
      amount: parsed.data.amount,
      method: parsed.data.method,
      reference: parsed.data.reference || undefined,
    });
    revalidatePath("/app/finance");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
