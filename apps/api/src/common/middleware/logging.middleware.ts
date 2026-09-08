import { Injectable, NestMiddleware } from '@nestjs/common'
import type { Request, Response, NextFunction } from 'express'
import { pino } from 'pino'

const httpLogger = pino({ level: process.env.LOG_LEVEL || 'info' })

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now()
    res.on('finish', () => {
      httpLogger.info({
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
        ip: req.ip,
      }, 'http')
    })
    next()
  }
}
