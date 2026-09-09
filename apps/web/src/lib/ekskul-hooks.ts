'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface Ekskul {
  id: string
  name: string
  kind: string
  schedule: string | null
  _count: { members: number }
}

export interface Achievement {
  id: string
  title: string
  type: string
  level: string
  rank: number | null
  year: number
  student: { nis: string; fullName: string }
}

export function useEkskul() {
  return useQuery({
    queryKey: ['ekskul'],
    queryFn: () => api<{ items: Ekskul[] }>('/api/ekskul'),
  })
}

export function useAchievements() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn: () => api<{ items: Achievement[] }>('/api/ekskul/achievements'),
  })
}

function useEkskulPost(path: string) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  async function run(body: unknown): Promise<boolean> {
    setLoading(true)
    setError(null)
    setOk(null)
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) })
      qc.invalidateQueries({ queryKey: ['ekskul'] })
      qc.invalidateQueries({ queryKey: ['achievements'] })
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

export function useCreateEkskul() {
  const r = useEkskulPost('/api/ekskul')
  return { create: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useAddMember(ekskulId: string) {
  const r = useEkskulPost(`/api/ekskul/${ekskulId}/members`)
  return { add: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useAddAchievement() {
  const r = useEkskulPost('/api/ekskul/achievements')
  return { add: r.run, loading: r.loading, error: r.error, ok: r.ok }
}
