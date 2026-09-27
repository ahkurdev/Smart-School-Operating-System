import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** SHA-256 hex digest, used to store session tokens and other lookups by hash. */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Cryptographically random URL-safe token (default 32 bytes -> 43 chars). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Constant-time comparison of two strings. Returns false on length mismatch
 * without leaking timing beyond the length check itself.
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Hash a password-reset / invitation token with a per-deployment pepper. */
export function hashToken(token: string, pepper: string): string {
  return sha256(`${pepper}:${token}`);
}
