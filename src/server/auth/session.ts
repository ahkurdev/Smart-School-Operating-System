import { prisma } from "@/server/db/client";
import { randomToken, sha256 } from "@/server/auth/random";
import { signSessionJwt, verifySessionJwt } from "@/server/auth/signing";
import type { Actor } from "@/types/actor";
import type { Permission } from "@/lib/permissions";
import { isPermission } from "@/lib/permissions";

/**
 * Session service. The session cookie carries a signed JWT that references a
 * session row by id. The database row is the source of truth: revoking a row
 * (e.g. "log out other devices") invalidates the cookie even if the JWT is not
 * yet expired.
 */

export const SESSION_COOKIE = "ssos_session";
export const SESSION_TTL_DAYS = 30;

export type CreateSessionInput = {
  userId: string;
  activeTenantId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  deviceLabel?: string | null;
};

export type CreatedSession = {
  cookieValue: string;
  sessionId: string;
  expiresAt: Date;
};

/** Create a session row plus the signed cookie value to store client-side. */
export async function createSession(
  input: CreateSessionInput,
): Promise<CreatedSession> {
  // The raw browser token is random; we store only its hash. The JWT wraps the
  // session id so the cookie is tamper-evident before we hit the database.
  const rawToken = randomToken(32);
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const session = await prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash: sha256(rawToken),
      activeTenantId: input.activeTenantId ?? null,
      ipAddress: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      deviceLabel: input.deviceLabel ?? null,
      expiresAt,
    },
    select: { id: true },
  });

  const cookieValue = await signSessionJwt({ sid: session.id, uid: input.userId });
  return { cookieValue, sessionId: session.id, expiresAt };
}

/**
 * Resolve an actor from a cookie value. Returns null when the cookie is absent,
 * invalid, expired, or the session/user has been revoked or disabled.
 */
export async function resolveActorFromCookie(
  cookieValue: string | undefined,
  meta?: { ip?: string | null; userAgent?: string | null },
): Promise<Actor | null> {
  if (!cookieValue) return null;
  const claims = await verifySessionJwt(cookieValue);
  if (!claims) return null;

  const session = await prisma.session.findUnique({
    where: { id: claims.sid },
    select: {
      id: true,
      userId: true,
      activeTenantId: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          status: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.user.status !== "ACTIVE" || session.user.deletedAt) return null;
  if (session.userId !== claims.uid) return null;

  // Touch last-seen at most once per minute to avoid write amplification.
  void touchSession(session.id);

  return buildActor(session.userId, session.activeTenantId, meta);
}

let lastTouch = new Map<string, number>();
async function touchSession(sessionId: string): Promise<void> {
  const now = Date.now();
  const prev = lastTouch.get(sessionId) ?? 0;
  if (now - prev < 60_000) return;
  lastTouch.set(sessionId, now);
  if (lastTouch.size > 5000) lastTouch = new Map();
  await prisma.session
    .update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);
}

/**
 * Build an Actor with resolved permissions for the given tenant, or platform
 * permissions if the user is a platform super-admin with no tenant selected.
 */
export async function buildActor(
  userId: string,
  tenantId: string | null,
  meta?: { ip?: string | null; userAgent?: string | null },
): Promise<Actor> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!user || user.status !== "ACTIVE" || user.deletedAt) {
    return emptyActor(userId, meta);
  }

  const memberships = await prisma.membership.findMany({
    where: { userId, status: "ACTIVE" },
    select: {
      tenantId: true,
      userRoles: {
        select: {
          role: {
            select: {
              key: true,
              isSystem: true,
              rolePermissions: {
                select: { permission: { select: { key: true } } },
              },
            },
          },
        },
      },
    },
  });

  const isPlatform = memberships.some((m) =>
    m.userRoles.some((ur) => ur.role.key === "super_admin" || ur.role.isSystem && ur.role.key === "platform_admin"),
  );

  if (!tenantId) {
    return {
      userId,
      tenantId: null,
      permissions: new Set(),
      isPlatform,
      roleKeys: [],
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
    };
  }

  const membership = memberships.find((m) => m.tenantId === tenantId);
  if (!membership) {
    // The user is not a member of the requested tenant: fail closed.
    return emptyActor(userId, meta);
  }

  const permissions = new Set<Permission>();
  const roleKeys: string[] = [];
  for (const ur of membership.userRoles) {
    roleKeys.push(ur.role.key);
    for (const rp of ur.role.rolePermissions) {
      if (isPermission(rp.permission.key)) permissions.add(rp.permission.key);
    }
  }

  return {
    userId,
    tenantId,
    permissions,
    isPlatform,
    roleKeys,
    ip: meta?.ip ?? null,
    userAgent: meta?.userAgent ?? null,
  };
}

function emptyActor(
  userId: string,
  meta?: { ip?: string | null; userAgent?: string | null },
): Actor {
  return {
    userId,
    tenantId: null,
    permissions: new Set(),
    isPlatform: false,
    roleKeys: [],
    ip: meta?.ip ?? null,
    userAgent: meta?.userAgent ?? null,
  };
}

/** Revoke a single session (logout). */
export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session
    .update({ where: { id: sessionId }, data: { revokedAt: new Date() } })
    .catch(() => undefined);
}

/** Revoke every session for a user except optionally one (logout everywhere). */
export async function revokeAllSessions(
  userId: string,
  exceptSessionId?: string,
): Promise<void> {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

/** Switch the active tenant of an existing session. */
export async function setSessionTenant(
  sessionId: string,
  tenantId: string | null,
): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { activeTenantId: tenantId },
  });
}

/** List a user's active (non-revoked, unexpired) sessions for the device panel. */
export async function listSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      deviceLabel: true,
      createdAt: true,
      lastSeenAt: true,
    },
    orderBy: { lastSeenAt: "desc" },
  });
}
