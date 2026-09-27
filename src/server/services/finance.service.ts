import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize, can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Finance (Phases 69-70).
 *
 * Invoices carry line items; payments are recorded against them. The invoice
 * status is always derived from the sum of completed payments so the books
 * reconcile: nothing ever hand-sets PAID. A guardian or student only sees
 * invoices that name them.
 */

type InvoiceItemInput = { description: string; quantity?: number; unitPrice: number };

function deriveStatus(subtotal: number, discount: number, paid: number): "UNPAID" | "PARTIAL" | "PAID" {
  const total = Math.max(0, subtotal - discount);
  if (paid <= 0) return "UNPAID";
  if (paid + 0.001 >= total) return "PAID";
  return "PARTIAL";
}

export async function listInvoices(actor: Actor, opts: { studentId?: string; status?: string } = {}) {
  authorize(actor, "finance.read");
  const tenantId = requireTenantId(actor);
  return prisma.invoice.findMany({
    where: {
      tenantId,
      ...(opts.studentId ? { studentId: opts.studentId } : {}),
      ...(opts.status ? { status: opts.status as never } : {}),
    },
    orderBy: { issueDate: "desc" },
    include: {
      student: { select: { fullName: true, studentNumber: true } },
      _count: { select: { payments: true } },
    },
  });
}

export async function createInvoice(
  actor: Actor,
  input: { studentId?: string; guardianId?: string; academicYearId?: string; dueDate: Date; currency?: string; discount?: number; notes?: string; items: InvoiceItemInput[] },
) {
  authorize(actor, "finance.manage");
  const tenantId = requireTenantId(actor);
  if (!input.items.length) throw Errors.validation("An invoice needs at least one line item.");
  for (const it of input.items) {
    if (!it.description.trim()) throw Errors.validation("Every line item needs a description.");
    if (it.unitPrice < 0) throw Errors.validation("Unit price cannot be negative.");
  }
  const subtotal = input.items.reduce((sum, it) => sum + it.unitPrice * (it.quantity ?? 1), 0);
  const discount = input.discount ?? 0;
  if (discount < 0 || discount > subtotal) throw Errors.validation("Discount must be between 0 and the subtotal.");

  // Sequential invoice number per tenant, e.g. INV-2026-0007.
  const count = await prisma.invoice.count({ where: { tenantId } });
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      studentId: input.studentId || null,
      guardianId: input.guardianId || null,
      academicYearId: input.academicYearId || null,
      invoiceNumber,
      dueDate: input.dueDate,
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount),
      currency: input.currency ?? "IDR",
      notes: input.notes?.trim() || null,
      status: "UNPAID",
      items: { create: input.items.map((it) => ({ tenantId, description: it.description.trim(), quantity: it.quantity ?? 1, amount: it.unitPrice * (it.quantity ?? 1) })) },
    },
    include: { items: true },
  });
  await recordAudit({ actor, action: "invoice.create", resource: "Invoice", resourceId: invoice.id });
  return invoice;
}

export async function getInvoice(actor: Actor, id: string) {
  const tenantId = requireTenantId(actor);
  const invoice = await prisma.invoice.findFirst({
    where: { id, tenantId },
    include: { items: true, payments: { orderBy: { paidAt: "desc" } }, student: { select: { id: true, userId: true, fullName: true } } },
  });
  if (!invoice) throw Errors.notFound("Invoice not found.");

  // A non-finance user may only see their own / their child's invoice.
  if (!can(actor, "finance.read")) {
    let allowed = invoice.student?.userId === actor.userId;
    if (!allowed) {
      const guardian = await prisma.guardian.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null }, select: { id: true } });
      if (guardian && invoice.studentId) {
        allowed = !!(await prisma.studentGuardian.findFirst({ where: { guardianId: guardian.id, studentId: invoice.studentId } }));
      }
    }
    if (!allowed) throw Errors.forbidden("You cannot view this invoice.");
  }
  return invoice;
}

/** Record a payment and re-derive the invoice status from all payments. */
export async function recordPayment(
  actor: Actor,
  invoiceId: string,
  input: { amount: number; method?: string; reference?: string; notes?: string; paidAt?: Date },
) {
  authorize(actor, "finance.manage");
  const tenantId = requireTenantId(actor);
  if (input.amount <= 0) throw Errors.validation("Payment amount must be positive.");

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId }, include: { payments: true } });
  if (!invoice) throw Errors.notFound("Invoice not found.");
  if (invoice.status === "CANCELLED" || invoice.status === "REFUNDED") throw Errors.conflict("This invoice cannot receive payments.");

  const alreadyPaid = invoice.payments.filter((p) => p.status === "COMPLETED").reduce((s, p) => s + p.amount, 0);
  const outstanding = invoice.total - alreadyPaid;
  if (input.amount > outstanding + 0.001) throw Errors.validation(`Payment exceeds the outstanding balance of ${outstanding}.`);

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        tenantId,
        invoiceId,
        amount: input.amount,
        method: (input.method as never) ?? "CASH",
        reference: input.reference?.trim() || null,
        notes: input.notes?.trim() || null,
        paidAt: input.paidAt ?? new Date(),
        status: "COMPLETED",
        recordedByUserId: actor.userId,
      },
    });
    const paidTotal = alreadyPaid + input.amount;
    const status = deriveStatus(invoice.subtotal, invoice.discount, paidTotal);
    await tx.invoice.update({ where: { id: invoiceId }, data: { paidAmount: paidTotal, status } });
    return payment;
  });
  await recordAudit({ actor, action: "payment.record", resource: "Invoice", resourceId: invoiceId });
  return result;
}

/** Derived finance summary for dashboards/reports. */
export async function getFinanceSummary(actor: Actor) {
  authorize(actor, "finance.read");
  const tenantId = requireTenantId(actor);
  const invoices = await prisma.invoice.findMany({ where: { tenantId }, select: { total: true, paidAmount: true, status: true, dueDate: true } });

  let billed = 0;
  let collected = 0;
  let overdue = 0;
  const now = new Date();
  for (const inv of invoices) {
    if (inv.status === "CANCELLED" || inv.status === "REFUNDED") continue;
    billed += inv.total;
    collected += inv.paidAmount;
    if (inv.paidAmount + 0.001 < inv.total && inv.dueDate < now) overdue += inv.total - inv.paidAmount;
  }
  return {
    invoices: invoices.length,
    billed: Math.round(billed * 100) / 100,
    collected: Math.round(collected * 100) / 100,
    outstanding: Math.round((billed - collected) * 100) / 100,
    overdue: Math.round(overdue * 100) / 100,
  };
}

/** A guardian's/student's own invoices, from the actor's user id. */
export async function getMyInvoices(actor: Actor) {
  const tenantId = requireTenantId(actor);
  const studentIds: string[] = [];
  const student = await prisma.student.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null }, select: { id: true } });
  if (student) studentIds.push(student.id);
  const guardian = await prisma.guardian.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null }, select: { id: true } });
  if (guardian) {
    const links = await prisma.studentGuardian.findMany({ where: { guardianId: guardian.id }, select: { studentId: true } });
    studentIds.push(...links.map((l) => l.studentId));
  }
  if (studentIds.length === 0) return [];
  return prisma.invoice.findMany({
    where: { tenantId, studentId: { in: studentIds } },
    orderBy: { issueDate: "desc" },
    include: { items: true },
  });
}
