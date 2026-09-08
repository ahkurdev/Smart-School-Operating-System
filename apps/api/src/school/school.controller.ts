import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const schoolSchema = z.object({
  name: z.string().min(2).max(191),
  code: z.string().min(2).max(30),
  npsn: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable(),
  principalName: z.string().max(191).optional().nullable(),
  vision: z.string().max(2000).optional().nullable(),
  mission: z.string().max(4000).optional().nullable(),
})

const aySchema = z.object({
  name: z.string().min(4).max(20),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isCurrent: z.boolean().optional(),
})

const subjectSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(191),
  description: z.string().max(1000).optional().nullable(),
})

const roomSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(191),
  kind: z.enum(['CLASSROOM', 'LAB', 'OFFICE', 'HALL', 'OTHER']).optional(),
  capacity: z.number().int().positive().optional().nullable(),
})

const classSchema = z.object({
  name: z.string().min(1).max(50),
  gradeLevel: z.number().int().min(1).max(12),
  academicYearId: z.string().uuid(),
  homeroomTeacherId: z.string().uuid().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
})

@Controller('school')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SchoolController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('profile')
  async profile() {
    // Public within app: basic school identity (no sensitive fields)
    return { items: await this.prisma.school.findMany({ where: { deletedAt: null }, select: this.schoolSelect() }) }
  }

  @Patch('profile')
  @RequirePermissions('school.manage')
  async updateProfile(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(schoolSchema.partial(), body)
    const prev = await this.prisma.school.findUnique({ where: { id: schoolId } })
    const school = await this.prisma.school.update({ where: { id: schoolId }, data, select: this.schoolSelect() })
    await this.audit.log({
      userId: user.userId, schoolId, action: 'UPDATE', resource: 'school', resourceId: schoolId,
      previousValue: { name: prev?.name, vision: prev?.vision }, newValue: { name: school.name, vision: school.vision },
    })
    return school
  }

  // ---- Academic years ----

  @Get('academic-years')
  async listYears(@CurrentUser() user: AuthUser) {
    return {
      items: await this.prisma.academicYear.findMany({
        where: { schoolId: this.requireSchool(user), deletedAt: null },
        include: { semesters: true },
        orderBy: { name: 'desc' },
      }),
    }
  }

  @Post('academic-years')
  @RequirePermissions('school.manage')
  @HttpCode(HttpStatus.CREATED)
  async createYear(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(aySchema, body)
    if (data.endDate <= data.startDate) throw new BadRequestException('endDate must be after startDate')
    return this.prisma.$transaction(async (tx) => {
      if (data.isCurrent) {
        await tx.academicYear.updateMany({ where: { schoolId, isCurrent: true }, data: { isCurrent: false } })
      }
      const ay = await tx.academicYear.create({
        data: { schoolId, name: data.name, startDate: new Date(data.startDate), endDate: new Date(data.endDate), isCurrent: data.isCurrent ?? false },
      })
      await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'academic_year', resourceId: ay.id, newValue: { name: ay.name } })
      return ay
    })
  }

  // ---- Subjects ----

  @Get('subjects')
  async listSubjects(@CurrentUser() user: AuthUser) {
    return { items: await this.prisma.subject.findMany({ where: { schoolId: this.requireSchool(user), deletedAt: null }, orderBy: { name: 'asc' } }) }
  }

  @Post('subjects')
  @RequirePermissions('school.manage')
  @HttpCode(HttpStatus.CREATED)
  async createSubject(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(subjectSchema, body)
    return this.prisma.subject.create({ data: { ...data, schoolId } })
  }

  @Patch('subjects/:id')
  @RequirePermissions('school.manage')
  async updateSubject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(subjectSchema.partial(), body)
    const subject = await this.prisma.subject.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!subject) throw new BadRequestException('Subject not found')
    return this.prisma.subject.update({ where: { id }, data })
  }

  @Delete('subjects/:id')
  @RequirePermissions('school.manage')
  @HttpCode(HttpStatus.OK)
  async deleteSubject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const schoolId = this.requireSchool(user)
    const subject = await this.prisma.subject.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!subject) throw new BadRequestException('Subject not found')
    await this.prisma.subject.update({ where: { id }, data: { deletedAt: new Date() } })
    await this.audit.log({ userId: user.userId, schoolId, action: 'DELETE', resource: 'subject', resourceId: id, previousValue: { code: subject.code, name: subject.name } })
    return { ok: true }
  }

  // ---- Rooms ----

  @Get('rooms')
  async listRooms(@CurrentUser() user: AuthUser) {
    return { items: await this.prisma.room.findMany({ where: { schoolId: this.requireSchool(user), deletedAt: null }, orderBy: { name: 'asc' } }) }
  }

  @Post('rooms')
  @RequirePermissions('school.manage')
  @HttpCode(HttpStatus.CREATED)
  async createRoom(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(roomSchema, body)
    return this.prisma.room.create({ data: { ...data, schoolId } })
  }

  // ---- Classes ----

  @Get('classes')
  async listClasses(@CurrentUser() user: AuthUser, @Query('academicYearId') ayId?: string) {
    const schoolId = this.requireSchool(user)
    const where = {
      schoolId,
      deletedAt: null,
      ...(ayId ? { academicYearId: ayId } : {}),
    }
    return {
      items: await this.prisma.class.findMany({
        where,
        include: { academicYear: { select: { id: true, name: true } }, _count: { select: { enrollments: { where: { deletedAt: null } } } } },
        orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }],
      }),
    }
  }

  @Post('classes')
  @RequirePermissions('school.manage')
  @HttpCode(HttpStatus.CREATED)
  async createClass(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(classSchema, body)
    const ay = await this.prisma.academicYear.findFirst({ where: { id: data.academicYearId, schoolId, deletedAt: null } })
    if (!ay) throw new BadRequestException('Academic year not found in this school')
    return this.prisma.class.create({ data: { ...data, schoolId } })
  }

  @Patch('classes/:id')
  @RequirePermissions('school.manage')
  async updateClass(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(classSchema.partial(), body)
    const cls = await this.prisma.class.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!cls) throw new BadRequestException('Class not found')
    return this.prisma.class.update({ where: { id }, data })
  }

  @Delete('classes/:id')
  @RequirePermissions('school.manage')
  @HttpCode(HttpStatus.OK)
  async deleteClass(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const schoolId = this.requireSchool(user)
    const cls = await this.prisma.class.findFirst({
      where: { id, schoolId, deletedAt: null },
      include: { _count: { select: { enrollments: { where: { deletedAt: null } } } } },
    })
    if (!cls) throw new BadRequestException('Class not found')
    if (cls._count.enrollments > 0) throw new BadRequestException('Class still has enrolled students')
    await this.prisma.class.update({ where: { id }, data: { deletedAt: new Date() } })
    await this.audit.log({ userId: user.userId, schoolId, action: 'DELETE', resource: 'class', resourceId: id, previousValue: { name: cls.name } })
    return { ok: true }
  }

  private schoolSelect() {
    return {
      id: true, name: true, code: true, npsn: true, address: true, phone: true, email: true,
      logoUrl: true, principalName: true, vision: true, mission: true,
    } as const
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
