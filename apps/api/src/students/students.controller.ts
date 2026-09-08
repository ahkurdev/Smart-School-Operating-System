import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'
import { BadRequestException, NotFoundException } from '@nestjs/common'

const createStudentSchema = z.object({
  nis: z.string().min(1).max(30),
  nisn: z.string().max(20).optional().nullable(),
  fullName: z.string().min(2).max(191),
  gender: z.enum(['MALE', 'FEMALE']),
  birthPlace: z.string().max(191).optional().nullable(),
  birthDate: z.string().datetime().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  entryYear: z.string().max(9).optional().nullable(),
})

const updateStudentSchema = createStudentSchema.partial().extend({
  status: z.enum(['ACTIVE', 'GRADUATED', 'TRANSFERRED', 'WITHDRAWN', 'LEFT']).optional(),
  exitReason: z.string().max(191).optional().nullable(),
})

@Controller('students')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('student.read')
  async list(@CurrentUser() user: AuthUser, @Query('q') q?: string, @Query('status') status?: string, @Query('page') page = '1') {
    const schoolId = this.requireSchool(user)
    const take = 20
    const skip = (Math.max(1, Number(page) || 1) - 1) * take
    const where = {
      schoolId,
      deletedAt: null,
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' as const } },
              { nis: { contains: q } },
              { nisn: { contains: q } },
            ],
          }
        : {}),
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({ where, orderBy: { fullName: 'asc' }, take, skip }),
      this.prisma.student.count({ where }),
    ])
    return { items, total, page: Number(page) || 1, take }
  }

  @Get(':id')
  @RequirePermissions('student.read')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, schoolId: this.requireSchool(user), deletedAt: null },
      include: {
        enrollments: { include: { class: true, academicYear: true }, orderBy: { createdAt: 'desc' } },
        guardians: { where: { deletedAt: null }, include: { user: { select: { id: true, fullName: true, email: true, phone: true } } } },
      },
    })
    if (!student) throw new NotFoundException('Student not found')
    return student
  }

  @Post()
  @RequirePermissions('student.create')
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: AuthUser, @Req() req: Request, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(createStudentSchema, body)
    // Duplicate detection: same NIS or NISN in this school (including soft-deleted)
    const dup = await this.prisma.student.findFirst({
      where: { schoolId, OR: [{ nis: data.nis }, ...(data.nisn ? [{ nisn: data.nisn }] : [])] },
    })
    if (dup) throw new BadRequestException(`Duplicate student: NIS ${dup.nis} already exists`)

    const student = await this.prisma.student.create({
      data: { ...data, birthDate: data.birthDate ? new Date(data.birthDate) : undefined, schoolId, createdBy: user.userId },
    })
    await this.audit.log({
      userId: user.userId, schoolId, action: 'CREATE', resource: 'student', resourceId: student.id,
      newValue: { nis: student.nis, fullName: student.fullName }, ip: req.ip, userAgent: req.headers['user-agent'],
    })
    return student
  }

  @Patch(':id')
  @RequirePermissions('student.update')
  async update(@CurrentUser() user: AuthUser, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(updateStudentSchema, body)
    const existing = await this.prisma.student.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!existing) throw new NotFoundException('Student not found')

    const student = await this.prisma.student.update({
      where: { id },
      data: { ...data, birthDate: data.birthDate ? new Date(data.birthDate) : undefined },
    })
    await this.audit.log({
      userId: user.userId, schoolId, action: 'UPDATE', resource: 'student', resourceId: id,
      previousValue: { fullName: existing.fullName, status: existing.status },
      newValue: { fullName: student.fullName, status: student.status },
      ip: req.ip, userAgent: req.headers['user-agent'],
    })
    return student
  }

  @Delete(':id')
  @RequirePermissions('student.delete')
  async remove(@CurrentUser() user: AuthUser, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    const schoolId = this.requireSchool(user)
    const existing = await this.prisma.student.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!existing) throw new NotFoundException('Student not found')
    // Soft delete: history must never be lost
    await this.prisma.student.update({ where: { id }, data: { deletedAt: new Date(), status: 'LEFT' } })
    await this.audit.log({
      userId: user.userId, schoolId, action: 'DELETE', resource: 'student', resourceId: id,
      previousValue: { nis: existing.nis, fullName: existing.fullName },
      ip: req.ip, userAgent: req.headers['user-agent'],
    })
    return { ok: true }
  }

  /// Assign student to a class for the current academic year (rombel placement).
  @Post(':id/enroll')
  @RequirePermissions('student.update')
  async enroll(@CurrentUser() user: AuthUser, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { classId: string }) {
    const schoolId = this.requireSchool(user)
    const student = await this.prisma.student.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!student) throw new NotFoundException('Student not found')
    const cls = await this.prisma.class.findFirst({ where: { id: body.classId, schoolId, deletedAt: null } })
    if (!cls) throw new BadRequestException('Class not found in this school')
    const ay = await this.prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true, deletedAt: null } })
    if (!ay) throw new BadRequestException('No current academic year')

    const existing = await this.prisma.enrollment.findUnique({
      where: { studentId_academicYearId: { studentId: id, academicYearId: ay.id } },
    })
    if (existing && !existing.deletedAt) throw new BadRequestException('Student already enrolled this year')

    const enrollment = existing
      ? await this.prisma.enrollment.update({ where: { id: existing.id }, data: { classId: cls.id, deletedAt: null } })
      : await this.prisma.enrollment.create({ data: { studentId: id, classId: cls.id, academicYearId: ay.id } })
    await this.audit.log({
      userId: user.userId, schoolId, action: 'UPDATE', resource: 'enrollment', resourceId: enrollment.id,
      newValue: { studentId: id, classId: cls.id, academicYearId: ay.id }, ip: req.ip, userAgent: req.headers['user-agent'],
    })
    return enrollment
  }

  /// Link a guardian (parent) user account to a student.
  @Post(':id/guardians')
  @RequirePermissions('student.update')
  @HttpCode(HttpStatus.CREATED)
  async addGuardian(@CurrentUser() user: AuthUser, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { userId: string; relation?: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER'; isPrimary?: boolean }) {
    const schoolId = this.requireSchool(user)
    const student = await this.prisma.student.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!student) throw new NotFoundException('Student not found')
    const guardianUser = await this.prisma.user.findFirst({ where: { id: body.userId, deletedAt: null } })
    if (!guardianUser) throw new BadRequestException('Guardian user not found')

    const dup = await this.prisma.guardian.findFirst({ where: { userId: body.userId, studentId: id, deletedAt: null } })
    if (dup) throw new BadRequestException('Guardian already linked')

    const guardian = await this.prisma.guardian.create({
      data: { userId: body.userId, studentId: id, schoolId, relation: body.relation ?? 'GUARDIAN', isPrimary: body.isPrimary ?? false },
    })
    await this.audit.log({
      userId: user.userId, schoolId, action: 'CREATE', resource: 'guardian', resourceId: guardian.id,
      newValue: { studentId: id, guardianUserId: body.userId }, ip: req.ip, userAgent: req.headers['user-agent'],
    })
    return guardian
  }

  @Delete(':id/guardians/:guardianId')
  @RequirePermissions('student.update')
  async removeGuardian(@CurrentUser() user: AuthUser, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Param('guardianId', ParseUUIDPipe) guardianId: string) {
    const schoolId = this.requireSchool(user)
    const guardian = await this.prisma.guardian.findFirst({ where: { id: guardianId, studentId: id, schoolId, deletedAt: null } })
    if (!guardian) throw new NotFoundException('Guardian link not found')
    await this.prisma.guardian.update({ where: { id: guardianId }, data: { deletedAt: new Date() } })
    await this.audit.log({
      userId: user.userId, schoolId, action: 'DELETE', resource: 'guardian', resourceId: guardianId,
      previousValue: { studentId: id, guardianUserId: guardian.userId }, ip: req.ip, userAgent: req.headers['user-agent'],
    })
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
