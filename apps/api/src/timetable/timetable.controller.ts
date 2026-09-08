import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const slotSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  teacherUserId: z.string().uuid(),
  roomId: z.string().uuid().optional().nullable(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
})

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd
}

@Controller('timetable')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TimetableController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('timetable.read')
  async list(@CurrentUser() user: AuthUser, @Query('classId') classId?: string, @Query('day') day?: string) {
    const schoolId = this.requireSchool(user)
    const where = {
      schoolId,
      deletedAt: null,
      ...(classId ? { classId } : {}),
      ...(day ? { dayOfWeek: Number(day) } : {}),
    }
    return {
      items: await this.prisma.timetableSlot.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true, code: true } },
          room: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
    }
  }

  @Post()
  @RequirePermissions('timetable.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(slotSchema, body)
    if (data.endTime <= data.startTime) throw new BadRequestException('endTime must be after startTime')

    // FK ownership checks (tenant safety)
    const [cls, subject] = await Promise.all([
      this.prisma.class.findFirst({ where: { id: data.classId, schoolId, deletedAt: null } }),
      this.prisma.subject.findFirst({ where: { id: data.subjectId, schoolId, deletedAt: null } }),
    ])
    if (!cls) throw new BadRequestException('Class not found in this school')
    if (!subject) throw new BadRequestException('Subject not found in this school')
    if (data.roomId) {
      const room = await this.prisma.room.findFirst({ where: { id: data.roomId, schoolId, deletedAt: null } })
      if (!room) throw new BadRequestException('Room not found in this school')
    }

    // Conflict detection: same day, overlapping time
    const sameDay = await this.prisma.timetableSlot.findMany({
      where: { schoolId, dayOfWeek: data.dayOfWeek, deletedAt: null },
      include: { class: { select: { name: true } }, subject: { select: { name: true } } },
    })

    for (const s of sameDay) {
      if (!overlaps(data.startTime, data.endTime, s.startTime, s.endTime)) continue
      if (s.teacherUserId === data.teacherUserId) {
        throw new BadRequestException(`Teacher conflict: ${s.class.name} ${s.subject.name} ${s.startTime}-${s.endTime}`)
      }
      if (s.classId === data.classId) {
        throw new BadRequestException(`Class conflict: already has ${s.subject.name} ${s.startTime}-${s.endTime}`)
      }
      if (data.roomId && s.roomId === data.roomId) {
        throw new BadRequestException(`Room conflict: used by ${s.class.name} ${s.startTime}-${s.endTime}`)
      }
    }

    const { roomId, ...rest } = data
    const slot = await this.prisma.timetableSlot.create({
      data: { ...rest, academicYearId: cls.academicYearId, schoolId, ...(roomId ? { roomId } : {}) },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'timetable_slot', resourceId: slot.id, newValue: { classId: data.classId, day: data.dayOfWeek, time: `${data.startTime}-${data.endTime}` } })
    return slot
  }

  @Delete(':id')
  @RequirePermissions('timetable.manage')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const schoolId = this.requireSchool(user)
    const slot = await this.prisma.timetableSlot.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!slot) throw new BadRequestException('Slot not found')
    await this.prisma.timetableSlot.update({ where: { id }, data: { deletedAt: new Date() } })
    await this.audit.log({ userId: user.userId, schoolId, action: 'DELETE', resource: 'timetable_slot', resourceId: id, previousValue: { day: slot.dayOfWeek, time: `${slot.startTime}-${slot.endTime}` } })
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
