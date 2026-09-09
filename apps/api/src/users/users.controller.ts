import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import * as argon2 from 'argon2'
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email().optional().nullable(),
  username: z.string().min(3).max(50).optional().nullable(),
  fullName: z.string().min(2).max(191),
  phone: z.string().max(30).optional().nullable(),
  tempPassword: z.string().min(8).max(128),
  role: z.string().min(2).max(50).optional(),
})

const resetSchema = z.object({
  tempPassword: z.string().min(8).max(128),
})

/// Admin user management. Password hashes never leave this controller.
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('user.read')
  async list(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          ...(q
            ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { username: { contains: q } }] }
            : {}),
          memberships: { some: { schoolId, deletedAt: null } },
        },
        select: {
          id: true, email: true, username: true, fullName: true, phone: true,
          status: true, lastLoginAt: true, createdAt: true,
          memberships: { where: { schoolId, deletedAt: null }, select: { role: true, isPrimary: true } },
        },
        orderBy: { fullName: 'asc' },
        take: 100,
      }),
    }
  }

  @Post()
  @RequirePermissions('user.manage')
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(createUserSchema, body)
    if (!data.email && !data.username) throw new BadRequestException('email or username required')

    const dup = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(data.email ? [{ email: data.email.toLowerCase() }] : []),
          ...(data.username ? [{ username: data.username }] : []),
        ],
      },
    })
    if (dup) throw new BadRequestException('User with this email/username already exists')

    const created = await this.prisma.user.create({
      data: {
        email: data.email?.toLowerCase() ?? undefined,
        username: data.username ?? undefined,
        passwordHash: await argon2.hash(data.tempPassword),
        fullName: data.fullName,
        phone: data.phone ?? undefined,
        memberships: data.role ? { create: { schoolId, role: data.role } } : undefined,
      },
      select: { id: true, email: true, username: true, fullName: true },
    })
    await this.audit.log({
      userId: user.userId, schoolId, action: 'CREATE', resource: 'user', resourceId: created.id,
      newValue: { email: created.email, username: created.username, role: data.role ?? null },
    })
    return created
  }

  @Post(':id/reset-password')
  @RequirePermissions('user.manage')
  async resetPassword(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(resetSchema, body)
    const target = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, memberships: { some: { schoolId, deletedAt: null } } },
    })
    if (!target) throw new BadRequestException('User not found in this school')
    await this.prisma.user.update({ where: { id }, data: { passwordHash: await argon2.hash(data.tempPassword), failedLoginCount: 0, lockedUntil: null } })
    // revoke all sessions so the new password takes effect everywhere
    await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
    await this.audit.log({ userId: user.userId, schoolId, action: 'UPDATE', resource: 'user', resourceId: id, newValue: { passwordReset: true } })
    return { ok: true }
  }

  private requireSchool(user: AuthUser): string {
    const schoolId = user.memberships[0]?.schoolId
    if (!schoolId) throw new BadRequestException('No school context')
    return schoolId
  }

  private parse<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { path: (string | number)[]; message: string }[] } } }, v: unknown): T {
    const r = schema.safeParse(v)
    if (!r.success || !r.data) {
      throw new BadRequestException((r.error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') || 'Invalid body')
    }
    return r.data
  }
}
