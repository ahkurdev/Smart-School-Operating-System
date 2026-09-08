import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const courseSchema = z.object({
  subjectId: z.string().uuid(),
  classId: z.string().uuid(),
  teacherUserId: z.string().uuid(),
  name: z.string().min(2).max(191),
  description: z.string().max(2000).optional().nullable(),
})

const materialSchema = z.object({
  title: z.string().min(2).max(191),
  kind: z.enum(['DOCUMENT', 'VIDEO', 'LINK', 'TEXT']).optional(),
  body: z.string().max(50_000).optional().nullable(),
  fileUrl: z.string().url().max(500).optional().nullable(),
  linkUrl: z.string().url().max(500).optional().nullable(),
  order: z.number().int().optional(),
})

const assignmentSchema = z.object({
  title: z.string().min(2).max(191),
  kind: z.enum(['INDIVIDUAL', 'GROUP', 'ESSAY', 'PROJECT', 'PRACTICUM', 'PRESENTATION', 'PORTFOLIO']).optional(),
  instructions: z.string().max(10_000).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  maxScore: z.number().positive().max(1000).optional(),
  weight: z.number().positive().max(100).optional(),
})

const submissionSchema = z.object({
  studentId: z.string().uuid(),
  content: z.string().max(100_000).optional().nullable(),
  fileUrl: z.string().url().max(500).optional().nullable(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'LATE']).optional(),
})

const gradingSchema = z.object({
  score: z.number().min(0).max(1000),
  feedback: z.string().max(5000).optional().nullable(),
})

