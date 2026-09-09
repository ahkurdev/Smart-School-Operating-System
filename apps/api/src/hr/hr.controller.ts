import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const employeeSchema = z.object({
  nip: z.string().max(30).optional().nullable(),
  kind: z.enum(['TEACHER', 'STAFF']).optional(),
  fullName: z.string().min(2).max(191),
  position: z.string().max(100).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  qualification: z.string().max(191).optional().nullable(),
  certification: z.string().max(191).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
})

const leaveSchema = z.object({
  kind: z.enum(['SICK', 'ANNUAL', 'PERMISSION', 'OTHER']),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(1000).optional().nullable(),
})

@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HrController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('employees')
  @RequirePermissions('teacher.read')
  async list(@CurrentUser() user: AuthUser, @Query('kind') kind?: string, @Query('q') q?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.employee.findMany({
        where: {
          schoolId, deletedAt: null,
          ...(kind ? { kind: kind as never } : {}),
          ...(q ? { fullName: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { fullName: 'asc' },
      }),
    }
  }

  @Post('employees')
  @RequirePermissions('hr.manage')
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(employeeSchema, body)
    if (data.userId) {
      const u = await this.prisma.user.findFirst({ where: { id: data.userId, deletedAt: null } })
      if (!u) throw new BadRequestException('User not found')
      const linked = await this.prisma.employee.findFirst({ where: { userId: data.userId, deletedAt: null } })
      if (linked) throw new BadRequestException('User already linked to an employee')
    }
    const employee = await this.prisma.employee.create({
      data: {
        schoolId, nip: data.nip ?? undefined, kind: data.kind ?? 'TEACHER', fullName: data.fullName,
        position: data.position ?? undefined, department: data.department ?? undefined,
        qualification: data.qualification ?? undefined, certification: data.certification ?? undefined,
        userId: data.userId ?? undefined,
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'employee', resourceId: employee.id, newValue: { nip: employee.nip, fullName: employee.fullName } })
    return employee
  }

  @Post('employees/:id/leave')
  @RequirePermissions('hr.manage')
  async requestLeave(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(leaveSchema, body)
    if (data.toDate < data.fromDate) throw new BadRequestException('toDate must be after fromDate')
    const employee = await this.prisma.employee.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!employee) throw new BadRequestException('Employee not found')
    return this.prisma.employeeLeave.create({
      data: {
        employeeId: id, kind: data.kind,
        fromDate: new Date(data.fromDate + 'T00:00:00.000Z'),
        toDate: new Date(data.toDate + 'T00:00:00.000Z'),
        reason: data.reason ?? undefined,
      },
    })
  }

  @Get('leaves')
  @RequirePermissions('hr.manage')
  async listLeaves(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return {
      items: await this.prisma.employeeLeave.findMany({
        where: {
          deletedAt: null,
          ...(status ? { status: status as never } : {}),
          employee: { schoolId: this.requireSchool(user), deletedAt: null },
        },
        include: { employee: { select: { fullName: true, nip: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    }
  }

  @Post('leave/:leaveId/decide')
  @RequirePermissions('hr.manage')
  async decideLeave(@CurrentUser() user: AuthUser, @Param('leaveId', ParseUUIDPipe) leaveId: string, @Body() body: { action: 'APPROVE' | 'REJECT' }) {
    const leave = await this.prisma.employeeLeave.findFirst({ where: { id: leaveId, status: 'PENDING', deletedAt: null, employee: { schoolId: this.requireSchool(user) } } })
    if (!leave) throw new BadRequestException('Pending leave not found')
    await this.prisma.employeeLeave.update({
      where: { id: leaveId },
      data: { status: body.action === 'APPROVE' ? 'APPROVED' : 'REJECTED', approvedBy: user.userId },
    })
    await this.audit.log({ userId: user.userId, schoolId: this.requireSchool(user), action: body.action, resource: 'employee_leave', resourceId: leaveId })
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
