"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/context";
import { isAppError } from "@/server/errors";
import {
  createAsset,
  updateAssetCondition,
  addMaintenance,
  createFacility,
  requestBooking,
  decideBooking,
} from "@/server/services/asset.service";

export type AssetResult = { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(e: unknown): AssetResult {
  if (isAppError(e)) return { ok: false, error: e.userMessage };
  throw e;
}
function fieldErrorsFrom(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] = i.message;
  return out;
}

export async function createAssetAction(_prev: AssetResult | null, formData: FormData): Promise<AssetResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      assetCode: z.string().trim().min(1, "Asset code is required").max(60),
      name: z.string().trim().min(1, "Name is required").max(200),
      category: z.string().trim().max(120).optional().or(z.literal("")),
      campusId: z.string().optional().or(z.literal("")),
      location: z.string().trim().max(160).optional().or(z.literal("")),
      condition: z.enum(["NEW", "GOOD", "FAIR", "POOR", "BROKEN"]).optional(),
      acquisitionCost: z.coerce.number().min(0).optional(),
      serialNumber: z.string().trim().max(120).optional().or(z.literal("")),
      notes: z.string().trim().max(2000).optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({
      assetCode: formData.get("assetCode"),
      name: formData.get("name"),
      category: formData.get("category") ?? undefined,
      campusId: formData.get("campusId") ?? undefined,
      location: formData.get("location") ?? undefined,
      condition: formData.get("condition") ?? undefined,
      acquisitionCost: formData.get("acquisitionCost") || undefined,
      serialNumber: formData.get("serialNumber") ?? undefined,
      notes: formData.get("notes") ?? undefined,
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    const asset = await createAsset(actor, {
      assetCode: parsed.data.assetCode,
      name: parsed.data.name,
      category: parsed.data.category || "General",
      campusId: parsed.data.campusId || undefined,
      location: parsed.data.location || undefined,
      condition: parsed.data.condition,
      acquisitionCost: parsed.data.acquisitionCost,
      serialNumber: parsed.data.serialNumber || undefined,
      notes: parsed.data.notes || undefined,
    });
    revalidatePath("/app/assets");
    return { ok: true, id: asset.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateAssetConditionAction(assetId: string, condition: "NEW" | "GOOD" | "FAIR" | "POOR" | "BROKEN" | "DISPOSED"): Promise<AssetResult> {
  try {
    const actor = await requireActor();
    await updateAssetCondition(actor, assetId, condition);
    revalidatePath("/app/assets");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addMaintenanceAction(_prev: AssetResult | null, formData: FormData): Promise<AssetResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      assetId: z.string().min(1),
      description: z.string().trim().min(1, "Description is required").max(2000),
      cost: z.coerce.number().min(0).optional(),
      performedBy: z.string().trim().max(160).optional().or(z.literal("")),
      nextDueAt: z.string().optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({
      assetId: formData.get("assetId"),
      description: formData.get("description"),
      cost: formData.get("cost") || undefined,
      performedBy: formData.get("performedBy") ?? undefined,
      nextDueAt: formData.get("nextDueAt") ?? undefined,
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    await addMaintenance(actor, parsed.data.assetId, {
      description: parsed.data.description,
      cost: parsed.data.cost,
      performedBy: parsed.data.performedBy || undefined,
      nextDueAt: parsed.data.nextDueAt ? new Date(parsed.data.nextDueAt) : undefined,
    });
    revalidatePath("/app/assets");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createFacilityAction(_prev: AssetResult | null, formData: FormData): Promise<AssetResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      name: z.string().trim().min(1, "Name is required").max(200),
      type: z.string().trim().max(80).optional().or(z.literal("")),
      capacity: z.coerce.number().int().min(0).optional(),
      location: z.string().trim().max(160).optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({
      name: formData.get("name"),
      type: formData.get("type") ?? undefined,
      capacity: formData.get("capacity") || undefined,
      location: formData.get("location") ?? undefined,
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    const facility = await createFacility(actor, {
      name: parsed.data.name,
      type: parsed.data.type || "ROOM",
      capacity: parsed.data.capacity,
      location: parsed.data.location || undefined,
    });
    revalidatePath("/app/facilities");
    return { ok: true, id: facility.id };
  } catch (e) {
    return fail(e);
  }
}

export async function requestBookingAction(_prev: AssetResult | null, formData: FormData): Promise<AssetResult> {
  try {
    const actor = await requireActor();
    const schema = z.object({
      facilityId: z.string().optional().or(z.literal("")),
      purpose: z.string().trim().min(1, "Purpose is required").max(300),
      startAt: z.string().min(1, "Start time is required"),
      endAt: z.string().min(1, "End time is required"),
    });
    const parsed = schema.safeParse({
      facilityId: formData.get("facilityId") ?? undefined,
      purpose: formData.get("purpose"),
      startAt: formData.get("startAt"),
      endAt: formData.get("endAt"),
    });
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
    const booking = await requestBooking(actor, {
      facilityId: parsed.data.facilityId || undefined,
      purpose: parsed.data.purpose,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      autoApprove: true,
    });
    revalidatePath("/app/facilities");
    return { ok: true, id: booking.id };
  } catch (e) {
    return fail(e);
  }
}

export async function decideBookingAction(bookingId: string, decision: "APPROVED" | "REJECTED" | "CANCELLED"): Promise<AssetResult> {
  try {
    const actor = await requireActor();
    await decideBooking(actor, bookingId, decision);
    revalidatePath("/app/facilities");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
