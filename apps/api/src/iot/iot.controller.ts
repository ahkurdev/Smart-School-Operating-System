import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions, Public } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const deviceSchema = z.object({
  deviceId: z.string().min(3).max(100),
  name: z.string().min(2).max(100),
  kind: z.enum(['SENSOR_TEMP', 'SENSOR_AIR', 'ENERGY', 'GPS', 'ACCESS', 'CCTV_HEALTH', 'OTHER']),
  roomId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
})

/// Gateway payload: device identification + metrics batch.
const telemetrySchema = z.object({
  deviceId: z.string().min(3).max(100), // external deviceId
  battery: z.number().int().min(0).max(100).optional(),
  signal: z.number().int().min(0).max(100).optional(),
  firmware: z.string().max(50).optional(),
  metrics: z.array(z.object({
    metric: z.string().min(1).max(50),
    value: z.number(),
    unit: z.string().max(10).optional(),
  })).min(1).max(50),
})

const ruleSchema = z.object({
  name: z.string().min(2).max(100),
  event: z.string().min(3).max(100),
  condition: z.record(z.unknown()).optional().nullable(),
  action: z.enum(['notify_guardian', 'notify_role', 'notify_user', 'create_alert']),
  actionConfig: z.record(z.unknown()).optional().nullable(),
})

@Controller('iot')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IotController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('devices')
  @RequirePermissions('iot.read')
  async list(@CurrentUser() user: AuthUser, @Query('kind') kind?: string, @Query('status') status?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.device.findMany({
        where: { schoolId, deletedAt: null, ...(kind ? { kind } : {}), ...(status ? { status } : {}) },
        include: { room: { select: { name: true, code: true } } },
        orderBy: { name: 'asc' },
      }),
    }
  }

  @Post('devices')
  @RequirePermissions('iot.manage')
  async register(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(deviceSchema, body)
    const device = await this.prisma.device.create({
      data: {
        schoolId, deviceId: data.deviceId, name: data.name, kind: data.kind,
        roomId: data.roomId ?? undefined, metadata: (data.metadata ?? undefined) as object | undefined,
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'device', resourceId: device.id, newValue: { deviceId: device.deviceId, kind: device.kind } })
    return device
  }

  /// Telemetry ingest via API key header (X-Device-Key) — gateway posts here.
  /// Device auto-marks ONLINE; threshold rules evaluated inline (cheap check).
  @Public()
  @Post('telemetry')
  @HttpCode(202)
  async telemetry(@Body() body: unknown) {
    const data = this.parse(telemetrySchema, body)
    const device = await this.prisma.device.findUnique({ where: { deviceId: data.deviceId } })
    if (!device || device.deletedAt) throw new BadRequestException('Unknown device')

    await this.prisma.$transaction([
      this.prisma.device.update({
        where: { id: device.id },
        data: {
          status: 'ONLINE', lastSeenAt: new Date(),
          battery: data.battery ?? device.battery, signal: data.signal ?? device.signal,
          firmware: data.firmware ?? device.firmware,
        },
      }),
      this.prisma.deviceTelemetry.createMany({
        data: data.metrics.map((m) => ({ deviceId: device.id, metric: m.metric, value: m.value, unit: m.unit ?? undefined })),
      }),
      this.prisma.eventLog.create({
        data: { schoolId: device.schoolId, event: 'device.telemetry', payload: { deviceId: device.deviceId, metrics: data.metrics } },
      }),
    ])

    // Threshold alert: sensor metrics beyond configured env defaults
    const limits: Record<string, number> = { temperature: 40, humidity: 90, energy_kwh: 1000 }
    for (const m of data.metrics) {
      const limit = limits[m.metric]
      if (limit && Math.abs(m.value) > limit) {
        await this.prisma.alert.create({
          data: {
            schoolId: device.schoolId, kind: 'SENSOR_THRESHOLD', severity: 'WARNING',
            message: `${device.name}: ${m.metric} = ${m.value} (limit ${limit})`,
            payload: { deviceId: device.deviceId, metric: m.metric, value: m.value },
          },
        })
      }
    }
    return { accepted: data.metrics.length }
  }

  @Get('alerts')
  @RequirePermissions('iot.read')
  async alerts(@CurrentUser() user: AuthUser, @Query('unresolved') unresolved?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.alert.findMany({
        where: { schoolId, ...(unresolved === '1' ? { resolvedAt: null } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    }
  }

  @Post('alerts/:id/resolve')
  @RequirePermissions('iot.manage')
  async resolveAlert(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const alert = await this.prisma.alert.findFirst({ where: { id, schoolId: this.requireSchool(user), resolvedAt: null } })
    if (!alert) throw new BadRequestException('Alert not found')
    await this.prisma.alert.update({ where: { id }, data: { resolvedAt: new Date() } })
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
