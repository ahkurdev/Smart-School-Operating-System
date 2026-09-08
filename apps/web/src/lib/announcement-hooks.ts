'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface Announcement {
  id: string
  title: string
  body: string
  audience: string
  publishedAt: string | null
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    queryFn: () => api<{ items: Announcement[] }>('/api/announcements'),
  })
}

export function useCreateAnnouncement() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function create(input: { title: string; body: string; audience: string }): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api('/api/announcements', { method: 'POST', body: JSON.stringify({ ...input, publish: true }) })
      qc.invalidateQueries({ queryKey: ['announcements'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat pengumuman')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { create, loading, error }
}
