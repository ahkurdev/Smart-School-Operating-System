import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const bookSchema = z.object({
  title: z.string().min(2).max(191),
  isbn: z.string().max(20).optional().nullable(),
  author: z.string().max(191).optional().nullable(),
  publisher: z.string().max(191).optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  rackCode: z.string().max(30).optional().nullable(),
  copies: z.number().int().min(0).max(500).optional(),
})

const loanSchema = z.object({
  studentId: z.string().uuid(),
  copyId: z.string().uuid(),
  days: z.number().int().min(1).max(90).optional(),
})

@Controller('library')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LibraryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('books')
  @RequirePermissions('library.read')
  async listBooks(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.book.findMany({
        where: {
          schoolId, deletedAt: null,
          ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { author: { contains: q, mode: 'insensitive' } }, { isbn: { contains: q } }] } : {}),
        },
        include: { _count: { select: { copies: { where: { deletedAt: null, isAvailable: true } } } } },
        orderBy: { title: 'asc' },
        take: 100,
      }),
    }
  }

  @Post('books')
  @RequirePermissions('library.manage')
  async createBook(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(bookSchema, body)
    const n = data.copies ?? 1
    const book = await this.prisma.book.create({
      data: {
        schoolId, title: data.title, isbn: data.isbn ?? undefined, author: data.author ?? undefined,
        publisher: data.publisher ?? undefined, year: data.year ?? undefined,
        category: data.category ?? undefined, rackCode: data.rackCode ?? undefined,
        copies: {
          create: Array.from({ length: n }, (_, i) => ({
            barcode: `${data.isbn ?? 'BC'}-${Date.now()}-${i + 1}`,
          })),
        },
      },
      include: { copies: true },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'book', resourceId: book.id, newValue: { title: book.title, copies: n } })
    return book
  }

  @Get('books/:id/copies')
  @RequirePermissions('library.read')
  async listCopies(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const schoolId = this.requireSchool(user)
    const book = await this.prisma.book.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!book) throw new BadRequestException('Book not found')
    return {
      items: await this.prisma.bookCopy.findMany({
        where: { bookId: id, deletedAt: null },
        select: { id: true, barcode: true, condition: true, isAvailable: true },
        orderBy: { barcode: 'asc' },
      }),
    }
  }

  @Post('loans')
  @RequirePermissions('library.manage')
  async borrow(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(loanSchema, body)
    const copy = await this.prisma.bookCopy.findFirst({
      where: { id: data.copyId, isAvailable: true, deletedAt: null, book: { schoolId, deletedAt: null } },
    })
    if (!copy) throw new BadRequestException('Copy not available')
    const student = await this.prisma.student.findFirst({ where: { id: data.studentId, schoolId, deletedAt: null } })
    if (!student) throw new BadRequestException('Student not found in this school')
    // Max 3 active loans per student
    const active = await this.prisma.bookLoan.count({ where: { studentId: data.studentId, status: 'BORROWED', deletedAt: null } })
    if (active >= 3) throw new BadRequestException('Student has reached max 3 active loans')

    const days = data.days ?? 14
    const dueAt = new Date(Date.now() + days * 24 * 3600 * 1000)
    const [loan] = await this.prisma.$transaction([
      this.prisma.bookLoan.create({ data: { schoolId, copyId: data.copyId, studentId: data.studentId, dueAt } }),
      this.prisma.bookCopy.update({ where: { id: data.copyId }, data: { isAvailable: false } }),
    ])
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'book_loan', resourceId: loan.id, newValue: { studentId: data.studentId, copyId: data.copyId, dueAt } })
    return loan
  }

  @Post('loans/:id/return')
  @RequirePermissions('library.manage')
  async returnBook(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: { damaged?: boolean; lost?: boolean }) {
    const schoolId = this.requireSchool(user)
    const loan = await this.prisma.bookLoan.findFirst({ where: { id, schoolId, status: 'BORROWED', deletedAt: null } })
    if (!loan) throw new BadRequestException('Active loan not found')

    const now = new Date()
    const overdueDays = Math.max(0, Math.ceil((now.getTime() - loan.dueAt.getTime()) / (24 * 3600 * 1000)))
    const fineRate = Number(process.env.LIBRARY_FINE_PER_DAY ?? 1000)
    let fine = overdueDays * fineRate
    let status: 'RETURNED' | 'LOST' = 'RETURNED'
    if (body.lost) { status = 'LOST'; fine = 50000 } // ponytail: flat lost-fine; make configurable per book when needed

    await this.prisma.$transaction([
      this.prisma.bookLoan.update({ where: { id }, data: { status, returnedAt: now, fineAmount: fine, notes: body.damaged ? 'DAMAGED' : undefined } }),
      this.prisma.bookCopy.update({
        where: { id: loan.copyId },
        data: { isAvailable: !body.lost, condition: body.lost ? 'LOST' : body.damaged ? 'DAMAGED' : 'GOOD' },
      }),
    ])
    await this.audit.log({ userId: user.userId, schoolId, action: 'UPDATE', resource: 'book_loan', resourceId: id, newValue: { status, fine } })
    return { status, overdueDays, fine }
  }

  @Get('loans')
  @RequirePermissions('library.read')
  async listLoans(@CurrentUser() user: AuthUser, @Query('studentId') studentId?: string, @Query('status') status?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.bookLoan.findMany({
        where: { schoolId, deletedAt: null, ...(studentId ? { studentId } : {}), ...(status ? { status: status as never } : {}) },
        include: { copy: { include: { book: { select: { title: true } } } }, student: { select: { nis: true, fullName: true } } },
        orderBy: { borrowedAt: 'desc' },
        take: 200,
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
