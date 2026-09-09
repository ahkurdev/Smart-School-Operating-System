'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface Program {
  id: string
  name: string
  period: string
  quota: number | null
}

export interface Application {
  id: string
  status: string
  reviewNotes: string | null
  student: { nis: string; fullName: string }
  program: { name: string; period: string }
}

export function usePrograms() {
  return useQuery({
    queryKey: ['programs'],
    queryFn: () => api<{ items: Program[] }>('/api/scholarship/programs'),
  })
}

export function useApplications(programId?: string, status?: string) {
  const q = new URLSearchParams()
  if (programId) q.set('programId', programId)
  if (status) q.set('status', status)
  const s = q.toString() ? `?${q}` : ''
  return useQuery({
    queryKey: ['applications', programId ?? '', status ?? ''],
    queryFn: () => api<{ items: Application[] }>(`/api/scholarship/applications${s}`),
  })
}

function useSchPost(path: string, keys: string[][]) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  async function run(body?: unknown): Promise<boolean> {
    setLoading(true)
    setError(null)
    setOk(null)
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
      for (const k of keys) qc.invalidateQueries({ queryKey: k })
      setOk('Tersimpan.')
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { run, loading, error, ok }
}

export function useCreateProgram() {
  const r = useSchPost('/api/scholarship/programs', [['programs']])
  return { create: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useApplyProgram(programId: string) {
  const r = useSchPost(`/api/scholarship/programs/${programId}/apply`, [['applications'], ['programs']])
  return { apply: r.run, loading: r.loading, error: r.error }
}

export function useDecideApplication(appId: string) {
  const r = useSchPost(`/api/scholarship/applications/${appId}/decide`, [['applications']])
  return { decide: r.run, loading: r.loading, error: r.error }
}
