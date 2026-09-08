import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const ekskulSchema = z.object({
  name: z.string().min(2).max(100),
  kind: z.enum(['CLUB', 'OSIS', 'TEAM']).optional(),
  schedule: z.string().max(191).optional().nullable(),
  coachUserId: z.string().uuid().optional().nullable(),
})

const memberSchema = z.object({
  studentId: z.string().uuid(),
  role: z.string().max(50).optional().nullable(),
})

const achievementSchema = z.object({
  studentId: z.string().uuid(),
  title: z.string().min(2).max(191),
  type: z.enum(['AKADEMIK', 'NON_AKADEMIK', 'OLAHRAGA', 'SENI']),
  level: z.enum(['SCHOOL', 'DISTRICT', 'PROVINCE', 'NATIONAL', 'INTERNATIONAL']).optional(),
  rank: z.number().int().min(1).max(10).optional().nullable(),
  year: z.number().int().min(2000).max(2100),
})

@Controller('ekskul')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EkskulController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('ekskul.read')
  async list(@CurrentUser() user: AuthUser) {
    return {
      items: await this.prisma.extracurricular.findMany({
        where: { schoolId: this.requireSchool(user), deletedAt: null },
        include: { _count: { select: { members: { where: { deletedAt: null } } } } },
        orderBy: { name: 'asc' },
      }),
    }
  }

  @Post()
  @RequirePermissions('ekskul.manage')
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(ekskulSchema, body)
    const ekskul = await this.prisma.extracurricular.create({
      data: { schoolId, name: data.name, kind: data.kind ?? 'CLUB', schedule: data.schedule ?? undefined, coachUserId: data.coachUserId ?? undefined },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'extracurricular', resourceId: ekskul.id, newValue: { name: ekskul.name } })
    return ekskul
  }

  @Post(':id/members')
  @RequirePermissions('ekskul.manage')
  async addMember(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(memberSchema, body)
    const ekskul = await this.prisma.extracurricular.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!ekskul) throw new BadRequestException('Extracurricular not found')
    const student = await this.prisma.student.findFirst({ where: { id: data.studentId, schoolId, deletedAt: null } })
    if (!student) throw new BadRequestException('Student not found in this school')
    const dup = await this.prisma.extracurricularMember.findFirst({ where: { extracurricularId: id, studentId: data.studentId, deletedAt: null } })
    if (dup) throw new BadRequestException('Student already a member')
    return this.prisma.extracurricularMember.create({ data: { extracurricularId: id, studentId: data.studentId, role: data.role ?? undefined } })
  }

  @Post('achievements')
  @RequirePermissions('ekskul.read')
  async addAchievement(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(achievementSchema, body)
    const student = await this.prisma.student.findFirst({ where: { id: data.studentId, schoolId, deletedAt: null } })
    if (!student) throw new BadRequestException('Student not found in this school')
    const achievement = await this.prisma.achievement.create({
      data: {
        schoolId, studentId: data.studentId, title: data.title, type: data.type,
        level: data.level ?? 'SCHOOL', rank: data.rank ?? undefined, year: data.year,
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'achievement', resourceId: achievement.id, newValue: { title: achievement.title, level: achievement.level } })
    return achievement
  }

  @Get('achievements')
  @RequirePermissions('ekskul.read')
  async listAchievements(@CurrentUser() user: AuthUser, @Query('studentId') studentId?: string, @Query('year') year?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.achievement.findMany({
        where: {
          schoolId, deletedAt: null,
          ...(studentId ? { studentId } : {}),
          ...(year ? { year: Number(year) } : {}),
        },
        include: { student: { select: { nis: true, fullName: true } } },
        orderBy: { year: 'desc' },
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
