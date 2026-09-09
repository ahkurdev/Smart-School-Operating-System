import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Post, Body, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'multiselect', 'radio', 'checkbox', 'date', 'time', 'file'] as const

const fieldSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(120),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().optional().default(false),
  options: z.array(z.string().min(1).max(120)).max(50).optional(),
})

const formSchema = z.object({
  title: z.string().min(2).max(150),
  description: z.string().max(2000).optional().nullable(),
  schema: z.object({ fields: z.array(fieldSchema).min(1).max(100) }),
  isActive: z.boolean().optional(),
})

@Controller('forms')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FormsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private requireSchool(user: AuthUser): string {
    const schoolId = user.memberships[0]?.schoolId
    if (!schoolId) throw new BadRequestException('No school context')
    return schoolId
  }

  private parse<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { path: (string | number)[]; message: string }[] } } }, v: unknown): T {
    const r = schema.safeParse(v)
    if (!r.success || r.data === undefined) {
      throw new BadRequestException((r.error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') || 'Invalid body')
    }
    return r.data
  }

  @Get()
  @RequirePermissions('form.manage')
  async list(@CurrentUser() user: AuthUser) {
    const schoolId = this.requireSchool(user)
    const items = await this.prisma.dynamicForm.findMany({
      where: { schoolId, deletedAt: null },
      include: { _count: { select: { responses: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { items }
  }

  @Post()
  @RequirePermissions('form.manage')
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(formSchema, body)
    // options required for choice types
    for (const f of data.schema.fields) {
      if (['select', 'multiselect', 'radio'].includes(f.type) && (!f.options || f.options.length === 0)) {
        throw new BadRequestException(`Field ${f.key} needs options`)
      }
    }
    const form = await this.prisma.dynamicForm.create({
      data: { schoolId, title: data.title, description: data.description ?? undefined, schema: data.schema as object, isActive: data.isActive ?? true, createdBy: user.userId },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'dynamic_form', resourceId: form.id, newValue: { title: form.title } })
    return form
  }

  @Get(':id')
  @RequirePermissions('form.manage')
  async detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const schoolId = this.requireSchool(user)
    const form = await this.prisma.dynamicForm.findFirst({
      where: { id, schoolId, deletedAt: null },
      include: { responses: { orderBy: { createdAt: 'desc' }, take: 200 } },
    })
    if (!form) throw new BadRequestException('Form not found')
    return form
  }

  /// Public-within-school submit: any authenticated member of the school can fill.
  @Post(':id/submit')
  async submit(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const form = await this.prisma.dynamicForm.findFirst({ where: { id, schoolId, deletedAt: null } })
    if (!form) throw new BadRequestException('Form not found')
    if (!form.isActive) throw new BadRequestException('Form is closed')
    const schema = form.schema as { fields?: { key: string; label: string; type: string; required?: boolean; options?: string[] }[] }
    const answers = (body as { answers?: Record<string, unknown> })?.answers
    if (!answers || typeof answers !== 'object') throw new BadRequestException('answers required')
    for (const f of schema.fields ?? []) {
      const v = answers[f.key]
      if (f.required && (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0))) {
        throw new BadRequestException(`Field ${f.label} wajib diisi`)
      }
      if (v !== undefined && v !== null && v !== '' && f.options && f.options.length > 0) {
        const vals = Array.isArray(v) ? v : [v]
        for (const one of vals) {
          if (!f.options.includes(String(one))) throw new BadRequestException(`Invalid option for ${f.label}`)
        }
      }
    }
    return this.prisma.formResponse.create({
      data: { formId: id, submittedBy: user.userId, answers: answers as object },
    })
  }
}
