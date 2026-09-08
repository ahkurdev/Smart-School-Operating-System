import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

export interface AuthUser {
  userId: string
  email: string | null
  username: string | null
  isPlatformAdmin: boolean
  sessionId: string
  memberships: { schoolId: string; schoolName: string; role: string; permissions: string[] }[]
}

export interface RequestWithUser extends Request {
  user: AuthUser
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<RequestWithUser>().user
})

export const CurrentSchool = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | null => {
  const req = ctx.switchToHttp().getRequest<RequestWithUser>()
  const schoolId = (req.headers['x-school-id'] ?? req.query['schoolId']) as string | undefined
  return schoolId ?? null
})
