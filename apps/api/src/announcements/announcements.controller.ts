import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions, Public } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const announcementSchema = z.object({
  title: z.string().min(2).max(191),
  body: z.string().min(2).max(20_000),
  audience: z.enum(['ALL', 'STUDENTS', 'PARENTS', 'TEACHERS']).optional(),
  publish: z.boolean().optional(),
})

@Controller('announcements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnnouncementsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('audience') audience?: string) {
    const schoolId = this.requireSchool(user)
    return {
      items: await this.prisma.announcement.findMany({
        where: {
          schoolId, deletedAt: null, publishedAt: { not: null },
          ...(audience ? { audience } : {}),
        },
        select: { id: true, title: true, body: true, audience: true, publishedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 100,
      }),
    }
  }

  @Post()
  @RequirePermissions('announcement.manage')
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(announcementSchema, body)
    const announcement = await this.prisma.announcement.create({
      data: {
        schoolId, title: data.title, body: data.body, audience: data.audience ?? 'ALL',
        publishedAt: data.publish === false ? null : new Date(), createdBy: user.userId,
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'announcement', resourceId: announcement.id, newValue: { title: announcement.title } })
    return announcement
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
