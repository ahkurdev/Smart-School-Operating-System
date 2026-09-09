'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface CounselingRecord {
  id: string
  studentId: string
  category: string
  status: string
  title: string
  followUpAt: string | null
  referredTo: string | null
  createdAt: string
  student: { nis: string; fullName: string }
}

export interface CounselingDetail extends CounselingRecord {
  notes: string | null
  action: string | null
}

export function useCounseling(status?: string) {
  const params = status ? `?status=${status}` : ''
  return useQuery({
    queryKey: ['counseling', status ?? 'ALL'],
    queryFn: () => api<{ items: CounselingRecord[] }>(`/api/counseling${params}`),
  })
}

export function useCounselingDetail(id: string | null) {
  return useQuery({
    queryKey: ['counseling', id],
    queryFn: () => api<CounselingDetail>(`/api/counseling/${id}`),
    enabled: !!id,
  })
}

function useCounselingPost(path: (id?: string) => string, keys: string[][]) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(body: unknown, id?: string): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api(path(id), { method: 'POST', body: JSON.stringify(body) })
      for (const k of keys) qc.invalidateQueries({ queryKey: k })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { run, loading, error }
}

export function useCreateCounseling() {
  const r = useCounselingPost(() => '/api/counseling', [['counseling']])
  return { create: (b: unknown) => r.run(b), loading: r.loading, error: r.error }
}

export function useCompleteCounseling() {
  const r = useCounselingPost((id) => `/api/counseling/${id}/complete`, [['counseling']])
  return { complete: (id: string, b: unknown) => r.run(b, id), loading: r.loading, error: r.error }
}
