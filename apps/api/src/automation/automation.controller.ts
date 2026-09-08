import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const ruleSchema = z.object({
  name: z.string().min(2).max(100),
  event: z.string().min(3).max(100),
  condition: z.record(z.unknown()).optional().nullable(),
  action: z.enum(['notify_guardian', 'notify_role', 'notify_user', 'create_alert']),
  actionConfig: z.record(z.unknown()).optional().nullable(),
})

const emitSchema = z.object({
  event: z.string().min(3).max(100),
  payload: z.record(z.unknown()).optional().nullable(),
})

@Controller('automation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AutomationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('rules')
  @RequirePermissions('automation.read')
  async listRules(@CurrentUser() user: AuthUser) {
    return {
      items: await this.prisma.automationRule.findMany({
        where: { schoolId: this.requireSchool(user), deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    }
  }

  @Post('rules')
  @RequirePermissions('automation.manage')
  async createRule(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(ruleSchema, body)
    const rule = await this.prisma.automationRule.create({
      data: {
        schoolId, name: data.name, event: data.event, action: data.action,
        condition: (data.condition ?? undefined) as object | undefined,
        actionConfig: (data.actionConfig ?? undefined) as object | undefined,
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'automation_rule', resourceId: rule.id, newValue: { name: rule.name, event: rule.event, action: rule.action } })
    return rule
  }

  @Post('rules/:id/toggle')
  @RequirePermissions('automation.manage')
  async toggle(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id, schoolId: this.requireSchool(user), deletedAt: null } })
    if (!rule) throw new BadRequestException('Rule not found')
    await this.prisma.automationRule.update({ where: { id }, data: { isActive: !rule.isActive } })
    return { isActive: !rule.isActive }
  }

  /// Event bus emit: logs event, evaluates matching active rules, executes actions
  /// (in-process: creates alerts / notifications; queue-backed when Redis enabled).
  @Post('emit')
  @RequirePermissions('automation.manage')
  @HttpCode(202)
  async emit(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(emitSchema, body)
    const payload = (data.payload ?? {}) as Record<string, unknown>

    await this.prisma.eventLog.create({ data: { schoolId, event: data.event, payload: payload as object } })

    const rules = await this.prisma.automationRule.findMany({
      where: { schoolId, event: data.event, isActive: true, deletedAt: null },
    })
    let executed = 0
    for (const rule of rules) {
      const cond = rule.condition as { metric?: string; op?: string; value?: number } | null
      if (cond?.metric && cond.op && typeof cond.value === 'number') {
        const actual = Number(payload[cond.metric])
        if (!Number.isFinite(actual)) continue
        const pass = cond.op === '>' ? actual > cond.value : cond.op === '<' ? actual < cond.value : cond.op === '=' ? actual === cond.value : false
        if (!pass) continue
      }
      if (rule.action === 'create_alert') {
        await this.prisma.alert.create({
          data: {
            schoolId, kind: 'CUSTOM', severity: String((rule.actionConfig as { severity?: string })?.severity ?? 'INFO'),
            message: `${rule.name}: ${data.event}`,
            payload: payload as object,
          },
        })
        executed++
      } else if (rule.action === 'notify_user' && typeof payload.userId === 'string') {
        await this.prisma.notification.create({
          data: { userId: payload.userId, schoolId, title: rule.name, body: data.event, kind: 'AUTOMATION' },
        })
        executed++
      } else if (rule.action === 'notify_guardian' && typeof payload.studentId === 'string') {
        const guardians = await this.prisma.guardian.findMany({ where: { studentId: payload.studentId, deletedAt: null } })
        await this.prisma.notification.createMany({
          data: guardians.map((g) => ({ userId: g.userId, schoolId, title: rule.name, body: data.event, kind: 'AUTOMATION' })),
        })
        executed++
      }
      // notify_role: fan-out to role members deferred to worker (Phase 25 command center)
    }
    return { event: data.event, rulesMatched: rules.length, actionsExecuted: executed }
  }

  @Get('events')
  @RequirePermissions('automation.read')
  async events(@CurrentUser() user: AuthUser, @Query('event') event?: string) {
    return {
      items: await this.prisma.eventLog.findMany({
        where: { schoolId: this.requireSchool(user), ...(event ? { event } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 100,
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
