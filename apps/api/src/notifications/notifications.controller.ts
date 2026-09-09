import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async mine(@CurrentUser() user: AuthUser, @Query('unread') unread?: string) {
    const items = await this.prisma.notification.findMany({
      where: { userId: user.userId, ...(unread === '1' ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    const unreadCount = await this.prisma.notification.count({ where: { userId: user.userId, readAt: null } })
    return { items, unreadCount }
  }

  @Post(':id/read')
  async markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId: user.userId } })
    if (!n) throw new BadRequestException('Notification not found')
    if (!n.readAt) await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } })
    return { read: true }
  }
}
