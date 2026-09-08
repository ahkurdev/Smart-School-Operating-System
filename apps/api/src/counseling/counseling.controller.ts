import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const recordSchema = z.object({
  studentId: z.string().uuid(),
  category: z.enum(['AKADEMIK', 'KELUARGA', 'MENTAL', 'DISIPLIN', 'KARIR', 'LAIN']),
  title: z.string().min(2).max(191),
  notes: z.string().max(50_000).optional().nullable(),
  action: z.string().max(50_000).optional().nullable(),
  followUpAt: z.string().datetime().optional().nullable(),
})

@Controller('counseling')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CounselingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('counseling.read')
  async list(@CurrentUser() user: AuthUser, @Query('studentId') studentId?: string, @Query('status') status?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.counselingRecord.findMany({
        where: {
          schoolId, deletedAt: null,
          ...(studentId ? { studentId } : {}),
          ...(status ? { status: status as never } : {}),
        },
        // student identity limited; notes only in detail view (audited)
        select: {
          id: true, studentId: true, category: true, status: true, title: true,
          followUpAt: true, referredTo: true, createdAt: true,
          student: { select: { nis: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    }
  }

  /// Detail view includes confidential notes — audited as READ_SENSITIVE.
  @Get(':id')
  @RequirePermissions('counseling.read')
  async detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const schoolId = this.requireSchool(user)
    const rec = await this.prisma.counselingRecord.findFirst({
      where: { id, schoolId, deletedAt: null },
      include: { student: { select: { nis: true, fullName: true } } },
    })
    if (!rec) throw new BadRequestException('Record not found')
    await this.audit.log({
      userId: user.userId, schoolId, action: 'READ_SENSITIVE', resource: 'counseling_record', resourceId: id,
      ip: req.ip, userAgent: req.headers['user-agent'],
    })
    return rec
  }

  @Post()
  @RequirePermissions('counseling.manage')
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(recordSchema, body)
    const student = await this.prisma.student.findFirst({ where: { id: data.studentId, schoolId, deletedAt: null } })
    if (!student) throw new BadRequestException('Student not found in this school')
    const rec = await this.prisma.counselingRecord.create({
      data: {
        schoolId, studentId: data.studentId, counselorUserId: user.userId,
        category: data.category, title: data.title, status: 'SCHEDULED',
        notes: data.notes ?? undefined, action: data.action ?? undefined,
        followUpAt: data.followUpAt ? new Date(data.followUpAt) : undefined,
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'counseling_record', resourceId: rec.id, newValue: { studentId: data.studentId, category: data.category } })
    return { id: rec.id }
  }

  @Post(':id/complete')
  @RequirePermissions('counseling.manage')
  async complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: { notes?: string; action?: string; referredTo?: string; parentMeetingAt?: string }) {
    const schoolId = this.requireSchool(user)
    const rec = await this.prisma.counselingRecord.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!rec) throw new BadRequestException('Record not found')
    await this.prisma.counselingRecord.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        notes: body.notes ?? rec.notes,
        action: body.action ?? rec.action,
        referredTo: body.referredTo ?? rec.referredTo,
        parentMeetingAt: body.parentMeetingAt ? new Date(body.parentMeetingAt) : rec.parentMeetingAt,
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'UPDATE', resource: 'counseling_record', resourceId: id, newValue: { status: 'COMPLETED' } })
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
