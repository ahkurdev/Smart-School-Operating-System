'use client'

/// Minimal API client: cookie-based auth (httpOnly), JSON helper, error normalization.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (body as { message?: string }).message ?? `HTTP ${res.status}`)
  return body as T
}

export interface Me {
  userId: string
  email: string | null
  username: string | null
  isPlatformAdmin: boolean
  sessionId: string
  memberships: { schoolId: string; schoolName: string; role: string; permissions: string[] }[]
}
