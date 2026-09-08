import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const visitSchema = z.object({
  studentId: z.string().uuid(),
  complaint: z.string().min(2).max(1000),
  firstAid: z.string().max(1000).optional().nullable(),
  temperatureC: z.number().min(30).max(45).optional().nullable(),
  bloodPressure: z.string().max(20).optional().nullable(),
  parentContacted: z.boolean().optional(),
  referredTo: z.string().max(191).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

const busSchema = z.object({
  plateNumber: z.string().min(3).max(20),
  capacity: z.number().int().min(1).max(100),
  driverName: z.string().max(100).optional().nullable(),
  driverPhone: z.string().max(30).optional().nullable(),
  gpsDeviceId: z.string().max(100).optional().nullable(),
})

const routeSchema = z.object({
  name: z.string().min(2).max(100),
  departTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  stops: z.array(z.object({
    name: z.string().min(1).max(100),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    lat: z.number().optional(),
    lng: z.number().optional(),
  })).optional().nullable(),
})

@Controller('ops')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OpsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- UKS (private health data) ----

  @Get('uks/visits')
  @RequirePermissions('uks.read')
  async listVisits(@CurrentUser() user: AuthUser, @Query('studentId') studentId?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.uksVisit.findMany({
        where: { schoolId, deletedAt: null, ...(studentId ? { studentId } : {}) },
        include: { student: { select: { nis: true, fullName: true } } },
        orderBy: { visitAt: 'desc' },
        take: 200,
      }),
    }
  }

  @Post('uks/visits')
  @RequirePermissions('uks.manage')
  async createVisit(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(visitSchema, body)
    const student = await this.prisma.student.findFirst({ where: { id: data.studentId, schoolId, deletedAt: null } })
    if (!student) throw new BadRequestException('Student not found in this school')
    const visit = await this.prisma.uksVisit.create({
      data: {
        schoolId, studentId: data.studentId, complaint: data.complaint,
        firstAid: data.firstAid ?? undefined,
        temperatureC: data.temperatureC ?? undefined,
        bloodPressure: data.bloodPressure ?? undefined,
        parentContacted: data.parentContacted ?? false,
        referredTo: data.referredTo ?? undefined, notes: data.notes ?? undefined,
        recordedBy: user.userId,
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'uks_visit', resourceId: visit.id, newValue: { studentId: data.studentId } })
    return visit
  }

  // ---- Canteen ----

  @Get('canteen/vendors')
  async listVendors(@CurrentUser() user: AuthUser) {
    return {
      items: await this.prisma.canteenVendor.findMany({
        where: { schoolId: this.requireSchool(user), deletedAt: null },
        include: { menus: { where: { deletedAt: null } } },
      }),
    }
  }

  @Post('canteen/vendors')
  @RequirePermissions('facility.manage')
  async createVendor(@CurrentUser() user: AuthUser, @Body() body: { name: string; phone?: string }) {
    const schoolId = this.requireSchool(user)
    if (!body?.name || String(body.name).length < 2) throw new BadRequestException('name required')
    return this.prisma.canteenVendor.create({ data: { schoolId, name: String(body.name).slice(0, 100), phone: body.phone ?? undefined } })
  }

  @Post('canteen/vendors/:id/menus')
  @RequirePermissions('facility.manage')
  async addMenu(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: { name: string; price: number }) {
    const vendor = await this.prisma.canteenVendor.findFirst({ where: { id, schoolId: this.requireSchool(user), deletedAt: null } })
    if (!vendor) throw new BadRequestException('Vendor not found')
    if (!body?.name || !Number.isFinite(Number(body.price)) || Number(body.price) <= 0) throw new BadRequestException('name and positive price required')
    return this.prisma.canteenMenu.create({ data: { vendorId: id, name: String(body.name).slice(0, 100), price: Number(body.price) } })
  }

  // ---- Transport ----

  @Get('buses')
  async listBuses(@CurrentUser() user: AuthUser) {
    return {
      items: await this.prisma.bus.findMany({
        where: { schoolId: this.requireSchool(user), deletedAt: null },
        include: { routes: { where: { deletedAt: null } } },
      }),
    }
  }

  @Post('buses')
  @RequirePermissions('facility.manage')
  async createBus(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(busSchema, body)
    const bus = await this.prisma.bus.create({ data: { ...data, schoolId } })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'bus', resourceId: bus.id, newValue: { plateNumber: bus.plateNumber } })
    return bus
  }

  @Post('buses/:id/routes')
  @RequirePermissions('facility.manage')
  async addRoute(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(routeSchema, body)
    const bus = await this.prisma.bus.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!bus) throw new BadRequestException('Bus not found')
    return this.prisma.busRoute.create({ data: { busId: id, name: data.name, departTime: data.departTime ?? undefined, stops: (data.stops ?? undefined) as object | undefined } })
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
