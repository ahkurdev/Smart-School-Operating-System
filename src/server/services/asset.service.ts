import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { recordAudit } from "@/server/services/audit.service";
import type { Actor } from "@/types/actor";

/**
 * Assets & facilities (Phases 73-74).
 *
 * Assets are inventory with maintenance history. Facilities are bookable spaces
 * (or rooms); a booking is refused when it overlaps an existing approved/pending
 * booking for the same facility or room - the overlap check runs inside the
 * transaction that creates the booking so two concurrent requests cannot both
 * win.
 */

type Condition = "NEW" | "GOOD" | "FAIR" | "POOR" | "BROKEN" | "DISPOSED";

export async function listAssets(
  actor: Actor,
  opts: { search?: string; category?: string; condition?: string } = {},
) {
  authorize(actor, "asset.read");
  const tenantId = requireTenantId(actor);
  return prisma.asset.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.condition ? { condition: opts.condition as never } : {}),
      ...(opts.search
        ? {
            OR: [
              { name: { contains: opts.search, mode: "insensitive" as const } },
              { assetCode: { contains: opts.search, mode: "insensitive" as const } },
              { serialNumber: { contains: opts.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 200,
    include: { _count: { select: { maintenanceRecords: true } }, campus: { select: { name: true } } },
  });
}

export async function getAsset(actor: Actor, id: string) {
  authorize(actor, "asset.read");
  const tenantId = requireTenantId(actor);
  const asset = await prisma.asset.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { maintenanceRecords: { orderBy: { performedAt: "desc" } }, campus: { select: { name: true } } },
  });
  if (!asset) throw Errors.notFound("Asset not found.");
  return asset;
}

export async function createAsset(
  actor: Actor,
  input: {
    assetCode: string;
    name: string;
    category: string;
    campusId?: string;
    location?: string;
    condition?: Condition;
    acquisitionDate?: Date;
    acquisitionCost?: number;
    serialNumber?: string;
    notes?: string;
  },
) {
  authorize(actor, "asset.manage");
  const tenantId = requireTenantId(actor);
  if (!input.assetCode.trim()) throw Errors.validation("An asset code is required.");
  if (!input.name.trim()) throw Errors.validation("A name is required.");
  const existing = await prisma.asset.findFirst({ where: { tenantId, assetCode: input.assetCode.trim(), deletedAt: null } });
  if (existing) throw Errors.conflict("An asset with that code already exists.");

  const asset = await prisma.asset.create({
    data: {
      tenantId,
      assetCode: input.assetCode.trim(),
      name: input.name.trim(),
      category: input.category.trim() || "General",
      campusId: input.campusId || null,
      location: input.location?.trim() || null,
      condition: (input.condition as never) ?? "GOOD",
      acquisitionDate: input.acquisitionDate ?? null,
      acquisitionCost: input.acquisitionCost ?? null,
      serialNumber: input.serialNumber?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
  await recordAudit({ actor, action: "asset.create", resource: "Asset", resourceId: asset.id });
  return asset;
}

export async function updateAssetCondition(actor: Actor, id: string, condition: Condition) {
  authorize(actor, "asset.manage");
  const tenantId = requireTenantId(actor);
  const asset = await prisma.asset.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true, condition: true } });
  if (!asset) throw Errors.notFound("Asset not found.");
  const updated = await prisma.asset.update({ where: { id }, data: { condition: condition as never } });
  await recordAudit({ actor, action: "asset.condition.update", resource: "Asset", resourceId: id, before: { condition: asset.condition }, after: { condition } });
  return updated;
}

export async function addMaintenance(
  actor: Actor,
  assetId: string,
  input: { description: string; cost?: number; performedBy?: string; performedAt?: Date; nextDueAt?: Date },
) {
  authorize(actor, "asset.manage");
  const tenantId = requireTenantId(actor);
  const asset = await prisma.asset.findFirst({ where: { id: assetId, tenantId, deletedAt: null }, select: { id: true } });
  if (!asset) throw Errors.notFound("Asset not found.");
  if (!input.description.trim()) throw Errors.validation("A description is required.");
  const record = await prisma.assetMaintenance.create({
    data: {
      tenantId,
      assetId,
      description: input.description.trim(),
      cost: input.cost ?? null,
      performedBy: input.performedBy?.trim() || null,
      performedAt: input.performedAt ?? new Date(),
      nextDueAt: input.nextDueAt ?? null,
    },
  });
  await recordAudit({ actor, action: "asset.maintenance.add", resource: "Asset", resourceId: assetId });
  return record;
}

// --- Facilities & booking ----------------------------------------------------

