import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditAction } from '@prisma/client'

export interface AuditEntry {
  userId?: string | null
  schoolId?: string | null
  action: AuditAction
  resource: string
  resourceId?: string | null
  previousValue?: unknown
  newValue?: unknown
  reason?: string | null
  ip?: string | null
  userAgent?: string | null
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId ?? undefined,
        schoolId: entry.schoolId ?? undefined,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? undefined,
        previousValue: entry.previousValue === undefined ? undefined : (entry.previousValue as object),
        newValue: entry.newValue === undefined ? undefined : (entry.newValue as object),
        reason: entry.reason ?? undefined,
        ip: entry.ip ?? undefined,
        userAgent: entry.userAgent ?? undefined,
      },
    })
  }
}
