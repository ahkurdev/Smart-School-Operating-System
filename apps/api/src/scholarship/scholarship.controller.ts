import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const programSchema = z.object({
  name: z.string().min(2).max(191),
  period: z.string().min(4).max(20),
  quota: z.number().int().positive().optional().nullable(),
  criteria: z.record(z.unknown()).optional().nullable(),
})

const applySchema = z.object({
  studentId: z.string().uuid(),
  documents: z.record(z.string()).optional().nullable(),
})

const decideSchema = z.object({
  action: z.enum(['VERIFY', 'REVIEW', 'APPROVE', 'REJECT']),
  reviewNotes: z.string().max(5000).optional().nullable(),
})

@Controller('scholarship')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScholarshipController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('programs')
  async listPrograms(@CurrentUser() user: AuthUser) {
    return {
      items: await this.prisma.scholarshipProgram.findMany({
        where: { schoolId: this.requireSchool(user), deletedAt: null },
        include: { _count: { select: { applications: { where: { deletedAt: null } } } } },
        orderBy: { createdAt: 'desc' },
      }),
    }
  }

  @Post('programs')
  async createProgram(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(programSchema, body)
    const program = await this.prisma.scholarshipProgram.create({
      data: { schoolId, name: data.name, period: data.period, quota: data.quota ?? undefined, criteria: (data.criteria ?? undefined) as object | undefined },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'scholarship_program', resourceId: program.id, newValue: { name: program.name, period: program.period } })
    return program
  }

  @Post('programs/:id/apply')
  async apply(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(applySchema, body)
    const program = await this.prisma.scholarshipProgram.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!program) throw new BadRequestException('Program not found')
    const student = await this.prisma.student.findFirst({ where: { id: data.studentId, schoolId, deletedAt: null } })
    if (!student) throw new BadRequestException('Student not found in this school')
    const dup = await this.prisma.scholarshipApplication.findFirst({ where: { programId: id, studentId: data.studentId, deletedAt: null } })
    if (dup) throw new BadRequestException('Student already applied')
    return this.prisma.scholarshipApplication.create({ data: { programId: id, studentId: data.studentId, documents: data.documents ?? undefined } })
  }

  /// Human-only decision chain: VERIFY -> REVIEW -> APPROVE/REJECT. No AI decision.
  @Post('applications/:id/decide')
  async decide(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(decideSchema, body)
    const app = await this.prisma.scholarshipApplication.findFirst({
      where: { id, deletedAt: null, program: { schoolId } },
    })
    if (!app) throw new BadRequestException('Application not found')
    const allowed: Record<string, string[]> = {
      VERIFY: ['APPLIED'],
      REVIEW: ['VERIFIED'],
      APPROVE: ['REVIEW'],
      REJECT: ['VERIFIED', 'REVIEW'],
    }
    if (!allowed[data.action].includes(app.status)) {
      throw new BadRequestException(`Cannot ${data.action} from status ${app.status}`)
    }
    const updated = await this.prisma.scholarshipApplication.update({
      where: { id },
      data: {
        status: data.action === 'VERIFY' ? 'VERIFIED' : data.action === 'REVIEW' ? 'REVIEW' : data.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        reviewNotes: data.reviewNotes ?? app.reviewNotes,
        decidedBy: ['APPROVE', 'REJECT'].includes(data.action) ? user.userId : app.decidedBy,
        decidedAt: ['APPROVE', 'REJECT'].includes(data.action) ? new Date() : app.decidedAt,
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: data.action === 'APPROVE' ? 'APPROVE' : data.action === 'REJECT' ? 'REJECT' : 'UPDATE', resource: 'scholarship_application', resourceId: id, newValue: { status: updated.status } })
    return updated
  }

  @Get('applications')
  async listApplications(@CurrentUser() user: AuthUser, @Query('programId') programId?: string, @Query('status') status?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.scholarshipApplication.findMany({
        where: { deletedAt: null, ...(programId ? { programId } : {}), ...(status ? { status: status as never } : {}), program: { schoolId } },
        include: { student: { select: { nis: true, fullName: true } }, program: { select: { name: true, period: true } } },
        orderBy: { createdAt: 'desc' },
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
