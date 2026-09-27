import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { hashPassword, verifyPassword, passwordProblem } from "@/server/auth/password";
import {
  createSession,
  revokeAllSessions,
  setSessionTenant,
  type CreatedSession,
} from "@/server/auth/session";
import { rateLimit } from "@/server/auth/rate-limit";
import { randomToken, sha256 } from "@/server/auth/random";
import { getEnv } from "@/lib/env";

/**
 * Authentication service: registration, login with lockout + login history,
 * and password reset request/confirm. All functions are server-only.
 */

const MAX_FAILED_LOGINS = 8;
const LOCKOUT_MINUTES = 15;

export type LoginInput = {
  /** Email or username. */
  identifier: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
  /** Preferred tenant to activate, if the user belongs to several. */
  tenantId?: string | null;
};

export type LoginResult = CreatedSession & {
  userId: string;
  /** Tenants the user can act within, for the tenant picker. */
  memberships: {
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
  }[];
};

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

/** Look up a user by email or username (both stored lowercased where relevant). */
async function findByIdentifier(identifier: string) {
  const value = normalizeIdentifier(identifier);
  return prisma.user.findFirst({
    where: {
      OR: [{ email: value }, { username: value }],
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      username: true,
      passwordHash: true,
      status: true,
      failedLoginCount: true,
      lockedUntil: true,
      mfaEnabled: true,
    },
  });
}

async function recordLoginAttempt(params: {
  identifier: string;
  userId?: string | null;
  success: boolean;
  ip?: string | null;
  userAgent?: string | null;
  reason?: string | null;
}) {
  await prisma.loginAttempt
    .create({
      data: {
        userId: params.userId ?? null,
        identifier: params.identifier,
        success: params.success,
        ipAddress: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        reason: params.reason ?? null,
      },
    })
    .catch(() => undefined);
}

/**
 * Authenticate and create a session. Enforces rate limiting, account lockout,
 * and writes a login-history row for every attempt (success or failure).
 */
export async function login(input: LoginInput): Promise<LoginResult> {
  const identifier = normalizeIdentifier(input.identifier);

  // Coarse IP rate limit on top of per-account lockout.
  const rl = rateLimit(`login:${input.ip ?? "unknown"}`, {
    windowMs: 5 * 60_000,
    max: 30,
  });
  if (!rl.allowed) {
    await recordLoginAttempt({ identifier, success: false, ip: input.ip, userAgent: input.userAgent, reason: "rate_limited" });
    throw Errors.rateLimited();
  }

  const user = await findByIdentifier(identifier);

  // Generic failure to avoid user enumeration.
  const genericFailure = Errors.unauthenticated("Incorrect sign-in details.");

  if (!user) {
    await recordLoginAttempt({ identifier, success: false, ip: input.ip, userAgent: input.userAgent, reason: "no_user" });
    throw genericFailure;
  }

  if (user.status !== "ACTIVE") {
    await recordLoginAttempt({ identifier, userId: user.id, success: false, ip: input.ip, userAgent: input.userAgent, reason: "inactive" });
    throw Errors.forbidden("This account is not active. Contact your school administrator.");
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await recordLoginAttempt({ identifier, userId: user.id, success: false, ip: input.ip, userAgent: input.userAgent, reason: "locked" });
    throw Errors.rateLimited("This account is temporarily locked after repeated failed attempts. Try again later.");
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLoginCount + 1;
    const lockedUntil =
      failed >= MAX_FAILED_LOGINS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
        : null;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed,
        ...(lockedUntil ? { lockedUntil, failedLoginCount: 0 } : {}),
      },
    });
    await recordLoginAttempt({ identifier, userId: user.id, success: false, ip: input.ip, userAgent: input.userAgent, reason: "bad_password" });
    throw genericFailure;
  }

  // Success: reset counters, update last login, write history.
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    select: {
      tenantId: true,
      tenant: { select: { name: true, slug: true, status: true } },
    },
  });

  const usable = memberships.filter((m) => m.tenant.status === "ACTIVE");
  let activeTenantId = input.tenantId ?? null;
  if (activeTenantId && !usable.some((m) => m.tenantId === activeTenantId)) {
    activeTenantId = null;
  }
  if (!activeTenantId && usable.length === 1) {
    activeTenantId = usable[0]!.tenantId;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: input.ip ?? null,
    },
  });

  const session = await createSession({
    userId: user.id,
    activeTenantId,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  await recordLoginAttempt({ identifier, userId: user.id, success: true, ip: input.ip, userAgent: input.userAgent });

  return {
    ...session,
    userId: user.id,
    memberships: usable.map((m) => ({
      tenantId: m.tenantId,
      tenantName: m.tenant.name,
      tenantSlug: m.tenant.slug,
    })),
  };
}

export type RegisterInput = {
  email: string;
  fullName: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Self-registration. Note: this creates a *user*, not a tenant membership. For
 * staff/students, admins create memberships. Applicant self-registration is a
 * separate admission flow (Phase 34).
 */
export async function registerUser(
  input: RegisterInput,
): Promise<{ userId: string }> {
  const email = normalizeIdentifier(input.email);
  const problem = passwordProblem(input.password);
  if (problem) throw Errors.validation(problem, { password: [problem] });

  const existing = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw Errors.conflict("An account with that email already exists.");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      fullName: input.fullName.trim(),
      passwordHash,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  await recordLoginAttempt({ identifier: email, userId: user.id, success: true, ip: input.ip, userAgent: input.userAgent, reason: "registered" });
  return { userId: user.id };
}

/** Begin a password reset. Always resolves (never reveals whether email exists). */
export async function requestPasswordReset(email: string): Promise<void> {
  const value = normalizeIdentifier(email);
  const user = await prisma.user.findFirst({
    where: { email: value, deletedAt: null },
    select: { id: true, email: true },
  });
  if (!user) return;

  const raw = randomToken(32);
  const tokenHash = sha256(raw);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    },
  });

  // Delivery is a background concern (Phase 67). In dev we log the link.
  const link = `${getEnv().APP_URL}/reset-password?token=${raw}`;
  if (getEnv().EMAIL_PROVIDER === "console") {
    console.info(`[dev] password reset link for ${user.email}: ${link}`);
  }
}

/** Complete a password reset. Consumes the token and revokes all sessions. */
export async function confirmPasswordReset(
  rawToken: string,
  newPassword: string,
): Promise<void> {
  const problem = passwordProblem(newPassword);
  if (problem) throw Errors.validation(problem, { password: [problem] });

  const tokenHash = sha256(rawToken);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw Errors.validation("This reset link is invalid or has expired.");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

/** Change the current user's password, then revoke other sessions. */
export async function changeOwnPassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  keepSessionId?: string;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { passwordHash: true },
  });
  if (!user) throw Errors.notFound();

  const ok = await verifyPassword(params.currentPassword, user.passwordHash);
  if (!ok) throw Errors.validation("Your current password is not correct.");

  const problem = passwordProblem(params.newPassword);
  if (problem) throw Errors.validation(problem, { password: [problem] });

  const passwordHash = await hashPassword(params.newPassword);
  await prisma.user.update({
    where: { id: params.userId },
    data: { passwordHash },
  });
  await revokeAllSessions(params.userId, params.keepSessionId);
}

export { setSessionTenant };
