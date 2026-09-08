import { Controller, Get, Res } from '@nestjs/common'
import type { Response } from 'express'
import { PrismaService } from '../prisma/prisma.service'
import { Public } from '../common/decorators/permissions.decorator'

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health(@Res() res: Response) {
    let db = 'ok'
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      db = 'down'
    }
    const status = db === 'ok' ? 200 : 503
    res.status(status).json({ status: db === 'ok' ? 'ok' : 'degraded', db, time: new Date().toISOString() })
  }
}
