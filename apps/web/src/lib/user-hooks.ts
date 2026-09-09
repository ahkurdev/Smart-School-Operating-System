'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface OrgUserFull {
  id: string
  email: string | null
  username: string | null
  fullName: string
  phone: string | null
  status: string
  lastLoginAt: string | null
  memberships: { role: string; isPrimary: boolean }[]
}

export function useUsers(q?: string) {
  const params = q ? `?q=${encodeURIComponent(q)}` : ''
  return useQuery({
    queryKey: ['users', q ?? ''],
    queryFn: () => api<{ items: OrgUserFull[] }>(`/api/users${params}`),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  async function create(input: { email?: string; username?: string; fullName: string; tempPassword: string; role?: string }): Promise<boolean> {
    setLoading(true)
    setError(null)
    setOk(null)
    try {
      await api('/api/users', { method: 'POST', body: JSON.stringify(input) })
      qc.invalidateQueries({ queryKey: ['users'] })
      setOk('Akun dibuat. Sampaikan password sementara secara aman.')
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat akun')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { create, loading, error, ok }
}

export function useResetPassword() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function reset(id: string, tempPassword: string): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api(`/api/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ tempPassword }) })
      qc.invalidateQueries({ queryKey: ['users'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mereset')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { reset, loading, error }
}
