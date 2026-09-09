import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const questionSchema = z.object({
  subjectId: z.string().uuid(),
  type: z.enum(['MC', 'MR', 'TF', 'MATCH', 'SHORT', 'ESSAY']),
  text: z.string().min(2).max(10_000),
  options: z.array(z.object({ key: z.string().max(10), text: z.string().max(1000) })).optional().nullable(),
  answer: z.unknown().optional().nullable(), // teacher-only, never returned to students
  points: z.number().positive().max(100).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  tags: z.string().max(200).optional().nullable(),
})

const examSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  title: z.string().min(2).max(191),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  durationMin: z.number().int().min(5).max(300).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  questionIds: z.array(z.string().uuid()).min(1).max(200),
})

const answerSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
})

@Controller('cbt')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CbtController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- Question bank ----

  @Post('questions')
  @RequirePermissions('cbt.manage')
  async addQuestion(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(questionSchema, body)
    const subject = await this.prisma.subject.findFirst({ where: { id: data.subjectId, schoolId, deletedAt: null } })
    if (!subject) throw new BadRequestException('Subject not found in this school')
    const q = await this.prisma.question.create({
      data: {
        schoolId, subjectId: data.subjectId, type: data.type, text: data.text,
        options: (data.options ?? undefined) as object | undefined,
        answer: (data.answer ?? undefined) as object | undefined,
        points: data.points ?? 1, difficulty: data.difficulty ?? 'MEDIUM',
        tags: data.tags ?? undefined, createdBy: user.userId,
      },
    })
    return { id: q.id }
  }

  @Get('questions')
  @RequirePermissions('cbt.manage')
  async listQuestions(@CurrentUser() user: AuthUser, @Query('subjectId') subjectId?: string, @Query('difficulty') difficulty?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.question.findMany({
        where: { schoolId, deletedAt: null, ...(subjectId ? { subjectId } : {}), ...(difficulty ? { difficulty } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    }
  }

  // ---- Exam management ----

  @Post('exams')
  @RequirePermissions('cbt.manage')
  async createExam(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(examSchema, body)
    const [cls, subject] = await Promise.all([
      this.prisma.class.findFirst({ where: { id: data.classId, schoolId, deletedAt: null } }),
      this.prisma.subject.findFirst({ where: { id: data.subjectId, schoolId, deletedAt: null } }),
    ])
    if (!cls) throw new BadRequestException('Class not found in this school')
    if (!subject) throw new BadRequestException('Subject not found in this school')
    // all questions must belong to this school
    const qs = await this.prisma.question.findMany({ where: { id: { in: data.questionIds }, schoolId, deletedAt: null }, select: { id: true } })
    if (qs.length !== data.questionIds.length) throw new BadRequestException('Some questions not found in this school')

    const exam = await this.prisma.exam.create({
      data: {
        schoolId, classId: data.classId, subjectId: data.subjectId, title: data.title,
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        durationMin: data.durationMin ?? 60,
        shuffleQuestions: data.shuffleQuestions ?? false,
        shuffleOptions: data.shuffleOptions ?? false,
        questionIds: data.questionIds, createdBy: user.userId,
        status: data.startsAt ? 'SCHEDULED' : 'DRAFT',
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'exam', resourceId: exam.id, newValue: { title: exam.title, questions: data.questionIds.length } })
    return exam
  }

  @Get('exams')
  @RequirePermissions('cbt.manage')
  async listExams(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    const schoolId = this.requireSchool(user)
    const exams = await this.prisma.exam.findMany({
      where: { schoolId, deletedAt: null, ...(status ? { status: status as never } : {}) },
      include: {
        subject: { select: { name: true } },
        _count: { select: { sessions: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    const classes = await this.prisma.class.findMany({
      where: { id: { in: exams.map((e) => e.classId) } },
      select: { id: true, name: true },
    })
    const byId = new Map(classes.map((c) => [c.id, c.name]))
    return { items: exams.map((e) => ({ ...e, class: { name: byId.get(e.classId) ?? '-' } })) }
  }

  @Post('exams/:id/start')
  @RequirePermissions('cbt.manage')
  async startExam(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const schoolId = this.requireSchool(user)
    const exam = await this.prisma.exam.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!exam) throw new BadRequestException('Exam not found')
    await this.prisma.exam.update({ where: { id }, data: { status: 'ACTIVE' } })
    await this.audit.log({ userId: user.userId, schoolId, action: 'UPDATE', resource: 'exam', resourceId: id, newValue: { status: 'ACTIVE' } })
    return { ok: true }
  }

  // ---- Student session ----

  /// Start (or resume) session: returns questions WITHOUT answers. Shuffled if exam says so.
  @Post('exams/:id/begin')
  @RequirePermissions('cbt.take')
  async begin(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const schoolId = this.requireSchool(user)
    const exam = await this.prisma.exam.findFirst({ where: { id, schoolId, status: 'ACTIVE', deletedAt: null } })
    if (!exam) throw new BadRequestException('Exam not active')
    // student must be enrolled in exam's class
    const studentId = await this.studentIdOf(user, schoolId)
    if (!studentId) throw new ForbiddenException('Not a student of this school')
    const enrolled = await this.prisma.enrollment.findFirst({
      where: { classId: exam.classId, studentId, deletedAt: null },
    })
    if (!enrolled) throw new ForbiddenException('Not enrolled in this exam class')

    const existing = await this.prisma.examSession.findUnique({ where: { examId_studentId: { examId: id, studentId: enrolled.studentId } } })
    if (existing && existing.status !== 'IN_PROGRESS') throw new BadRequestException('Already submitted')

    let session = existing
    if (!session) {
      const endsAt = new Date(Date.now() + exam.durationMin * 60_000)
      session = await this.prisma.examSession.create({
        data: { examId: id, studentId: enrolled.studentId, endsAt },
      })
    }
    if (session.endsAt < new Date()) throw new BadRequestException('Session expired')

    let ids = (exam.questionIds as string[]) ?? []
    if (exam.shuffleQuestions) ids = shuffle(ids)
    const questions = await this.prisma.question.findMany({ where: { id: { in: ids } } })
    const byId = new Map(questions.map((q) => [q.id, q]))
    // strip answers
    const safe = ids.map((qid) => {
      const q = byId.get(qid)
      if (!q) return null
      return { id: q.id, type: q.type, text: q.text, options: q.options, points: q.points, difficulty: q.difficulty }
    }).filter(Boolean)

    return { sessionId: session.id, endsAt: session.endsAt, questions: safe }
  }

  /// Autosave answers (partial).
  @Post('sessions/:id/answers')
  @RequirePermissions('cbt.take')
  async autosave(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const data = this.parse(answerSchema, body)
    const session = await this.prisma.examSession.findFirst({
      where: { id, status: 'IN_PROGRESS', deletedAt: null, exam: { schoolId: this.requireSchool(user) } },
    })
    if (!session) throw new BadRequestException('Active session not found')
    if (session.endsAt < new Date()) throw new BadRequestException('Session expired')
    await this.prisma.examSession.update({ where: { id }, data: { answers: data.answers as object } })
    return { saved: true, savedAt: new Date().toISOString() }
  }

  /// Submit: auto-grade objective types (MC/MR/TF/SHORT); essays left for teacher.
  @Post('sessions/:id/submit')
  @RequirePermissions('cbt.take')
  async submit(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const data = this.parse(answerSchema, body)
    const schoolId = this.requireSchool(user)
    const session = await this.prisma.examSession.findFirst({
      where: { id, status: 'IN_PROGRESS', deletedAt: null, exam: { schoolId } },
    })
    if (!session) throw new BadRequestException('Active session not found')

    const exam = await this.prisma.exam.findUnique({ where: { id: session.examId } })
    const questions = await this.prisma.question.findMany({ where: { id: { in: ((exam?.questionIds as string[]) ?? []) } } })

    let earned = 0
    let objectiveTotal = 0
    const perQuestion: Record<string, { correct: boolean; points: number }> = {}
    for (const q of questions) {
      const given = (data.answers as Record<string, unknown>)[q.id]
      const pts = Number(q.points)
      if (q.type === 'ESSAY') continue // teacher-graded
      objectiveTotal += pts
      if (isCorrect(q.type, q.answer, given)) {
        earned += pts
        perQuestion[q.id] = { correct: true, points: pts }
      } else {
        perQuestion[q.id] = { correct: false, points: 0 }
      }
    }
    const score = objectiveTotal > 0 ? Math.round((earned / objectiveTotal) * 100 * 100) / 100 : null

    const graded = await this.prisma.examSession.update({
      where: { id },
      data: { status: 'GRADED', submittedAt: new Date(), answers: data.answers as object, score, gradedAt: new Date() },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'UPDATE', resource: 'exam_session', resourceId: id, newValue: { score } })
    return { score, objectiveTotal, earned, submittedAt: graded.submittedAt }
  }

  @Get('sessions/:id/result')
  @RequirePermissions('cbt.take')
  async result(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const session = await this.prisma.examSession.findFirst({
      where: { id, deletedAt: null, exam: { schoolId: this.requireSchool(user) } },
      include: { exam: { include: { subject: { select: { name: true } } } } },
    })
    if (!session) throw new BadRequestException('Session not found')
    return {
      exam: session.exam.title, subject: session.exam.subject.name,
      status: session.status, score: session.score, submittedAt: session.submittedAt,
    }
  }

  private async studentIdOf(user: AuthUser, schoolId: string): Promise<string> {
    const student = await this.prisma.student.findFirst({ where: { userId: user.userId, schoolId, deletedAt: null }, select: { id: true } })
    return student?.id ?? ''
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function isCorrect(type: string, answer: unknown, given: unknown): boolean {
  if (answer === undefined || answer === null) return false
  const norm = (v: unknown): unknown => {
    if (typeof v === 'string') return v.trim().toLowerCase()
    if (Array.isArray(v)) return [...v].map(String).sort()
    return v
  }
  if (type === 'MR') {
    const a = Array.isArray(answer) ? [...answer].map(String).sort().join('|') : String(answer)
    const g = Array.isArray(given) ? [...given].map(String).sort().join('|') : String(given ?? '')
    return a === g
  }
  return JSON.stringify(norm(answer)) === JSON.stringify(norm(given))
}
