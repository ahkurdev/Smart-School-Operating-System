import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { Public } from '../common/decorators/permissions.decorator'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { loginSchema } from '@ssos/types'
import { PrismaService } from '../prisma/prisma.service'
import { BadRequestException } from '@nestjs/common'

const REFRESH_COOKIE = 'ssos_rt'
const ACCESS_COOKIE = 'ssos_at'
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

function parseOrThrow<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { path: (string | number)[]; message: string }[] } } }, v: unknown): T {
  const r = schema.safeParse(v)
  if (!r.success || !r.data) {
    throw new BadRequestException((r.error?.issues ?? []).map((i) => i.path.join('.') + ': ' + i.message).join('; ') || 'Invalid body')
  }
  return r.data
}

@Controller('auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const input = parseOrThrow(loginSchema, body)
    const tokens = await this.auth.login(input.identity, input.password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    })
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 3600 * 1000 })
    res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...COOKIE_OPTS, maxAge: 16 * 60 * 1000 })
    return {
      accessToken: tokens.accessToken,
      user: await this.prisma.user.findUnique({
        where: { id: tokens.sessionId ? (await this.auth.verifyAccess(tokens.accessToken)).sub : undefined },
        select: { id: true, username: true, email: true, fullName: true, isPlatformAdmin: true },
      }),
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] ?? (req.body as { refreshToken?: string })?.refreshToken
    if (!token) {
      res.clearCookie(REFRESH_COOKIE).clearCookie(ACCESS_COOKIE)
      throw new BadRequestException('Missing refresh token')
    }
    const tokens = await this.auth.refresh(token, { ip: req.ip, userAgent: req.headers['user-agent'] })
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 3600 * 1000 })
    res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...COOKIE_OPTS, maxAge: 16 * 60 * 1000 })
    return { accessToken: tokens.accessToken }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[ACCESS_COOKIE]
    if (token) {
      try {
        const payload = await this.auth.verifyAccess(token)
        await this.auth.logout(payload.sid)
      } catch {
        // already invalid; clear cookies regardless
      }
    }
    res.clearCookie(REFRESH_COOKIE).clearCookie(ACCESS_COOKIE)
    return { ok: true }
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return user
  }

  @Get('sessions')
  async sessions(@CurrentUser() user: AuthUser) {
    return this.auth.listSessions(user.userId)
  }

  @Post('sessions/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(@CurrentUser() user: AuthUser, @Body() body: { sessionId: string }) {
    await this.auth.revokeSession(user.userId, body.sessionId)
    return { ok: true }
  }
}
