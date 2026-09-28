import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize, can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Library (Phases 71-72).
 *
 * A catalog of items; physical items have one or more copies, each with a
 * barcode. Loans move a copy to ON_LOAN and back to AVAILABLE on return; a
 * returned copy can only be loaned again once the previous loan is closed.
 * Digital items (ebooks, external links) have no copies - access is gated by
 * `accessLevel` and the caller's permissions.
 *
 * Overdue fines are computed from a per-tenant daily rate at return time, never
 * stored speculatively, so the number always reconciles with the loan's dates.
 */

const DEFAULT_FINE_PER_DAY = 1000; // tenant-configurable later via SystemSetting

async function finePerDay(tenantId: string): Promise<number> {
  const setting = await prisma.systemSetting.findFirst({
    where: { tenantId, key: "library.fine_per_day" },
    select: { value: true },
  });
  const raw = setting?.value;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_FINE_PER_DAY;
}

export type LibraryItemInput = {
  title: string;
  author?: string;
  publisher?: string;
  year?: number;
  isbn?: string;
  category?: string;
  description?: string;
  type?: "PHYSICAL" | "EBOOK" | "DOCUMENT" | "LINK";
  accessLevel?: "public" | "student" | "staff" | "restricted";
  externalUrl?: string;
  digitalFileId?: string;
  tags?: string[];
  copyCount?: number;
};