@Controller('lms')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LmsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- Courses ----

  @Get('courses')
  @RequirePermissions('lms.read')
  async listCourses(@CurrentUser() user: AuthUser) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.course.findMany({
        where: { schoolId, deletedAt: null },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          class: { select: { id: true, name: true } },
          _count: { select: { materials: { where: { deletedAt: null } }, assignments: { where: { deletedAt: null } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    }
  }

  @Post('courses')
  @RequirePermissions('lms.manage')
  @HttpCode(HttpStatus.CREATED)
  async createCourse(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(courseSchema, body)
    const [subject, cls] = await Promise.all([
      this.prisma.subject.findFirst({ where: { id: data.subjectId, schoolId, deletedAt: null } }),
      this.prisma.class.findFirst({ where: { id: data.classId, schoolId, deletedAt: null } }),
    ])
    if (!subject) throw new BadRequestException('Subject not found in this school')
    if (!cls) throw new BadRequestException('Class not found in this school')
    const dup = await this.prisma.course.findFirst({ where: { classId: data.classId, subjectId: data.subjectId, deletedAt: null } })
    if (dup) throw new BadRequestException('Course already exists for this class+subject')
    return this.prisma.course.create({ data: { ...data, schoolId } })
  }

  @Get('courses/:id')
  @RequirePermissions('lms.read')
  async getCourse(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const schoolId = this.requireSchool(user)
    const course = await this.prisma.course.findFirst({
      where: { id, schoolId, deletedAt: null },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        materials: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
        assignments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!course) throw new BadRequestException('Course not found')
    return course
  }

  @Delete('courses/:id')
  @RequirePermissions('lms.manage')
  @HttpCode(HttpStatus.OK)
  async deleteCourse(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const schoolId = this.requireSchool(user)
    const course = await this.prisma.course.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!course) throw new BadRequestException('Course not found')
    await this.prisma.course.update({ where: { id }, data: { deletedAt: new Date() } })
    await this.audit.log({ userId: user.userId, schoolId, action: 'DELETE', resource: 'course', resourceId: id, previousValue: { name: course.name } })
    return { ok: true }
  }

  // ---- Materials ----

  @Post('courses/:id/materials')
  @RequirePermissions('lms.manage')
  @HttpCode(HttpStatus.CREATED)
  async addMaterial(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(materialSchema, body)
    const course = await this.prisma.course.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!course) throw new BadRequestException('Course not found')
    return this.prisma.material.create({ data: { ...data, courseId: id } })
  }

  @Patch('materials/:materialId')
  @RequirePermissions('lms.manage')
  async updateMaterial(@CurrentUser() user: AuthUser, @Param('materialId', ParseUUIDPipe) materialId: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(materialSchema.partial(), body)
    const material = await this.prisma.material.findFirst({
      where: { id: materialId, deletedAt: null, course: { schoolId, deletedAt: null } },
    })
    if (!material) throw new BadRequestException('Material not found')
    return this.prisma.material.update({ where: { id: materialId }, data })
  }

  @Delete('materials/:materialId')
  @RequirePermissions('lms.manage')
  @HttpCode(HttpStatus.OK)
  async deleteMaterial(@CurrentUser() user: AuthUser, @Param('materialId', ParseUUIDPipe) materialId: string) {
    const material = await this.prisma.material.findFirst({
      where: { id: materialId, deletedAt: null, course: { schoolId: this.requireSchool(user), deletedAt: null } },
    })
    if (!material) throw new BadRequestException('Material not found')
    await this.prisma.material.update({ where: { id: materialId }, data: { deletedAt: new Date() } })
    return { ok: true }
  }

  // ---- Assignments ----

  @Post('courses/:id/assignments')
  @RequirePermissions('assignment.manage')
  @HttpCode(HttpStatus.CREATED)
  async createAssignment(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(assignmentSchema, body)
    const course = await this.prisma.course.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!course) throw new BadRequestException('Course not found')
    const assignment = await this.prisma.assignment.create({
      data: { ...data, dueAt: data.dueAt ? new Date(data.dueAt) : undefined, courseId: id },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'assignment', resourceId: assignment.id, newValue: { title: assignment.title, courseId: id } })
    return assignment
  }

  /// Student submits (or updates draft). Late computed server-side from dueAt.
  @Post('assignments/:assignmentId/submissions')
  @RequirePermissions('assignment.submit')
  @HttpCode(HttpStatus.CREATED)
  async submit(@CurrentUser() user: AuthUser, @Param('assignmentId', ParseUUIDPipe) assignmentId: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(submissionSchema, body)
    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, deletedAt: null, course: { schoolId, deletedAt: null } },
    })
    if (!assignment) throw new BadRequestException('Assignment not found')
    const student = await this.prisma.student.findFirst({ where: { id: data.studentId, schoolId, deletedAt: null } })
    if (!student) throw new BadRequestException('Student not found in this school')

    const isLate = assignment.dueAt ? new Date() > assignment.dueAt : false
    const status = data.status === 'DRAFT' ? 'DRAFT' : isLate ? 'LATE' : 'SUBMITTED'
    const submission = await this.prisma.submission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId: data.studentId } },
      create: {
        assignmentId, studentId: data.studentId, status,
        content: data.content ?? undefined, fileUrl: data.fileUrl ?? undefined,
        submittedAt: status !== 'DRAFT' ? new Date() : undefined,
      },
      update: {
        status,
        content: data.content ?? undefined, fileUrl: data.fileUrl ?? undefined,
        submittedAt: status !== 'DRAFT' ? new Date() : undefined,
        // reset grading on resubmission
        score: undefined, feedback: undefined, gradedBy: undefined, gradedAt: undefined,
      },
    })
    return submission
  }

  /// Teacher grades a submission. AI never grades finally.
  @Post('submissions/:submissionId/grade')
  @RequirePermissions('assignment.manage')
  async grade(@CurrentUser() user: AuthUser, @Param('submissionId', ParseUUIDPipe) submissionId: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(gradingSchema, body)
    const submission = await this.prisma.submission.findFirst({
      where: { id: submissionId, deletedAt: null, assignment: { course: { schoolId } } },
    })
    if (!submission) throw new BadRequestException('Submission not found')
    const graded = await this.prisma.submission.update({
      where: { id: submissionId },
      data: { score: data.score, feedback: data.feedback ?? undefined, status: 'GRADED', gradedBy: user.userId, gradedAt: new Date() },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'UPDATE', resource: 'submission', resourceId: submissionId, newValue: { score: data.score } })
    return graded
  }

  @Get('students/:studentId/submissions')
  @RequirePermissions('lms.read')
  async studentSubmissions(@CurrentUser() user: AuthUser, @Param('studentId', ParseUUIDPipe) studentId: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.submission.findMany({
        where: { studentId, deletedAt: null, assignment: { course: { schoolId } } },
        include: { assignment: { select: { id: true, title: true, dueAt: true, maxScore: true, course: { select: { name: true, subject: { select: { name: true } } } } } } },
        orderBy: { updatedAt: 'desc' },
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
