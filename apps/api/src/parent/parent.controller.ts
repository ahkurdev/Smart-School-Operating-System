import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import * as argon2 from 'argon2'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(191),
  studentId: z.string().uuid(),
  relation: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER']).optional(),
  // temp password until parent resets; in production this goes via email/WA invite
  tempPassword: z.string().min(8).max(128),
})

/// Parent portal API. Parent sees ONLY their linked children (via Guardian table).
/// Authorization: every query filters guardian.userId = current user.
@Controller('parent')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ParentController {
  constructor(private readonly prisma: PrismaService) {}

  /// My children list.
  @Get('children')
  async children(@CurrentUser() user: AuthUser) {
    const guardians = await this.prisma.guardian.findMany({
      where: { userId: user.userId, deletedAt: null },
      include: { student: { select: { id: true, nis: true, fullName: true, gender: true, status: true } } },
    })
    return {
      items: guardians.map((g) => ({ ...g.student, relation: g.relation, isPrimary: g.isPrimary })),
    }
  }

  /// Child attendance in date range (default: last 30 days).
  @Get('children/:studentId/attendance')
  async childAttendance(
    @CurrentUser() user: AuthUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query('from') fromQ?: string,
    @Query('to') toQ?: string,
  ) {
    await this.assertMyChild(user, studentId)
    const to = toQ ? new Date(toQ + 'T23:59:59.999Z') : new Date()
    if (!toQ) to.setHours(23, 59, 59, 999)
    const from = fromQ ? new Date(fromQ + 'T00:00:00.000Z') : new Date(Date.now() - 30 * 24 * 3600 * 1000)
    if (!fromQ) from.setHours(0, 0, 0, 0)
    const records = await this.prisma.attendance.findMany({
      where: { schoolId: user.memberships[0]?.schoolId ?? '', personId: studentId, personKind: 'STUDENT', date: { gte: from, lte: to } },
      select: { date: true, status: true, note: true },
      orderBy: { date: 'desc' },
    })
    const summary: Record<string, number> = {}
    for (const r of records) summary[r.status] = (summary[r.status] ?? 0) + 1
    return { items: records, summary }
  }

  /// Child grades (PUBLISHED only).
  @Get('children/:studentId/grades')
  async childGrades(@CurrentUser() user: AuthUser, @Param('studentId', ParseUUIDPipe) studentId: string) {
    await this.assertMyChild(user, studentId)
    const grades = await this.prisma.grade.findMany({
      where: { studentId, status: 'PUBLISHED', deletedAt: null },
      select: { subject: { select: { name: true } }, component: true, score: true, weight: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    })
    // weighted final per subject
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

  /// Child published report cards (with verify code so parent can verify authenticity).
  @Get('children/:studentId/report-cards')
  async childReportCards(@CurrentUser() user: AuthUser, @Param('studentId', ParseUUIDPipe) studentId: string) {
    await this.assertMyChild(user, studentId)
    return {
      items: await this.prisma.reportCard.findMany({
        where: { studentId, status: 'PUBLISHED', deletedAt: null },
        select: { id: true, verifyCode: true, publishedAt: true, summary: true },
        orderBy: { publishedAt: 'desc' },
      }),
    }
  }

  /// Child invoices + payments (parent sees billing for own child only).
  @Get('children/:studentId/invoices')
  async childInvoices(@CurrentUser() user: AuthUser, @Param('studentId', ParseUUIDPipe) studentId: string) {
    await this.assertMyChild(user, studentId)
    const invoices = await this.prisma.invoice.findMany({
      where: { studentId, deletedAt: null },
      select: {
        id: true, number: true, amount: true, discount: true, status: true, period: true,
        feeItem: { select: { name: true } },
        payments: { where: { deletedAt: null }, select: { amount: true, method: true, paidAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const items = invoices.map((inv) => {
      const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
      return { ...inv, paid, due: Math.max(0, Number(inv.amount) - Number(inv.discount) - paid) }
    })
    return { items, totalDue: items.reduce((s, i) => s + i.due, 0) }
  }

  /// Admin/operator: link a parent user to a student (creates user if needed).
  @Post('link')
  @RequirePermissions('student.update')
  async link(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = inviteSchema.safeParse(body)
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
    const data = parsed.data
    const schoolId = user.memberships[0]?.schoolId
    if (!schoolId) throw new BadRequestException('No school context')

    const student = await this.prisma.student.findFirst({ where: { id: data.studentId, schoolId, deletedAt: null } })
    if (!student) throw new BadRequestException('Student not found in this school')

    // find or create parent user
    let parent = await this.prisma.user.findFirst({ where: { email: data.email.toLowerCase(), deletedAt: null } })
    let created = false
    if (!parent) {
      parent = await this.prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash: await argon2.hash(data.tempPassword),
          fullName: data.fullName,
        },
      })
      created = true
    }
    const dup = await this.prisma.guardian.findFirst({ where: { userId: parent.id, studentId: data.studentId, deletedAt: null } })
    if (dup) throw new BadRequestException('Parent already linked')
    const guardian = await this.prisma.guardian.create({
      data: { userId: parent.id, studentId: data.studentId, schoolId, relation: data.relation ?? 'GUARDIAN' },
    })
    // membership as ORTU in this school
    await this.prisma.membership.upsert({
      where: { userId_schoolId_role: { userId: parent.id, schoolId, role: 'ORTU' } },
      update: {},
      create: { userId: parent.id, schoolId, role: 'ORTU' },
    })
    return { guardianId: guardian.id, parentUserId: parent.id, created }
  }

  private async assertMyChild(user: AuthUser, studentId: string): Promise<void> {
    const g = await this.prisma.guardian.findFirst({ where: { userId: user.userId, studentId, deletedAt: null } })
    if (!g) throw new BadRequestException('Not your child')
  }
}