export async function listFacilities(actor: Actor) {
  authorize(actor, "facility.read");
  const tenantId = requireTenantId(actor);
  return prisma.facility.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
}

export async function createFacility(
  actor: Actor,
  input: { name: string; type: string; campusId?: string; capacity?: number; location?: string; description?: string; isBookable?: boolean },
) {
  authorize(actor, "facility.manage");
  const tenantId = requireTenantId(actor);
  if (!input.name.trim()) throw Errors.validation("A facility name is required.");
  const facility = await prisma.facility.create({
    data: {
      tenantId,
      name: input.name.trim(),
      type: input.type.trim() || "ROOM",
      campusId: input.campusId || null,
      capacity: input.capacity ?? null,
      location: input.location?.trim() || null,
      description: input.description?.trim() || null,
      isBookable: input.isBookable ?? true,
    },
  });
  await recordAudit({ actor, action: "facility.create", resource: "Facility", resourceId: facility.id });
  return facility;
}

/** True when [startAt,endAt) overlaps an existing non-cancelled booking. */
async function hasOverlap(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  tenantId: string,
  args: { facilityId?: string | null; roomId?: string | null; startAt: Date; endAt: Date },
): Promise<boolean> {
  const conflict = await tx.facilityBooking.findFirst({
    where: {
      tenantId,
      status: { in: ["PENDING", "APPROVED"] as never },
      AND: [
        args.facilityId ? { facilityId: args.facilityId } : {},
        args.roomId ? { roomId: args.roomId } : {},
        { startAt: { lt: args.endAt } },
        { endAt: { gt: args.startAt } },
      ],
    },
    select: { id: true },
  });
  return !!conflict;
}

export async function listBookings(actor: Actor, opts: { facilityId?: string; status?: string } = {}) {
  authorize(actor, "facility.read");
  const tenantId = requireTenantId(actor);
  return prisma.facilityBooking.findMany({
    where: {
      tenantId,
      ...(opts.facilityId ? { facilityId: opts.facilityId } : {}),
      ...(opts.status ? { status: opts.status as never } : {}),
    },
    orderBy: { startAt: "asc" },
    take: 300,
    include: { facility: { select: { id: true, name: true, type: true } }, room: { select: { id: true, name: true } } },
  });
}

export async function requestBooking(
  actor: Actor,
  input: { facilityId?: string; roomId?: string; purpose: string; startAt: Date; endAt: Date; autoApprove?: boolean },
) {
  authorize(actor, "facility.book");
  const tenantId = requireTenantId(actor);
  if (!input.facilityId && !input.roomId) throw Errors.validation("Choose a facility or a room.");
  if (!input.purpose.trim()) throw Errors.validation("A purpose is required.");
  if (input.endAt <= input.startAt) throw Errors.validation("The end time must be after the start time.");

  const canApprove = actor.permissions.has("facility.manage");

  return prisma.$transaction(async (tx) => {
    if (await hasOverlap(tx, tenantId, { facilityId: input.facilityId, roomId: input.roomId, startAt: input.startAt, endAt: input.endAt })) {
      throw Errors.conflict("That slot is already booked for this facility/room.");
    }
    const booking = await tx.facilityBooking.create({
      data: {
        tenantId,
        facilityId: input.facilityId || null,
        roomId: input.roomId || null,
        requestedByUserId: actor.userId,
        purpose: input.purpose.trim(),
        startAt: input.startAt,
        endAt: input.endAt,
        status: (input.autoApprove && canApprove ? "APPROVED" : "PENDING") as never,
        approvedByUserId: input.autoApprove && canApprove ? actor.userId : null,
      },
    });
    return booking;
  }).then(async (booking) => {
    await recordAudit({ actor, action: "facility.booking.request", resource: "FacilityBooking", resourceId: booking.id });
    return booking;
  });
}

export async function decideBooking(actor: Actor, bookingId: string, decision: "APPROVED" | "REJECTED" | "CANCELLED") {
  authorize(actor, "facility.manage");
  const tenantId = requireTenantId(actor);
  const booking = await prisma.facilityBooking.findFirst({ where: { id: bookingId, tenantId }, select: { id: true, status: true } });
  if (!booking) throw Errors.notFound("Booking not found.");
  const updated = await prisma.facilityBooking.update({
    where: { id: bookingId },
    data: { status: decision as never, approvedByUserId: actor.userId },
  });
  await recordAudit({ actor, action: `facility.booking.${decision.toLowerCase()}`, resource: "FacilityBooking", resourceId: bookingId, before: { status: booking.status }, after: { status: decision } });
  return updated;
}
