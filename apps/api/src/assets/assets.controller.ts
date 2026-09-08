import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const assetSchema = z.object({
  name: z.string().min(2).max(191),
  category: z.enum(['ELECTRONIC', 'FURNITURE', 'VEHICLE', 'LAB', 'SPORT', 'OTHER']),
  serialNumber: z.string().max(100).optional().nullable(),
  roomId: z.string().uuid().optional().nullable(),
  purchaseDate: z.string().datetime().optional().nullable(),
  value: z.number().min(0).optional().nullable(),
  vendor: z.string().max(191).optional().nullable(),
  warrantyUntil: z.string().datetime().optional().nullable(),
})

const maintenanceSchema = z.object({
  description: z.string().min(2).max(1000),
  scheduledAt: z.string().datetime().optional().nullable(),
  cost: z.number().min(0).optional().nullable(),
})

@Controller('assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssetsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('asset.read')
  async list(@CurrentUser() user: AuthUser, @Query('category') category?: string, @Query('condition') condition?: string, @Query('roomId') roomId?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.asset.findMany({
        where: {
          schoolId, deletedAt: null,
          ...(category ? { category } : {}),
          ...(condition ? { condition: condition as never } : {}),
          ...(roomId ? { roomId } : {}),
        },
        include: { room: { select: { name: true, code: true } } },
        orderBy: { name: 'asc' },
        take: 300,
      }),
    }
  }

  @Post()
  @RequirePermissions('asset.manage')
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(assetSchema, body)
    if (data.roomId) {
      const room = await this.prisma.room.findFirst({ where: { id: data.roomId, schoolId, deletedAt: null } })
      if (!room) throw new BadRequestException('Room not found in this school')
    }
    const code = `AST-${Date.now().toString(36).toUpperCase()}`
    const asset = await this.prisma.asset.create({
      data: {
        schoolId, code, name: data.name, category: data.category,
        serialNumber: data.serialNumber ?? undefined, roomId: data.roomId ?? undefined,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        value: data.value ?? undefined, vendor: data.vendor ?? undefined,
        warrantyUntil: data.warrantyUntil ? new Date(data.warrantyUntil) : undefined,
        qrPayload: code, // QR encodes the asset code; scanned -> asset detail (permission-gated)
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'asset', resourceId: asset.id, newValue: { code, name: asset.name } })
    return asset
  }

  @Post(':id/maintenance')
  @RequirePermissions('maintenance.manage')
  async scheduleMaintenance(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(maintenanceSchema, body)
    const asset = await this.prisma.asset.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!asset) throw new BadRequestException('Asset not found')
    const m = await this.prisma.assetMaintenance.create({
      data: {
        assetId: id, description: data.description,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        cost: data.cost ?? undefined, handledBy: user.userId,
      },
    })
    if (asset.condition === 'GOOD') {
      await this.prisma.asset.update({ where: { id }, data: { condition: 'NEEDS_REPAIR' } })
    }
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'asset_maintenance', resourceId: m.id, newValue: { assetCode: asset.code } })
    return m
  }

  @Post('maintenance/:mid/complete')
  @RequirePermissions('maintenance.manage')
  async completeMaintenance(@CurrentUser() user: AuthUser, @Param('mid', ParseUUIDPipe) mid: string) {
    const m = await this.prisma.assetMaintenance.findFirst({ where: { id: mid, deletedAt: null, asset: { schoolId: this.requireSchool(user) } } })
    if (!m) throw new BadRequestException('Maintenance not found')
    await this.prisma.$transaction([
      this.prisma.assetMaintenance.update({ where: { id: mid }, data: { completedAt: new Date() } }),
      this.prisma.asset.update({ where: { id: m.assetId }, data: { condition: 'GOOD' } }),
    ])
    await this.audit.log({ userId: user.userId, schoolId: this.requireSchool(user), action: 'UPDATE', resource: 'asset_maintenance', resourceId: mid, newValue: { completed: true } })
    return { ok: true }
  }

  @Get('maintenance/due')
  @RequirePermissions('asset.read')
  async dueMaintenance(@CurrentUser() user: AuthUser) {
    return {
      items: await this.prisma.assetMaintenance.findMany({
        where: { deletedAt: null, completedAt: null, asset: { schoolId: this.requireSchool(user) } },
        include: { asset: { select: { code: true, name: true, condition: true } } },
        orderBy: { scheduledAt: 'asc' },
      }),
    }
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
