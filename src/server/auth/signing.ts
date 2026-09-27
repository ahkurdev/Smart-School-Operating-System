import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

/** Constant-time string comparison for signatures/secrets. */
function timingSafeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Signing utilities.
 *
 * - `signSessionJwt` / `verifySessionJwt` produce the opaque session cookie
 *   payload (a random session id reference; the DB is the source of truth).
 * - `signAttendanceToken` / `verifyAttendanceToken` produce and check the
 *   short-lived QR token. The QR token is an HMAC-signed, base64url payload with
 *   no PII, per ARCHITECTURE.md ADR-0004.
 */

let sessionKey: Uint8Array | null = null;
let attendanceKey: Uint8Array | null = null;

/** Derive a fixed-length key (as Uint8Array) from a configured secret string. */
function keyFrom(secret: string): Uint8Array {
  return new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32));
}

/** A fresh, ArrayBuffer-backed copy for WebCrypto (avoids ArrayBufferLike typing). */
function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

function getSessionKey(): Uint8Array {
  if (!sessionKey) sessionKey = keyFrom(getEnv().SESSION_SECRET);
  return sessionKey;
}

function getAttendanceKey(): Uint8Array {
  if (!attendanceKey) attendanceKey = keyFrom(getEnv().ATTENDANCE_SIGNING_KEY);
  return attendanceKey;
}

export type SessionClaims = JWTPayload & {
  /** Session row id. Used to look up the authoritative session in the DB. */
  sid: string;
  /** User id, for a cheap sanity check before the DB lookup. */
  uid: string;
};

export async function signSessionJwt(claims: SessionClaims): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSessionKey());
}

export async function verifySessionJwt(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionKey(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.sid !== "string" || typeof payload.uid !== "string") {
      return null;
    }
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Attendance QR token
// ---------------------------------------------------------------------------

export type AttendanceTokenPayload = {
  /** Token format version. */
  v: 1;
  /** Tenant the student belongs to. */
  tid: string;
  /** Student id (opaque cuid, not PII). */
  sid: string;
  /** Issued-at, unix seconds. */
  iat: number;
  /** Expires-at, unix seconds. */
  exp: number;
  /** Single-use nonce; consumed on successful attendance. */
  nonce: string;
};

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Sign an attendance token. Format: `v1.<payloadB64>.<sigB64>`, HMAC-SHA256 over
 * the payload. No name, photo, or national id is ever included.
 */
export async function signAttendanceToken(
  payload: AttendanceTokenPayload,
): Promise<string> {
  const body = b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    toBufferSource(getAttendanceKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `v1.${body}.${b64url(Buffer.from(sig))}`;
}

export type AttendanceVerifyResult =
  | { ok: true; payload: AttendanceTokenPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export async function verifyAttendanceToken(
  token: string,
): Promise<AttendanceVerifyResult> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    return { ok: false, reason: "malformed" };
  }
  const body = parts[1]!;
  const sig = parts[2]!;

  const key = await crypto.subtle.importKey(
    "raw",
    toBufferSource(getAttendanceKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  const expectedB64 = b64url(Buffer.from(expected));
  // Timing-safe comparison so a valid-but-wrong signature leaks no timing.
  if (!timingSafeEqualString(expectedB64, sig)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: AttendanceTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const tolerance = getEnv().ATTENDANCE_CLOCK_TOLERANCE_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || now > payload.exp + tolerance) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}
