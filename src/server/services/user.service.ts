import { prisma } from "@/server/db/client";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { hashPassword } from "@/server/auth/password";
import { randomToken } from "@/server/auth/random";
import { recordAudit } from "@/server/services/audit.service";
import { requireTenantId } from "@/server/db/tenant";
import type { Actor } from "@/types/actor";

/**
 * User & membership management. Creating a user with a tenant membership and
 * roles is done in one transaction so a person is never half-provisioned.
 */

export type ListUsersParams = {
  search?: string;
  status?: "ACTIVE" | "INVITED" | "INACTIVE";
  roleKey?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 20;

export async function listUsers(actor: Actor, params: ListUsersParams = {}) {
  authorize(actor, "user.read");
  const tenantId = requireTenantId(actor);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  const where = {
    tenantId,
    ...(params.status ? { status: params.status } : {}),
    ...(params.roleKey
      ? { userRoles: { some: { role: { key: params.roleKey } } } }
      : {}),
    ...(params.search
      ? {
          user: {
            OR: [
              { fullName: { contains: params.search, mode: "insensitive" as const } },
              { email: { contains: params.search, mode: "insensitive" as const } },
              { username: { contains: params.search, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.membership.findMany({
      where,
      select: {
        id: true,
        status: true,
        title: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            preferredName: true,
            email: true,
            username: true,
            status: true,
            lastLoginAt: true,
          },
        },
        userRoles: { select: { role: { select: { key: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.membership.count({ where }),
  ]);

  return {
    items: rows.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      fullName: m.user.fullName,
      preferredName: m.user.preferredName,
      email: m.user.email,
      username: m.user.username,
      userStatus: m.user.status,
      membershipStatus: m.status,
      title: m.title,
      roles: m.userRoles.map((ur) => ({ key: ur.role.key, name: ur.role.name })),
      lastLoginAt: m.user.lastLoginAt,
      createdAt: m.createdAt,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export type CreateUserInput = {
  fullName: string;
  email?: string;
  username?: string;
  password?: string;
  title?: string;
  roleKeys?: string[];
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING";
  /** When true and no password is given, generate one and return it once. */
  generatePassword?: boolean;
};

export type CreateUserResult = {
  userId: string;
  membershipId: string;
  /** Present only when a password was generated (shown once, never stored plain). */
  temporaryPassword?: string;
};

export async function createUser(
  actor: Actor,
  input: CreateUserInput,
): Promise<CreateUserResult> {
  authorize(actor, "user.create");
  const tenantId = requireTenantId(actor);

  if (!input.email && !input.username) {
    throw Errors.validation("Provide an email or a username.", {
      email: ["An email or username is required."],
    });
  }

  // Uniqueness across both identifiers.
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        ...(input.email ? [{ email: input.email.toLowerCase() }] : []),
        ...(input.username ? [{ username: input.username.toLowerCase() }] : []),
      ],
    },
    select: { id: true },
  });
  if (existing) {
    throw Errors.conflict("A user with that email or username already exists.");
  }

  let tempPassword: string | undefined;
  let plainPassword = input.password;
  if (!plainPassword && input.generatePassword) {
    tempPassword = randomToken(9).replace(/[-_]/g, "a").slice(0, 12);
    plainPassword = tempPassword;
  }
  if (!plainPassword) {
    throw Errors.validation("Provide a password or enable generation.", {
      password: ["A password is required."],
    });
  }

  const passwordHash = await hashPassword(plainPassword);

  const roles = await prisma.role.findMany({
    where: { tenantId, key: { in: input.roleKeys ?? [] } },
    select: { id: true, key: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName: input.fullName.trim(),
        email: input.email ? input.email.toLowerCase() : null,
        username: input.username ? input.username.toLowerCase() : null,
        passwordHash,
        status: input.status ?? "ACTIVE",
        mustChangePassword: Boolean(tempPassword),
      },
      select: { id: true },
    });
    const membership = await tx.membership.create({
      data: {
        tenantId,
        userId: user.id,
        status: "ACTIVE",
        title: input.title?.trim() || null,
      },
      select: { id: true },
    });
    if (roles.length > 0) {
      await tx.userRole.createMany({
        data: roles.map((r) => ({ membershipId: membership.id, roleId: r.id })),
        skipDuplicates: true,
      });
    }
    return { userId: user.id, membershipId: membership.id };
  });

  await recordAudit({
    actor,
    action: "user.create",
    resource: "User",
    resourceId: result.userId,
    after: { email: input.email, username: input.username, roles: input.roleKeys },
  });

  return { ...result, ...(tempPassword ? { temporaryPassword: tempPassword } : {}) };
}

export type UpdateUserInput = {
  fullName?: string;
  preferredName?: string | null;
  email?: string | null;
  username?: string | null;
  phone?: string | null;
  title?: string | null;
};

export async function updateUser(
  actor: Actor,
  membershipId: string,
  input: UpdateUserInput,
) {
  authorize(actor, "user.update");
  const tenantId = requireTenantId(actor);

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId },
    select: { id: true, userId: true },
  });
  if (!membership) throw Errors.notFound("That user was not found in this school.");

  if (input.email) {
    const clash = await prisma.user.findFirst({
      where: { email: input.email.toLowerCase(), id: { not: membership.userId } },
      select: { id: true },
    });
    if (clash) throw Errors.conflict("That email is already in use.");
  }
  if (input.username) {
    const clash = await prisma.user.findFirst({
      where: { username: input.username.toLowerCase(), id: { not: membership.userId } },
      select: { id: true },
    });
    if (clash) throw Errors.conflict("That username is already in use.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: membership.userId },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
        ...(input.preferredName !== undefined ? { preferredName: input.preferredName } : {}),
        ...(input.email !== undefined
          ? { email: input.email ? input.email.toLowerCase() : null }
          : {}),
        ...(input.username !== undefined
          ? { username: input.username ? input.username.toLowerCase() : null }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
    }),
    ...(input.title !== undefined
      ? [
          prisma.membership.update({
            where: { id: membershipId },
            data: { title: input.title },
          }),
        ]
      : []),
  ]);

  await recordAudit({
    actor,
    action: "user.update",
    resource: "User",
    resourceId: membership.userId,
    after: input,
  });
}

/** Replace a user's roles within a tenant. */
export async function setUserRoles(
  actor: Actor,
  membershipId: string,
  roleKeys: string[],
) {
  authorize(actor, "role.update");
  const tenantId = requireTenantId(actor);

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId },
    select: { id: true, userId: true },
  });
  if (!membership) throw Errors.notFound();

  const roles = await prisma.role.findMany({
    where: { tenantId, key: { in: roleKeys } },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { membershipId } }),
    prisma.userRole.createMany({
      data: roles.map((r) => ({ membershipId, roleId: r.id })),
      skipDuplicates: true,
    }),
  ]);

  await recordAudit({
    actor,
    action: "user.set_roles",
    resource: "Membership",
    resourceId: membershipId,
    after: { roleKeys },
  });
}

