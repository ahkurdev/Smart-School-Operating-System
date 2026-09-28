/**
 * Assets & facilities end-to-end test (Phases 73-74).
 *
 * Proves:
 *   - assets are tenant-isolated and asset codes are unique per tenant;
 *   - condition changes and maintenance records are auditable;
 *   - a facility booking is refused when it overlaps an existing booking for the
 *     same facility, and non-overlapping bookings succeed;
 *   - a non-manager's booking starts PENDING, a manager's booking is APPROVED.
 */
import { prisma } from "@/server/db/client";
import type { Actor } from "@/types/actor";
import {
  createAsset,
  getAsset,
  updateAssetCondition,
  addMaintenance,
  listAssets,
  createFacility,
  requestBooking,
  listBookings,
} from "@/server/services/asset.service";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL ${name}`);
  }
}
async function expectError(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(name, false);
  } catch {
    check(name, true);
  }
}
function actorFor(tenantId: string, userId: string, permissions: string[]): Actor {
  return { userId, tenantId, roles: [], roleKeys: [], permissions: new Set(permissions), isPlatform: false } as unknown as Actor;
}

const MANAGE = ["asset.read", "asset.manage", "facility.read", "facility.manage", "facility.book"];
const BOOKER = ["facility.read", "facility.book"];

async function main() {
  const suffix = Date.now().toString(36);
  const tenant = await prisma.tenant.create({ data: { slug: `ast-${suffix}`, name: "AST" }, select: { id: true } });
  const other = await prisma.tenant.create({ data: { slug: `ast2-${suffix}`, name: "AST2" }, select: { id: true } });
  const tenantId = tenant.id;

  const mgrUser = await prisma.user.create({ data: { email: `ast-mgr-${suffix}@x.dev`, fullName: "Mgr", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });
  const staffUser = await prisma.user.create({ data: { email: `ast-staff-${suffix}@x.dev`, fullName: "Staff", passwordHash: "x", status: "ACTIVE" }, select: { id: true } });

  const mgr = actorFor(tenantId, mgrUser.id, MANAGE);
  const staff = actorFor(tenantId, staffUser.id, BOOKER);

  // --- assets ---------------------------------------------------------------
  const asset = await createAsset(mgr, { assetCode: `AST-${suffix}`, name: "Projector", category: "AV", location: "Room 1" });
  check("asset created with default GOOD condition", asset.condition === "GOOD");
  const fetched = await getAsset(mgr, asset.id);
  check("asset retrievable", fetched.id === asset.id);
  await expectError("duplicate asset code refused", () => createAsset(mgr, { assetCode: `AST-${suffix}`, name: "Other", category: "AV" }));

  await updateAssetCondition(mgr, asset.id, "FAIR");
  check("condition updated", (await getAsset(mgr, asset.id)).condition === "FAIR");

  await addMaintenance(mgr, asset.id, { description: "Bulb replaced", cost: 25000 });
  check("maintenance recorded", (await getAsset(mgr, asset.id)).maintenanceRecords.length === 1);

  const foreign = actorFor(other.id, mgrUser.id, MANAGE);
  await expectError("assets tenant-isolated", () => getAsset(foreign, asset.id));
  check("foreign asset list empty", (await listAssets(foreign)).length === 0);

  // --- facilities & bookings ------------------------------------------------
  const facility = await createFacility(mgr, { name: "Main Hall", type: "HALL", capacity: 200 });
  const base = new Date("2030-01-10T09:00:00Z");
  const oneHour = 60 * 60 * 1000;

  const b1 = await requestBooking(mgr, { facilityId: facility.id, purpose: "Assembly", startAt: base, endAt: new Date(base.getTime() + oneHour), autoApprove: true });
  check("manager booking is auto-APPROVED", b1.status === "APPROVED");

  const b2 = await requestBooking(staff, { facilityId: facility.id, purpose: "Meeting", startAt: new Date(base.getTime() + 2 * oneHour), endAt: new Date(base.getTime() + 3 * oneHour) });
  check("non-manager booking is PENDING", b2.status === "PENDING");

  await expectError("overlapping booking refused", () =>
    requestBooking(staff, { facilityId: facility.id, purpose: "Clash", startAt: new Date(base.getTime() + 30 * 60 * 1000), endAt: new Date(base.getTime() + 90 * 60 * 1000) }),
  );

  const b3 = await requestBooking(staff, { facilityId: facility.id, purpose: "Later", startAt: new Date(base.getTime() + 3 * oneHour), endAt: new Date(base.getTime() + 4 * oneHour) });
  check("non-overlapping booking succeeds", b3.status === "PENDING");

  const bookings = await listBookings(mgr, { facilityId: facility.id });
  check("bookings listed", bookings.length === 3);

  // --- cleanup --------------------------------------------------------------
  try {
    await prisma.facilityBooking.deleteMany({ where: { tenantId } });
    await prisma.facility.deleteMany({ where: { tenantId } });
    await prisma.assetMaintenance.deleteMany({ where: { tenantId } });
    await prisma.asset.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { id: { in: [mgrUser.id, staffUser.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, other.id] } } });
  } catch (e) {
    console.error("cleanup warning:", (e as Error).message);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
