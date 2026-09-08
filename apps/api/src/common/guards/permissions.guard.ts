import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator'

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const req = context.switchToHttp().getRequest()
    const user = req.user
    if (!user) throw new ForbiddenException('Not authenticated')

    const membership: { permissions: string[] } | null | undefined = user.isPlatformAdmin
      ? null
      : req.schoolId
        ? (user.memberships as { schoolId: string; permissions: string[] }[]).find((m) => m.schoolId === req.schoolId)
        : (user.memberships as { permissions: string[] }[])[0]

    const perms = user.isPlatformAdmin ? ['*'] : (membership?.permissions ?? [])
    if (perms.includes('*')) return true
    const ok = required.every((p) => perms.includes(p))
    if (!ok) throw new ForbiddenException(`Missing permission: ${required.join(', ')}`)
    return true
  }
}
