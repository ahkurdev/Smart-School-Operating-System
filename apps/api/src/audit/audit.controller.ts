import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'

@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('audit.read')
  async list(
    @CurrentUser() user: AuthUser,
    @Query('resource') resource?: string,
    @Query('action') action?: string,
    @Query('q') q?: string,
  ) {
    const schoolId = user.memberships[0]?.schoolId
    const items = await this.prisma.auditLog.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        ...(resource ? { resource } : {}),
        ...(action ? { action: action as never } : {}),
        ...(q ? { resourceId: q } : {}),
      },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return { items }
  }
}
