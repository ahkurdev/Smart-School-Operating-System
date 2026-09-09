import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Post, Body, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { z } from 'zod'

/// Student self-service portal. Every read resolves the caller's own student
/// record via student.userId — a student can never see another student's data.
@Controller('student')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentController {
  constructor(private readonly prisma: PrismaService) {}

  private async myStudent(user: AuthUser) {
    const schoolId = user.memberships[0]?.schoolId
    if (!schoolId) throw new BadRequestException('No school context')
    const student = await this.prisma.student.findFirst({
      where: { userId: user.userId, schoolId, deletedAt: null },
      select: { id: true, schoolId: true, nis: true, fullName: true, gender: true, status: true },
    })
    if (!student) throw new BadRequestException('No student profile linked to this account')
    return student
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const student = await this.myStudent(user)
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId: student.id, deletedAt: null },
      include: { class: { select: { id: true, name: true, gradeLevel: true } }, academicYear: { select: { id: true, name: true, isCurrent: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { ...student, enrollment }
  }

  @Get('me/timetable')
  async timetable(@CurrentUser() user: AuthUser) {
    const student = await this.myStudent(user)
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId: student.id, deletedAt: null, academicYear: { isCurrent: true } },
      select: { classId: true },
    })
    if (!enrollment) return { items: [] }
    return {
      items: await this.prisma.timetableSlot.findMany({
        where: { classId: enrollment.classId, deletedAt: null },
        include: {
          subject: { select: { name: true, code: true } },
          room: { select: { name: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
    }
  }

  @Get('me/assignments')
  async assignments(@CurrentUser() user: AuthUser) {
    const student = await this.myStudent(user)
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId: student.id, deletedAt: null, academicYear: { isCurrent: true } },
      select: { classId: true },
    })
    if (!enrollment) return { items: [] }
    const courses = await this.prisma.course.findMany({
      where: { classId: enrollment.classId, deletedAt: null },
      select: {
        id: true, name: true,
        subject: { select: { name: true } },
        assignments: {
          where: { deletedAt: null },
          select: {
            id: true, title: true, kind: true, dueAt: true, maxScore: true,
            submissions: { where: { studentId: student.id, deletedAt: null }, select: { id: true, status: true, score: true, submittedAt: true } },
          },
          orderBy: { dueAt: 'asc' },
        },
      },
    })
    return { items: courses }
  }

  @Get('me/grades')
  async grades(@CurrentUser() user: AuthUser) {
    const student = await this.myStudent(user)
    const grades = await this.prisma.grade.findMany({
      where: { studentId: student.id, status: 'PUBLISHED', deletedAt: null },
      select: { subject: { select: { name: true } }, component: true, score: true, weight: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    })
    const acc = new Map<string, { sum: number; w: number }>()
    for (const g of grades) {
      const cur = acc.get(g.subject.name) ?? { sum: 0, w: 0 }
      cur.sum += Number(g.score) * Number(g.weight)
      cur.w += Number(g.weight)
      acc.set(g.subject.name, cur)
    }
    const finals = Array.from(acc.entries()).map(([subject, v]) => ({
      subject,
      final: v.w > 0 ? Math.round((v.sum / v.w) * 100) / 100 : 0,
    }))
    return { grades, finals }
  }

  @Get('me/attendance')
  async attendance(
    @CurrentUser() user: AuthUser,
    @Query('from') fromQ?: string,
    @Query('to') toQ?: string,
  ) {
    const student = await this.myStudent(user)
    const to = toQ ? new Date(toQ + 'T23:59:59.999Z') : new Date()
    if (!toQ) to.setHours(23, 59, 59, 999)
    const from = fromQ ? new Date(fromQ + 'T00:00:00.000Z') : new Date(Date.now() - 30 * 24 * 3600 * 1000)
    if (!fromQ) from.setHours(0, 0, 0, 0)
    const records = await this.prisma.attendance.findMany({
      where: { schoolId: student.schoolId, personId: student.id, personKind: 'STUDENT', date: { gte: from, lte: to } },
      select: { date: true, status: true, note: true },
      orderBy: { date: 'desc' },
    })
    const summary: Record<string, number> = {}
    for (const r of records) summary[r.status] = (summary[r.status] ?? 0) + 1
    return { items: records, summary }
  }

  /// Admin: link a login user to a student record (enables portal + CBT).
  @Post(':id/link-user')
  @RequirePermissions('student.update')
  async linkUser(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const schoolId = user.memberships[0]?.schoolId
    if (!schoolId) throw new BadRequestException('No school context')
    const parsed = z.object({ userId: z.string().uuid() }).safeParse(body)
    if (!parsed.success) throw new BadRequestException('userId required')
    const student = await this.prisma.student.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!student) throw new BadRequestException('Student not found in this school')
    const target = await this.prisma.user.findFirst({ where: { id: parsed.data.userId, deletedAt: null } })
    if (!target) throw new BadRequestException('User not found')
    const taken = await this.prisma.student.findFirst({ where: { userId: target.id, deletedAt: null, id: { not: id } } })
    if (taken) throw new BadRequestException('User already linked to another student')
    await this.prisma.student.update({ where: { id }, data: { userId: target.id } })
    await this.prisma.membership.upsert({
      where: { userId_schoolId_role: { userId: target.id, schoolId, role: 'SISWA' } },
      update: {},
      create: { userId: target.id, schoolId, role: 'SISWA' },
    })
    return { ok: true, studentId: id, userId: target.id }
  }
}
