import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const feeSchema = z.object({
  kind: z.enum(['SPP', 'DAFTAR_ULANG', 'KEGIATAN', 'SERAGAM', 'BUKU', 'CUSTOM']),
  name: z.string().min(2).max(191),
  amount: z.number().positive().max(1_000_000_000),
  gradeLevel: z.number().int().min(1).max(12).optional().nullable(),
  academicYearId: z.string().uuid().optional().nullable(),
})

const invoiceSchema = z.object({
  studentId: z.string().uuid(),
  feeItemId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  discount: z.number().min(0).optional(),
  dueDate: z.string().datetime().optional().nullable(),
})

const paymentSchema = z.object({
  amount: z.number().positive().max(1_000_000_000),
  method: z.enum(['CASH', 'TRANSFER', 'PROVIDER']).optional(),
  reference: z.string().max(100).optional().nullable(),
})

@Controller('finance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- Fee items ----

  @Get('fees')
  @RequirePermissions('finance.read')
  async listFees(@CurrentUser() user: AuthUser) {
    return { items: await this.prisma.feeItem.findMany({ where: { schoolId: this.requireSchool(user), deletedAt: null } }) }
  }

  @Post('fees')
  @RequirePermissions('finance.manage')
  async createFee(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(feeSchema, body)
    const fee = await this.prisma.feeItem.create({ data: { ...data, schoolId } })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'fee_item', resourceId: fee.id, newValue: { name: fee.name, amount: fee.amount } })
    return fee
  }

  // ---- Invoices ----

  @Post('invoices')
  @RequirePermissions('finance.manage')
  async createInvoice(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(invoiceSchema, body)
    const fee = await this.prisma.feeItem.findFirst({ where: { id: data.feeItemId, schoolId, deletedAt: null } })
    if (!fee) throw new BadRequestException('Fee item not found')
    const student = await this.prisma.student.findFirst({ where: { id: data.studentId, schoolId, deletedAt: null } })
    if (!student) throw new BadRequestException('Student not found in this school')
    if (data.period) {
      const dup = await this.prisma.invoice.findFirst({ where: { studentId: data.studentId, feeItemId: data.feeItemId, period: data.period, deletedAt: null } })
      if (dup) throw new BadRequestException(`Duplicate billing: invoice already exists for period ${data.period}`)
    }
    const number = `INV-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`
    const invoice = await this.prisma.invoice.create({
      data: {
        schoolId, studentId: data.studentId, feeItemId: data.feeItemId, number,
        amount: fee.amount, discount: data.discount ?? 0, period: data.period ?? undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'invoice', resourceId: invoice.id, newValue: { number, amount: invoice.amount } })
    return invoice
  }

  @Get('invoices')
  @RequirePermissions('finance.read')
  async listInvoices(@CurrentUser() user: AuthUser, @Query('studentId') studentId?: string, @Query('status') status?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.invoice.findMany({
        where: { schoolId, deletedAt: null, ...(studentId ? { studentId } : {}), ...(status ? { status: status as never } : {}) },
        include: {
          feeItem: { select: { name: true, kind: true } },
          student: { select: { nis: true, fullName: true } },
          payments: { where: { deletedAt: null }, select: { amount: true, method: true, paidAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    }
  }

  /// Outstanding summary per student (parent portal "tagihan").
  @Get('outstanding')
  @RequirePermissions('finance.read')
  async outstanding(@CurrentUser() user: AuthUser, @Query('studentId') studentId?: string) {
    const schoolId = this.requireSchool(user)
    const invoices = await this.prisma.invoice.findMany({
      where: { schoolId, deletedAt: null, status: { in: ['UNPAID', 'PARTIALLY_PAID'] }, ...(studentId ? { studentId } : {}) },
      include: { payments: { where: { deletedAt: null } }, student: { select: { nis: true, fullName: true } }, feeItem: { select: { name: true } } },
    })
    const items = invoices.map((inv) => {
      const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
      const due = Number(inv.amount) - Number(inv.discount) - paid
      return { invoiceId: inv.id, number: inv.number, student: inv.student, fee: inv.feeItem.name, period: inv.period, due: Math.max(0, due) }
    }).filter((i) => i.due > 0)
    return { items, total: items.reduce((s, i) => s + i.due, 0) }
  }

  // ---- Payments ----

  @Post('invoices/:id/pay')
  @RequirePermissions('finance.manage')
  async pay(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(paymentSchema, body)
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, schoolId, deletedAt: null, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
      include: { payments: { where: { deletedAt: null } } },
    })
    if (!invoice) throw new BadRequestException('Invoice not found or already settled')
    const payable = Number(invoice.amount) - Number(invoice.discount) - invoice.payments.reduce((s, p) => s + Number(p.amount), 0)
    if (Number(data.amount) > payable) throw new BadRequestException(`Payment exceeds outstanding (${payable})`)

    const payment = await this.prisma.payment.create({
      data: { invoiceId: id, amount: data.amount, method: data.method ?? 'CASH', reference: data.reference ?? undefined, receivedBy: user.userId },
    })
    const totalPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0) + Number(data.amount)
    const settled = totalPaid >= Number(invoice.amount) - Number(invoice.discount)
    await this.prisma.invoice.update({ where: { id }, data: { status: settled ? 'PAID' : 'PARTIALLY_PAID' } })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'payment', resourceId: payment.id, newValue: { invoice: invoice.number, amount: data.amount, method: payment.method } })
    return { paymentId: payment.id, invoiceStatus: settled ? 'PAID' : 'PARTIALLY_PAID', remaining: Math.max(0, payable - Number(data.amount)) }
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
