import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const bulkSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // personId = studentId
  entries: z.array(z.object({
    personId: z.string().uuid(),
    status: z.enum(['PRESENT', 'SICK', 'EXCUSED', 'ABSENT', 'LATE', 'EARLY_LEAVE']),
    note: z.string().max(300).optional().nullable(),
    method: z.enum(['MANUAL', 'QR', 'RFID', 'NFC', 'PROVIDER']).optional(),
  })).min(1).max(200),
})

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  classId: z.string().uuid().optional(),
  status: z.enum(['PRESENT', 'SICK', 'EXCUSED', 'ABSENT', 'LATE', 'EARLY_LEAVE']).optional(),
})

@Controller('attendance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController {
  constructor(private readonly prisma: PrismaService) {}

  /// Record attendance in bulk (one class, one date). Upsert per person+date.
  @Post()
  @RequirePermissions('attendance.manage')
  @HttpCode(201)
  async record(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(bulkSchema, body)
    const date = new Date(data.date + 'T00:00:00.000Z')

    // Validate all students belong to this school (tenant safety)
    const ids = data.entries.map((e) => e.personId)
    const students = await this.prisma.student.findMany({
      where: { id: { in: ids }, schoolId, deletedAt: null },
      select: { id: true },
    })
    const valid = new Set(students.map((s) => s.id))
    const invalid = ids.filter((id) => !valid.has(id))
    if (invalid.length > 0) throw new BadRequestException(`Students not in this school: ${invalid.join(', ')}`)

    await this.prisma.$transaction(
      data.entries.map((e) =>
        this.prisma.attendance.upsert({
          where: { personId_personKind_date: { personId: e.personId, personKind: 'STUDENT', date } },
          create: {
            schoolId, personId: e.personId, personKind: 'STUDENT', date,
            status: e.status, note: e.note ?? undefined, method: e.method ?? 'MANUAL', recordedBy: user.userId,
          },
          update: { status: e.status, note: e.note ?? undefined, method: e.method ?? 'MANUAL', recordedBy: user.userId },
        }),
      ),
    )
    return { recorded: data.entries.length, date: data.date }
  }

  /// List attendance; if classId given, returns per-student status for date range.
  @Get()
  @RequirePermissions('attendance.read')
  async list(@CurrentUser() user: AuthUser, @Query('date') date?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('classId') classId?: string, @Query('status') status?: string) {
    const schoolId = this.requireSchool(user)
    this.parse(querySchema, { date, from, to, classId, status })
    const where: Prisma.AttendanceWhereInput = {
      schoolId,
      personKind: 'STUDENT',
      ...(date ? { date: new Date(date + 'T00:00:00.000Z') } : {}),
      ...((from || to) && {
        date: {
          ...(from ? { gte: new Date(from + 'T00:00:00.000Z') } : {}),
          ...(to ? { lte: new Date(to + 'T00:00:00.000Z') } : {}),
        },
      }),
      ...(status ? { status: status as Prisma.EnumAttendanceStatusFilter } : {}),
      ...(classId && {
        person: {
          enrollments: { some: { classId, deletedAt: null } },
        },
      }),
    }
    const [items, summary] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        orderBy: { date: 'desc' },
        take: 500,
      }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
    ])
    return {
      items,
      summary: Object.fromEntries(summary.map((s) => [s.status, (s._count as { _all: number })._all])),
    }
  }

  /// Daily absence list for a date (for "who is absent today").
  @Get('absent')
  @RequirePermissions('attendance.read')
  async absentToday(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    const schoolId = this.requireSchool(user)
    const d = date ?? new Date().toISOString().slice(0, 10)
    const items = await this.prisma.attendance.findMany({
      where: {
        schoolId,
        date: new Date(d + 'T00:00:00.000Z'),
        personKind: 'STUDENT',
        status: { in: ['ABSENT', 'SICK', 'EXCUSED', 'LATE'] },
      },
    })
    const byId = Object.fromEntries(items.map((i) => [i.personId, i.status]))
    const students = await this.prisma.student.findMany({
      where: { id: { in: items.map((i) => i.personId) }, schoolId, deletedAt: null },
      select: { id: true, nis: true, fullName: true },
    })
    return { date: d, items: students.map((s) => ({ ...s, status: byId[s.id] })) }
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
