export interface AppConfig {
  port: number
  databaseUrl: string
  jwtAccessSecret: string
  jwtRefreshSecret: string
  corsOrigin: string
  isProd: boolean
}

export function loadConfig(): AppConfig {
  const env = process.env
  const required = (name: string): string => {
    const v = env[name]
    if (!v) throw new Error(`Missing required env: ${name}`)
    return v
  }
  return {
    port: Number(env.PORT ?? 4000),
    databaseUrl: required('DATABASE_URL'),
    jwtAccessSecret: required('JWT_ACCESS_SECRET'),
    jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:3000',
    isProd: env.NODE_ENV === 'production',
  }
}

export const ACCESS_TOKEN_TTL_SEC = 15 * 60
export const REFRESH_TOKEN_TTL_SEC = 7 * 24 * 60 * 60
export const REFRESH_COOKIE = 'ssos_rt'
