import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions, Public } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { z } from 'zod'

@Controller('command-center')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommandCenterController {
  constructor(private readonly prisma: PrismaService) {}

  /// One endpoint aggregating live counts for the command center / exec dashboard.
  /// All queries tenant-scoped. Uses real aggregates (no fake data).
  @Get('summary')
  @RequirePermissions('report.read')
  async summary(@CurrentUser() user: AuthUser) {
    const schoolId = this.requireSchool(user)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [students, activeStudents, teachers, todayAttendance, absentToday, devicesOnline, devicesTotal, openAlerts, unpaidInvoices, outstandingAgg, activeLoans, overdueLoans, pendingLeaves, upcomingExams] = await this.prisma.$transaction([
      this.prisma.student.count({ where: { schoolId, deletedAt: null } }),
      this.prisma.student.count({ where: { schoolId, deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.employee.count({ where: { schoolId, deletedAt: null, kind: 'TEACHER' } }),
      this.prisma.attendance.count({ where: { schoolId, date: today, personKind: 'STUDENT' } }),
      this.prisma.attendance.count({ where: { schoolId, date: today, personKind: 'STUDENT', status: { in: ['ABSENT', 'SICK', 'EXCUSED', 'LATE'] } } }),
      this.prisma.device.count({ where: { schoolId, deletedAt: null, status: 'ONLINE' } }),
      this.prisma.device.count({ where: { schoolId, deletedAt: null } }),
      this.prisma.alert.count({ where: { schoolId, resolvedAt: null } }),
      this.prisma.invoice.count({ where: { schoolId, deletedAt: null, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } } }),
      this.prisma.invoice.aggregate({
        where: { schoolId, deletedAt: null, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
        _sum: { amount: true, discount: true },
      }),
      this.prisma.bookLoan.count({ where: { schoolId, deletedAt: null, status: 'BORROWED' } }),
      this.prisma.bookLoan.count({ where: { schoolId, deletedAt: null, status: 'BORROWED', dueAt: { lt: new Date() } } }),
      this.prisma.employeeLeave.count({ where: { employee: { schoolId }, status: 'PENDING', deletedAt: null } }),
      // exam model belum ada (CBT phase terpisah) — pakai timetable hari ini sebagai "agenda akademik"
      this.prisma.timetableSlot.count({ where: { schoolId, deletedAt: null, dayOfWeek: today.getDay() === 0 ? 7 : today.getDay() } }),
    ])

    // collected = sum of payments on this school's invoices
    const paidAgg = await this.prisma.payment.aggregate({
      where: { deletedAt: null, invoice: { schoolId } },
      _sum: { amount: true },
    })

    // attendance rate today
    const rate = todayAttendance > 0 ? Math.round(((todayAttendance - absentToday) / todayAttendance) * 100) : null

    return {
      academic: { agendaToday: upcomingExams },
      students: { total: students, active: activeStudents, attendanceRateToday: rate, absentToday },
      staff: { teachers },
      finance: {
        unpaidInvoices,
        outstandingTotal: Number(outstandingAgg._sum.amount ?? 0) - Number(outstandingAgg._sum.discount ?? 0),
        collectedTotal: Number(paidAgg._sum.amount ?? 0),
      },
      library: { activeLoans, overdueLoans },
      iot: { devicesTotal, devicesOnline, openAlerts },
      hr: { pendingLeaves },
      generatedAt: new Date().toISOString(),
    }
  }

  /// Per-class attendance breakdown for a date (exec dashboard "class performance").
  @Get('attendance-by-class')
  @RequirePermissions('report.read')
  async attendanceByClass(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    const schoolId = this.requireSchool(user)
    const d = date ? new Date(date + 'T00:00:00.000Z') : new Date()
    d.setHours(0, 0, 0, 0)
    const classes = await this.prisma.class.findMany({
      where: { schoolId, deletedAt: null, academicYear: { isCurrent: true } },
      select: { id: true, name: true, _count: { select: { enrollments: { where: { deletedAt: null } } } } },
      orderBy: { name: 'asc' },
    })
    const result = []
    for (const cls of classes) {
      const enrolled = await this.prisma.enrollment.findMany({
        where: { classId: cls.id, deletedAt: null },
        select: { studentId: true },
      })
      const records = await this.prisma.attendance.groupBy({
        by: ['status'],
        where: {
          schoolId, date: d, personKind: 'STUDENT',
          personId: { in: enrolled.map((e) => e.studentId) },
        },
        _count: { _all: true },
      })
      const total = records.reduce((s, r) => s + (r._count as { _all: number })._all, 0)
      const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').reduce((s, r) => s + (r._count as { _all: number })._all, 0)
      result.push({
        classId: cls.id, name: cls.name, enrolled: cls._count.enrollments,
        recorded: total, present,
        rate: total > 0 ? Math.round((present / total) * 100) : null,
      })
    }
    return { date: d.toISOString().slice(0, 10), items: result }
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
