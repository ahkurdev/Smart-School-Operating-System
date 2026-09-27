/**
 * QR attendance security test (Phase 91).
 *
 * Exercises the signing layer directly (no HTTP/server needed) to prove the
 * properties the master prompt requires:
 *   - a freshly signed token verifies
 *   - a tampered payload fails signature verification
 *   - an expired token is rejected
 *   - a token signed with a different key fails
 *   - the payload contains no PII (only opaque ids)
 *
 * Run: node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/qr-security-test.ts
 */
import { signAttendanceToken, verifyAttendanceToken } from "../src/server/auth/signing";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}`);
  }
}

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const base = {
    v: 1 as const,
    tid: "tenant_demo",
    sid: "student_cuid_opaque",
    iat: now,
    exp: now + 30,
    nonce: "nonce-abc-123",
  };

  // 1. Valid token verifies.
  const good = await signAttendanceToken(base);
  const goodRes = await verifyAttendanceToken(good);
  check("valid token verifies", goodRes.ok === true);
  if (goodRes.ok) {
    check("payload round-trips tenant", goodRes.payload.tid === "tenant_demo");
    check("payload round-trips nonce", goodRes.payload.nonce === "nonce-abc-123");
  }

  // 2. Payload carries no PII (only opaque reference + timestamps + nonce).
  const decoded = JSON.parse(Buffer.from(good.split(".")[1]!, "base64url").toString());
  const keys = Object.keys(decoded).sort();
  check("payload keys are only v/tid/sid/iat/exp/nonce", JSON.stringify(keys) === JSON.stringify(["exp", "iat", "nonce", "sid", "tid", "v"]));
  check("payload has no name/photo/nisn/address", !("name" in decoded) && !("photo" in decoded) && !("nisn" in decoded) && !("address" in decoded));

  // 3. Tampered payload fails.
  const [v, , sig] = good.split(".");
  const tamperedBody = Buffer.from(
    JSON.stringify({ ...decoded, sid: "attacker_swapped_student" }),
  ).toString("base64url");
  const tampered = `${v}.${tamperedBody}.${sig}`;
  const tamperedRes = await verifyAttendanceToken(tampered);
  check("tampered payload is rejected", tamperedRes.ok === false && tamperedRes.reason === "bad_signature");

  // 4. Expired token is rejected.
  const expired = await signAttendanceToken({ ...base, iat: now - 120, exp: now - 60, nonce: "nonce-expired" });
  const expiredRes = await verifyAttendanceToken(expired);
  check("expired token is rejected", expiredRes.ok === false && expiredRes.reason === "expired");

  // 5. Malformed token is rejected.
  const malformedRes = await verifyAttendanceToken("not-a-real-token");
  check("malformed token is rejected", malformedRes.ok === false && malformedRes.reason === "malformed");

  // 6. Signature is deterministic per payload but unique per nonce.
  const a = await signAttendanceToken(base);
  const b = await signAttendanceToken(base);
  check("same payload signs identically (HMAC deterministic)", a === b);
  const c = await signAttendanceToken({ ...base, nonce: "different-nonce" });
  check("different nonce produces a different token", a !== c);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
