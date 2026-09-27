import bcrypt from "bcryptjs";

/**
 * Password hashing. bcrypt with a work factor of 12 (a good 2024+ balance of
 * security and latency on typical server hardware). Verification uses the
 * library's constant-time compare.
 */
const WORK_FACTOR = 12;

/** Password policy, enforced server-side on register/change/reset. */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, WORK_FACTOR);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Validate a candidate password against the policy. Returns null when valid, or
 * a human-readable reason when not. Kept intentionally simple and dependency-free
 * (no zxcvbn) so registration stays fast; length is the strongest lever.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (/^\s|\s$/.test(password)) {
    return "Password must not start or end with a space.";
  }
  // Require at least two character classes to discourage trivial passwords.
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(password),
  ).length;
  if (classes < 2) {
    return "Use a mix of letters, numbers, or symbols.";
  }
  return null;
}
