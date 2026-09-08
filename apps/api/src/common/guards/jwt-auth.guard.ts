import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../prisma/prisma.service'
import { PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../decorators/permissions.decorator'
import { resolvePermissions } from '../../auth/role-permissions'
import type { AuthUser } from '../decorators/current-user.decorator'

const ACCESS_COOKIE = 'ssos_at'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest()
    const token = extractToken(req)
    if (!token) throw new UnauthorizedException('Missing access token')

    let payload: { sub: string; sid: string }
    try {
      payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET })
    } catch {
      throw new UnauthorizedException('Invalid or expired access token')
    }

    // Session must exist and not be revoked (server-side revocation source of truth)
    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } })
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session revoked or expired')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        memberships: {
          where: { deletedAt: null },
          include: { customRole: true, school: { select: { id: true, name: true } } },
        },
      },
    })
    if (!user || user.status !== 'ACTIVE' || user.deletedAt) throw new UnauthorizedException('User not active')

    const memberships = user.memberships.map((m) => ({
      schoolId: m.schoolId,
      schoolName: m.school.name,
      role: m.role,
      permissions: resolvePermissions(m.role, m.customRole ? safeParse(m.customRole.permissions) : null),
    }))

    const authUser: AuthUser = {
      userId: user.id,
      email: user.email,
      username: user.username,
      isPlatformAdmin: user.isPlatformAdmin,
      sessionId: session.id,
      memberships,
    }
    req.user = authUser
    req.schoolId = pickSchool(authUser, req)
    return true
  }
}

export function pickSchool(user: AuthUser, req: { headers: Record<string, unknown>; query?: Record<string, unknown> }): string | null {
  const requested = (req.headers['x-school-id'] ?? (req.query?.['schoolId'] as string | undefined)) as string | undefined
  if (!requested) return user.memberships[0]?.schoolId ?? null
  if (!user.memberships.some((m) => m.schoolId === requested)) {
    throw new ForbiddenException('No membership in requested school')
  }
  return requested
}

function extractToken(req: { cookies?: Record<string, string>; headers: Record<string, unknown> }): string | null {
  const auth = req.headers['authorization']
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies?.[ACCESS_COOKIE] ?? null
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}
