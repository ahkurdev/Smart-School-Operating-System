import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const registerSchema = z.object({
  fullName: z.string().min(2).max(191),
  nisn: z.string().max(20).optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE']),
  birthPlace: z.string().max(191).optional().nullable(),
  birthDate: z.string().datetime().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  parentName: z.string().max(191).optional().nullable(),
  parentPhone: z.string().max(30).optional().nullable(),
  originSchool: z.string().max(191).optional().nullable(),
})

@Controller('ppdb')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PpdbController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('registrations')
  @RequirePermissions('ppdb.read')
  async list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.ppdb().findMany({
        where: { schoolId, deletedAt: null, ...(status ? { status: status as never } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
    }
  }

  @Post('registrations')
  @RequirePermissions('ppdb.manage')
  async register(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(registerSchema, body)
    const regNumber = `PPDB-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`
    const reg = await this.prisma.ppdbRegistration.create({
      data: {
        schoolId, regNumber, fullName: data.fullName, nisn: data.nisn ?? undefined,
        gender: data.gender, birthPlace: data.birthPlace ?? undefined,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        address: data.address ?? undefined, phone: data.phone ?? undefined,
        parentName: data.parentName ?? undefined, parentPhone: data.parentPhone ?? undefined,
        originSchool: data.originSchool ?? undefined,
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'ppdb_registration', resourceId: reg.id, newValue: { regNumber, fullName: reg.fullName } })
    return reg
  }

  /// VERIFY: check documents. SELECTED: pass selection. REJECT allowed until ACCEPTED.
  @Post('registrations/:id/decide')
  @RequirePermissions('ppdb.verify')
  async decide(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: { action: 'VERIFY' | 'SELECT' | 'REJECT' }) {
    const schoolId = this.requireSchool(user)
    const reg = await this.prisma.ppdbRegistration.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!reg) throw new BadRequestException('Registration not found')
    const allowed: Record<string, string[]> = {
      VERIFY: ['REGISTERED'],
      SELECT: ['VERIFIED'],
      REJECT: ['REGISTERED', 'VERIFIED', 'SELECTED'],
    }
    if (!allowed[body.action]?.includes(reg.status)) {
      throw new BadRequestException(`Cannot ${body.action} from status ${reg.status}`)
    }
    const next = body.action === 'VERIFY' ? 'VERIFIED' : body.action === 'SELECT' ? 'SELECTED' : 'REJECTED'
    await this.prisma.ppdbRegistration.update({
      where: { id },
      data: {
        status: next,
        ...(body.action === 'VERIFY' ? { verifiedBy: user.userId, verifiedAt: new Date() } : {}),
        ...(next === 'SELECTED' || next === 'REJECTED' ? { decidedBy: user.userId, decidedAt: new Date() } : {}),
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: next === 'REJECTED' ? 'REJECT' : 'UPDATE', resource: 'ppdb_registration', resourceId: id, newValue: { status: next } })
    return { status: next }
  }

  /// Daftar ulang: ACCEPTED status + creates real Student record. Human decision already made via SELECT.
  @Post('registrations/:id/enroll')
  @RequirePermissions('ppdb.verify')
  async enroll(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: { nis: string }) {
    const schoolId = this.requireSchool(user)
    const reg = await this.prisma.ppdbRegistration.findFirst({ where: { id, schoolId, deletedAt: null, status: 'SELECTED' } })
    if (!reg) throw new BadRequestException('Registration not in SELECTED state')
    const dupNis = await this.prisma.student.findFirst({ where: { schoolId, nis: body.nis } })
    if (dupNis) throw new BadRequestException(`Duplicate student: NIS ${body.nis} already exists`)

    const student = await this.prisma.$transaction(async (tx) => {
      const s = await tx.student.create({
        data: {
          schoolId, nis: body.nis, nisn: reg.nisn ?? undefined, fullName: reg.fullName,
          gender: reg.gender, birthPlace: reg.birthPlace, birthDate: reg.birthDate,
          address: reg.address ?? undefined, phone: reg.phone ?? undefined, entryYear: String(new Date().getFullYear()),
        },
      })
      await tx.ppdbRegistration.update({ where: { id }, data: { status: 'ENROLLED', enrolledStudentId: s.id } })
      return s
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'APPROVE', resource: 'ppdb_registration', resourceId: id, newValue: { enrolledStudentId: student.id, nis: student.nis } })
    return { studentId: student.id, nis: student.nis }
  }

  private requireSchool(user: AuthUser): string {
    const schoolId = user.memberships[0]?.schoolId
    if (!schoolId) throw new BadRequestException('No school context')
    return schoolId
  }

  private ppdb() {
    return this.prisma.ppdbRegistration
  }

  private parse<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { path: (string | number)[]; message: string }[] } } }, v: unknown): T {
    const r = schema.safeParse(v)
    if (!r.success || !r.data) {
      throw new BadRequestException((r.error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') || 'Invalid body')
    }
    return r.data
  }
}