export async function setUserStatus(
  actor: Actor,
  membershipId: string,
  status: "ACTIVE" | "INACTIVE",
) {
  authorize(actor, "user.update");
  const tenantId = requireTenantId(actor);
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId },
    select: { id: true, userId: true },
  });
  if (!membership) throw Errors.notFound();

  // Deactivating a membership also deactivates the global user if they have no
  // other active membership (prevents dangling logins).
  await prisma.$transaction(async (tx) => {
    await tx.membership.update({ where: { id: membershipId }, data: { status } });
    if (status !== "ACTIVE") {
      const otherActive = await tx.membership.count({
        where: { userId: membership.userId, status: "ACTIVE", id: { not: membershipId } },
      });
      if (otherActive === 0) {
        await tx.user.update({
          where: { id: membership.userId },
          data: { status: "INACTIVE" },
        });
      }
    } else {
      await tx.user.update({ where: { id: membership.userId }, data: { status: "ACTIVE" } });
    }
  });

  await recordAudit({
    actor,
    action: "user.set_status",
    resource: "Membership",
    resourceId: membershipId,
    after: { status },
  });
}

/** Reset another user's password, returning a one-time temporary password. */
export async function resetUserPassword(
  actor: Actor,
  membershipId: string,
): Promise<{ temporaryPassword: string }> {
  authorize(actor, "user.reset_password");
  const tenantId = requireTenantId(actor);
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId },
    select: { id: true, userId: true },
  });
  if (!membership) throw Errors.notFound();

  const temporaryPassword = randomToken(9).replace(/[-_]/g, "a").slice(0, 12);
  const passwordHash = await hashPassword(temporaryPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: membership.userId },
      data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
    }),
    prisma.session.updateMany({
      where: { userId: membership.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await recordAudit({
    actor,
    action: "user.reset_password",
    resource: "User",
    resourceId: membership.userId,
  });

  return { temporaryPassword };
}

/** List the roles available in the tenant (for the role picker). */
export async function listTenantRoles(actor: Actor) {
  authorize(actor, "role.read");
  const tenantId = requireTenantId(actor);
  return prisma.role.findMany({
    where: { tenantId },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      isSystem: true,
      _count: { select: { rolePermissions: true } },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
}
