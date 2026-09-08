import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import { createHash, randomBytes } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { ACCESS_TOKEN_TTL_SEC, REFRESH_TOKEN_TTL_SEC } from '../config/configuration'

const MAX_FAILED_LOGINS = 5
const LOCK_MINUTES = 15

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  sessionId: string
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(
    identity: string,
    password: string,
    meta: { ip?: string; userAgent?: string },
  ): Promise<TokenPair> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identity.toLowerCase() }, { username: identity }],
        deletedAt: null,
      },
    })

    const genericFail = () => {
      // Uniform error + timing: never reveal whether account exists
      throw new UnauthorizedException('Invalid credentials')
    }
    if (!user) return genericFail()

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Try again later.')
    }

    const valid = await argon2.verify(user.passwordHash, password)
    if (!valid) {
      const failed = user.failedLoginCount + 1
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed,
          lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      })
      await this.audit.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        resource: 'auth',
        ip: meta.ip,
        userAgent: meta.userAgent,
      })
      throw new UnauthorizedException('Invalid credentials')
    }

    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active')

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    })

    const tokens = await this.issueTokens(user.id, meta)
    await this.audit.log({
      userId: user.id,
      action: 'LOGIN',
      resource: 'auth',
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    return tokens
  }

  /// Rotate refresh token: old one invalidated, new pair issued. Reuse of a revoked
  /// token revokes the whole session (theft detection).
  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }): Promise<TokenPair> {
    const hash = sha256(refreshToken)
    const session = await this.prisma.session.findFirst({ where: { refreshTokenHash: hash } })
    if (!session) throw new UnauthorizedException('Invalid refresh token')
    if (session.revokedAt) {
      // Possible token theft: revoke everything for this user's session family
      await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
      throw new UnauthorizedException('Refresh token reuse detected')
    }
    if (session.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired')

    const newOpaque = randomBytes(48).toString('base64url')
    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: session.id },
        data: { refreshTokenHash: sha256(newOpaque), lastUsedAt: new Date() },
      }),
      this.prisma.user.update({ where: { id: session.userId }, data: { lastLoginAt: new Date() } }),
    ])

    const accessToken = await this.jwt.signAsync(
      { sub: session.userId, sid: session.id },
      { expiresIn: ACCESS_TOKEN_TTL_SEC, secret: process.env.JWT_ACCESS_SECRET },
    )
    return { accessToken, refreshToken: newOpaque, sessionId: session.id }
  }
  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } }).catch(() => null)
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const s = await this.prisma.session.findUnique({ where: { id: sessionId } })
    if (!s || s.userId !== userId) throw new BadRequestException('Session not found')
    await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } })
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ip: true, lastUsedAt: true, createdAt: true },
      orderBy: { lastUsedAt: 'desc' },
    })
  }

  private async issueTokens(userId: string, meta: { ip?: string; userAgent?: string }): Promise<TokenPair> {
    const opaque = randomBytes(48).toString('base64url')
    const session = await this.prisma.session.create({
      data: {
        userId,
        kind: 'PASSWORD',
        refreshTokenHash: sha256(opaque),
        ip: meta.ip,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000),
      },
    })
    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: session.id },
      { expiresIn: ACCESS_TOKEN_TTL_SEC, secret: process.env.JWT_ACCESS_SECRET },
    )
    return { accessToken, refreshToken: opaque, sessionId: session.id }
  }

  async verifyAccess(token: string): Promise<{ sub: string; sid: string }> {
    return this.jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET })
  }
}