export async function listLibraryItems(
  actor: Actor,
  opts: { search?: string; type?: string; page?: number; pageSize?: number } = {},
) {
  authorize(actor, "library.read");
  const tenantId = requireTenantId(actor);
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const where = {
    tenantId,
    deletedAt: null,
    ...(opts.type ? { type: opts.type as never } : {}),
    ...(opts.search
      ? {
          OR: [
            { title: { contains: opts.search, mode: "insensitive" as const } },
            { author: { contains: opts.search, mode: "insensitive" as const } },
            { isbn: { contains: opts.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.libraryItem.findMany({
      where,
      orderBy: { title: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { copies: true, reservations: true } } },
    }),
    prisma.libraryItem.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getLibraryItem(actor: Actor, id: string) {
  authorize(actor, "library.read");
  const tenantId = requireTenantId(actor);
  const item = await prisma.libraryItem.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      copies: {
        orderBy: { barcode: "asc" },
        include: { loans: { where: { status: "ACTIVE" }, select: { id: true, dueAt: true, studentId: true } } },
      },
      reservations: { where: { status: "PENDING" }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!item) throw Errors.notFound("Library item not found.");
  return item;
}

export async function createLibraryItem(actor: Actor, input: LibraryItemInput) {
  authorize(actor, "library.manage");
  const tenantId = requireTenantId(actor);
  if (!input.title.trim()) throw Errors.validation("A title is required.");
  if (input.year !== undefined && (input.year < 1000 || input.year > 2200)) {
    throw Errors.validation("Publication year looks invalid.");
  }
  const copyCount = Math.max(0, Math.min(500, input.copyCount ?? (input.type === "PHYSICAL" || !input.type ? 1 : 0)));

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.libraryItem.create({
      data: {
        tenantId,
        title: input.title.trim(),
        author: input.author?.trim() || null,
        publisher: input.publisher?.trim() || null,
        year: input.year ?? null,
        isbn: input.isbn?.trim() || null,
        category: input.category?.trim() || null,
        description: input.description?.trim() || null,
        type: input.type ?? "PHYSICAL",
        accessLevel: input.accessLevel ?? "public",
        externalUrl: input.externalUrl?.trim() || null,
        digitalFileId: input.digitalFileId || null,
        tags: input.tags ?? [],
      },
    });
    // Copies get sequential barcodes under the item id prefix.
    if (copyCount > 0) {
      await tx.libraryCopy.createMany({
        data: Array.from({ length: copyCount }, (_, i) => ({
          tenantId,
          itemId: created.id,
          barcode: `${created.id.slice(-6).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
        })),
      });
    }
    return created;
  });
  await recordAudit({ actor, action: "library.item.create", resource: "LibraryItem", resourceId: item.id });
  return item;
}

export async function addLibraryCopy(actor: Actor, itemId: string, input: { barcode?: string; location?: string } = {}) {
  authorize(actor, "library.manage");
  const tenantId = requireTenantId(actor);
  const item = await prisma.libraryItem.findFirst({ where: { id: itemId, tenantId, deletedAt: null }, select: { id: true, _count: { select: { copies: true } } } });
  if (!item) throw Errors.notFound("Library item not found.");
  const dto = item._count.copies;
  const barcode = (input.barcode?.trim() || `${itemId.slice(-6).toUpperCase()}-${String(dto + 1).padStart(3, "0")}`).toUpperCase();
  const existing = await prisma.libraryCopy.findFirst({ where: { tenantId, barcode } });
  if (existing) throw Errors.conflict("A copy with that barcode already exists.");
  const copy = await prisma.libraryCopy.create({ data: { tenantId, itemId, barcode, location: input.location?.trim() || null } });
  await recordAudit({ actor, action: "library.copy.add", resource: "LibraryCopy", resourceId: copy.id });
  return copy;
}

/** Borrow an available copy for a student or user. Transactional. */
export async function borrowItem(
  actor: Actor,
  input: { copyId: string; studentId?: string; borrowerUserId?: string; days?: number },
) {
  authorizeAny(actor, ["library.borrow", "library.manage"]);
  const tenantId = requireTenantId(actor);
  const days = Math.min(120, Math.max(1, input.days ?? 14));
  if (!input.studentId && !input.borrowerUserId) throw Errors.validation("A borrower is required.");

  return prisma.$transaction(async (tx) => {
    const copy = await tx.libraryCopy.findFirst({ where: { id: input.copyId, tenantId } });
    if (!copy) throw Errors.notFound("Copy not found.");
    if (copy.status !== "AVAILABLE") throw Errors.conflict(`That copy is not available (status: ${copy.status}).`);

    // Guard against the borrower-student belonging to another tenant.
    if (input.studentId) {
      const student = await tx.student.findFirst({ where: { id: input.studentId, tenantId, deletedAt: null }, select: { id: true } });
      if (!student) throw Errors.notFound("Student not found.");
    }

    const dueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const loan = await tx.libraryLoan.create({
      data: {
        tenantId,
        copyId: copy.id,
        studentId: input.studentId || null,
        borrowerUserId: input.borrowerUserId || null,
        dueAt,
        status: "ACTIVE",
      },
    });
    await tx.libraryCopy.update({ where: { id: copy.id }, data: { status: "ON_LOAN" } });
    // Fulfil any pending reservation for this item by this borrower.
    await tx.libraryReservation.updateMany({
      where: { tenantId, itemId: copy.itemId, status: "PENDING", ...(input.studentId ? { studentId: input.studentId } : { userId: input.borrowerUserId }) },
      data: { status: "FULFILLED" },
    });
    return loan;
  }).then(async (loan) => {
    await recordAudit({ actor, action: "library.loan.create", resource: "LibraryLoan", resourceId: loan.id });
    return loan;
  });
}

/** Return a loan; computes any overdue fine from the tenant rate. */
export async function returnItem(actor: Actor, loanId: string, input: { waiveFine?: boolean } = {}) {
  authorizeAny(actor, ["library.borrow", "library.manage"]);
  const tenantId = requireTenantId(actor);
  const rate = await finePerDay(tenantId);

  return prisma.$transaction(async (tx) => {
    const loan = await tx.libraryLoan.findFirst({ where: { id: loanId, tenantId }, include: { copy: true } });
    if (!loan) throw Errors.notFound("Loan not found.");
    if (loan.status === "RETURNED") throw Errors.conflict("This loan has already been returned.");

    const now = new Date();
    const overdueDays = Math.max(0, Math.ceil((now.getTime() - loan.dueAt.getTime()) / (24 * 60 * 60 * 1000)));
    const fineAmount = input.waiveFine ? 0 : overdueDays * rate;

    const updated = await tx.libraryLoan.update({
      where: { id: loan.id },
      data: { returnedAt: now, status: "RETURNED", fineAmount },
    });
    await tx.libraryCopy.update({ where: { id: loan.copyId }, data: { status: "AVAILABLE" } });
    return { loan: updated, overdueDays, fineAmount, waived: !!input.waiveFine };
  }).then(async (result) => {
    await recordAudit({ actor, action: "library.loan.return", resource: "LibraryLoan", resourceId: loanId, after: { fineAmount: result.fineAmount } });
    return result;
  });
}

export async function listLoans(actor: Actor, opts: { status?: string; studentId?: string; overdueOnly?: boolean } = {}) {
  authorize(actor, "library.read");
  const tenantId = requireTenantId(actor);
  const now = new Date();
  return prisma.libraryLoan.findMany({
    where: {
      tenantId,
      ...(opts.studentId ? { studentId: opts.studentId } : {}),
      ...(opts.status ? { status: opts.status as never } : {}),
      ...(opts.overdueOnly ? { status: "ACTIVE", dueAt: { lt: now } } : {}),
    },
    orderBy: { borrowedAt: "desc" },
    take: 200,
    include: {
      student: { select: { id: true, fullName: true, studentNumber: true } },
      copy: { select: { barcode: true, item: { select: { id: true, title: true } } } },
    },
  });
}

export async function reserveItem(actor: Actor, input: { itemId: string; studentId?: string }) {
  authorize(actor, "library.read");
  const tenantId = requireTenantId(actor);
  const item = await prisma.libraryItem.findFirst({ where: { id: input.itemId, tenantId, deletedAt: null }, select: { id: true } });
  if (!item) throw Errors.notFound("Library item not found.");
  const reservation = await prisma.libraryReservation.create({
    data: { tenantId, itemId: item.id, studentId: input.studentId || null, userId: input.studentId ? null : actor.userId },
  });
  await recordAudit({ actor, action: "library.reservation.create", resource: "LibraryReservation", resourceId: reservation.id });
  return reservation;
}

/** Borrowed/overdue items for the current actor (student or guardian's children). */
export async function getMyLoans(actor: Actor) {
  const tenantId = requireTenantId(actor);
  const studentIds: string[] = [];
  const student = await prisma.student.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null }, select: { id: true } });
  if (student) studentIds.push(student.id);
  const guardian = await prisma.guardian.findFirst({ where: { tenantId, userId: actor.userId, deletedAt: null }, select: { id: true } });
  if (guardian) {
    const links = await prisma.studentGuardian.findMany({ where: { guardianId: guardian.id }, select: { studentId: true } });
    studentIds.push(...links.map((l) => l.studentId));
  }
  return prisma.libraryLoan.findMany({
    where: { tenantId, OR: [{ borrowerUserId: actor.userId }, ...(studentIds.length ? [{ studentId: { in: studentIds } }] : [])] },
    orderBy: { borrowedAt: "desc" },
    include: { copy: { select: { barcode: true, item: { select: { title: true, author: true } } } } },
  });
}

export async function getLibraryStats(actor: Actor) {
  authorize(actor, "library.read");
  const tenantId = requireTenantId(actor);
  const [items, copies, active, overdue] = await Promise.all([
    prisma.libraryItem.count({ where: { tenantId, deletedAt: null } }),
    prisma.libraryCopy.count({ where: { tenantId } }),
    prisma.libraryLoan.count({ where: { tenantId, status: "ACTIVE" } }),
    prisma.libraryLoan.count({ where: { tenantId, status: "ACTIVE", dueAt: { lt: new Date() } } }),
  ]);
  return { items, copies, activeLoans: active, overdue };
}

// Small local alias to keep the import list short and explicit.
function authorizeAny(actor: Actor, perms: ("library.borrow" | "library.manage" | "library.read")[]) {
  if (!can(actor, "library.manage") && !perms.some((p) => can(actor, p))) {
    throw Errors.forbidden();
  }
}
