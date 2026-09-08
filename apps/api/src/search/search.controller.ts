import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions, Public } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { z } from 'zod'

/// Global search across core entities. PostgreSQL contains() — FTS/Meilisearch
/// abstraction comes later behind the same response shape.
@Controller('search')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async search(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    if (!q || q.trim().length < 2) return { students: [], teachers: [], books: [], invoices: [] }
    const schoolId = this.requireSchool(user)
    const term = q.trim()

    const [students, employees, books] = await Promise.all([
      this.prisma.student.findMany({
        where: {
          schoolId, deletedAt: null,
          OR: [
            { fullName: { contains: term, mode: 'insensitive' } },
            { nis: { contains: term } },
            { nisn: { contains: term } },
          ],
        },
        select: { id: true, nis: true, fullName: true, status: true },
        take: 8,
      }),
      this.prisma.employee.findMany({
        where: { schoolId, deletedAt: null, fullName: { contains: term, mode: 'insensitive' } },
        select: { id: true, nip: true, fullName: true, kind: true },
        take: 5,
      }),
      this.prisma.book.findMany({
        where: {
          schoolId, deletedAt: null,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { author: { contains: term, mode: 'insensitive' } },
            { isbn: { contains: term } },
          ],
        },
        select: { id: true, title: true, author: true },
        take: 5,
      }),
    ])

    return { students, employees, books }
  }

  /// Public rapor verify already exists under grades; exposed here for QR payload shape consistency.
  private requireSchool(user: AuthUser): string {
    const schoolId = user.memberships[0]?.schoolId
    if (!schoolId) throw new BadRequestException('No school context')
    return schoolId
  }
}
