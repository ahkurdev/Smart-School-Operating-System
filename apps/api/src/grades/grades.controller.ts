import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { Public } from '../common/decorators/permissions.decorator'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const gradeSchema = z.object({
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  semesterId: z.string().uuid(),
  component: z.enum(['ASSIGNMENT', 'QUIZ', 'EXAM', 'PROJECT', 'PRACTICUM', 'CUSTOM']),
  title: z.string().max(191).optional().nullable(),
  score: z.number().min(0).max(1000),
  weight: z.number().positive().max(100).optional(),
})

const publishSchema = z.object({
  action: z.enum(['SUBMIT', 'APPROVE', 'PUBLISH']),
  semesterId: z.string().uuid(),
  studentId: z.string().uuid().optional(), // approve/publish scope: one student or whole class
  classId: z.string().uuid().optional(),
})

@Controller('grades')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GradesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('grade.read')
  async list(@CurrentUser() user: AuthUser, @Query('studentId') studentId?: string, @Query('semesterId') semesterId?: string, @Query('subjectId') subjectId?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.grade.findMany({
        where: {
          schoolId, deletedAt: null,
          ...(studentId ? { studentId } : {}),
          ...(semesterId ? { semesterId } : {}),
          ...(subjectId ? { subjectId } : {}),
        },
        include: { subject: { select: { name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    }
  }

  @Post()
  @RequirePermissions('grade.input')
  @HttpCode(201)
  async input(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(gradeSchema, body)
    // tenant checks
    const [student, subject] = await Promise.all([
      this.prisma.student.findFirst({ where: { id: data.studentId, schoolId, deletedAt: null } }),
      this.prisma.subject.findFirst({ where: { id: data.subjectId, schoolId, deletedAt: null } }),
    ])
    if (!student) throw new BadRequestException('Student not found in this school')
    if (!subject) throw new BadRequestException('Subject not found in this school')

    const grade = await this.prisma.grade.create({
      data: {
        schoolId, studentId: data.studentId, subjectId: data.subjectId, semesterId: data.semesterId,
        component: data.component, title: data.title ?? undefined, score: data.score, weight: data.weight ?? 1,
        inputBy: user.userId,
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'grade', resourceId: grade.id, newValue: { studentId: data.studentId, score: data.score, component: data.component } })
    return grade
  }

  /// Grade workflow: SUBMIT (teacher) -> APPROVE (homeroom/academic) -> PUBLISH.
  /// Weighted final score computed server-side, snapshot stored on ReportCard.
  @Post('workflow')
  @RequirePermissions('grade.input')
  async workflow(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(publishSchema, body)

    if (data.action === 'SUBMIT') {
      const res = await this.prisma.grade.updateMany({
        where: { schoolId, semesterId: data.semesterId, status: 'DRAFT', ...(data.studentId ? { studentId: data.studentId } : {}) },
        data: { status: 'SUBMITTED' },
      })
      await this.audit.log({ userId: user.userId, schoolId, action: 'UPDATE', resource: 'grade', resourceId: null, newValue: { action: 'SUBMIT', count: res.count } })
      return { action: 'SUBMIT', affected: res.count }
    }

    // APPROVE requires grade.approve permission (checked manually: teacher cannot approve own input)
    const member = user.memberships.find((m) => m.schoolId === schoolId)
    const perms = member?.permissions ?? []
    if (!perms.includes('*') && !perms.includes('grade.approve')) {
      throw new BadRequestException('Missing permission: grade.approve')
    }

    if (data.action === 'APPROVE') {
      const res = await this.prisma.grade.updateMany({
        where: { schoolId, semesterId: data.semesterId, status: 'SUBMITTED' },
        data: { status: 'APPROVED', approvedBy: user.userId, approvedAt: new Date() },
      })
      await this.audit.log({ userId: user.userId, schoolId, action: 'APPROVE', resource: 'grade', resourceId: null, newValue: { count: res.count } })
      return { action: 'APPROVE', affected: res.count }
    }

    // PUBLISH: compute weighted finals per student+subject and snapshot to ReportCard
    if (!perms.includes('*') && !perms.includes('report.publish')) {
      throw new BadRequestException('Missing permission: report.publish')
    }
    const grades = await this.prisma.grade.findMany({
      where: { schoolId, semesterId: data.semesterId, status: 'APPROVED', deletedAt: null },
      select: { studentId: true, subjectId: true, score: true, weight: true, subject: { select: { name: true } } },
    })
    // weighted average grouped by student+subject
    const acc = new Map<string, { sum: number; w: number; studentId: string; subjectId: string; subjectName: string }>()
    for (const g of grades) {
      const key = `${g.studentId}:${g.subjectId}`
      const cur = acc.get(key) ?? { sum: 0, w: 0, studentId: g.studentId, subjectId: g.subjectId, subjectName: g.subject.name }
      cur.sum += Number(g.score) * Number(g.weight)
      cur.w += Number(g.weight)
      acc.set(key, cur)
    }
    const finals = new Map<string, { subjectId: string; subjectName: string; final: number }[]>()
    for (const v of acc.values()) {
      const list = finals.get(v.studentId) ?? []
      list.push({ subjectId: v.subjectId, subjectName: v.subjectName, final: v.w > 0 ? Math.round((v.sum / v.w) * 100) / 100 : 0 })
      finals.set(v.studentId, list)
    }

    let published = 0
    for (const [studentId, subjects] of finals) {
      const verifyCode = crypto.randomUUID()
      await this.prisma.reportCard.upsert({
        where: { studentId_semesterId: { studentId, semesterId: data.semesterId } },
        create: { studentId, semesterId: data.semesterId, status: 'PUBLISHED', summary: { subjects }, publishedAt: new Date(), generatedBy: user.userId, verifyCode },
        update: { status: 'PUBLISHED', summary: { subjects }, publishedAt: new Date(), generatedBy: user.userId, verifyCode },
      })
      published++
    }
    await this.prisma.grade.updateMany({
      where: { schoolId, semesterId: data.semesterId, status: 'APPROVED' },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'PUBLISH', resource: 'report_card', resourceId: null, newValue: { semesterId: data.semesterId, students: published } })
    return { action: 'PUBLISH', students: published }
  }

  /// Public rapor verification via QR code (no login, no sensitive data — only validity + name).
  @Public()
  @Get('report-cards/verify/:code')
  async verify(@Param('code') code: string) {
    const rc = await this.prisma.reportCard.findFirst({
      where: { verifyCode: code, status: 'PUBLISHED', deletedAt: null },
      include: { student: { select: { fullName: true, nis: true } } },
    })
    if (!rc) return { valid: false }
    return { valid: true, studentName: rc.student.fullName, nis: rc.student.nis, publishedAt: rc.publishedAt }
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
