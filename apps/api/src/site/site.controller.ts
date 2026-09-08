import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { Public, RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { z } from 'zod'

const contentSchema = z.object({
  section: z.enum(['HOME', 'PROFILE', 'VISION', 'PROGRAMS', 'FACILITIES', 'NEWS', 'AGENDA', 'GALLERY', 'FAQ', 'CONTACT']),
  title: z.string().min(2).max(191),
  body: z.string().max(50_000).optional().nullable(),
  imageUrl: z.string().url().max(500).optional().nullable(),
  order: z.number().int().optional(),
  published: z.boolean().optional(),
})

const newsSchema = z.object({
  title: z.string().min(2).max(191),
  body: z.string().min(2).max(100_000),
  imageUrl: z.string().url().max(500).optional().nullable(),
  publish: z.boolean().optional(),
})

/// Public website API. Public endpoints expose only whitelisted, published, non-sensitive content.
@Controller('site')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SiteController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- Public (no auth) ----

  @Public()
  @Get('public/:schoolCode/content')
  async publicContent(@Param('schoolCode') schoolCode: string, @Query('section') section?: string) {
    const school = await this.prisma.school.findUnique({ where: { code: schoolCode }, select: { id: true, name: true, code: true, npsn: true, address: true, phone: true, email: true, logoUrl: true, principalName: true, vision: true, mission: true } })
    if (!school || school.id === undefined) throw new BadRequestException('School not found')
    const contents = await this.prisma.siteContent.findMany({
      where: { schoolId: school.id, published: true, deletedAt: null, ...(section ? { section } : {}) },
      select: { section: true, title: true, body: true, imageUrl: true, order: true },
      orderBy: { order: 'asc' },
    })
    return { school, contents }
  }

  @Public()
  @Get('public/:schoolCode/news')
  async publicNews(@Param('schoolCode') schoolCode: string) {
    const school = await this.prisma.school.findUnique({ where: { code: schoolCode }, select: { id: true } })
    if (!school) throw new BadRequestException('School not found')
    return {
      items: await this.prisma.newsPost.findMany({
        where: { schoolId: school.id, publishedAt: { not: null }, deletedAt: null },
        select: { slug: true, title: true, body: true, imageUrl: true, publishedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 50,
      }),
    }
  }

  @Public()
  @Get('public/:schoolCode/teachers')
  async publicTeachers(@Param('schoolCode') schoolCode: string) {
    const school = await this.prisma.school.findUnique({ where: { code: schoolCode }, select: { id: true } })
    if (!school) throw new BadRequestException('School not found')
    // consent-safe: name + position only, no private data
    return {
      items: await this.prisma.employee.findMany({
        where: { schoolId: school.id, deletedAt: null, kind: 'TEACHER' },
        select: { fullName: true, position: true, qualification: true },
        orderBy: { fullName: 'asc' },
      }),
    }
  }

  // ---- Admin (auth) ----

  @Post('content')
  @RequirePermissions('site.manage')
  async upsertContent(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(contentSchema, body)
    const content = await this.prisma.siteContent.upsert({
      where: { schoolId_section_title: { schoolId, section: data.section, title: data.title } },
      create: { schoolId, section: data.section, title: data.title, body: data.body ?? undefined, imageUrl: data.imageUrl ?? undefined, order: data.order ?? 0, published: data.published ?? true },
      update: { body: data.body ?? undefined, imageUrl: data.imageUrl ?? undefined, order: data.order ?? undefined, published: data.published ?? undefined },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'UPDATE', resource: 'site_content', resourceId: content.id, newValue: { section: data.section, title: data.title } })
    return content
  }

  @Post('news')
  @RequirePermissions('site.manage')
  async createNews(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const schoolId = this.requireSchool(user)
    const data = this.parse(newsSchema, body)
    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80) + '-' + Date.now().toString(36)
    const post = await this.prisma.newsPost.create({
      data: {
        schoolId, slug, title: data.title, body: data.body,
        imageUrl: data.imageUrl ?? undefined,
        publishedAt: data.publish === false ? null : new Date(),
        createdBy: user.userId,
      },
    })
    await this.audit.log({ userId: user.userId, schoolId, action: 'CREATE', resource: 'news_post', resourceId: post.id, newValue: { slug } })
    return post
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
