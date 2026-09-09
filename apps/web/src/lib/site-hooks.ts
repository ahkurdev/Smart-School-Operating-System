'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface SiteItem {
  id: string
  section: string
  title: string
  body: string | null
  published: boolean
}

export interface NewsItem {
  id: string
  slug: string
  title: string
  body: string
  publishedAt: string | null
}

export interface SchoolInfo {
  id: string
  name: string
  code: string
}

export function useSchools() {
  return useQuery({
    queryKey: ['schools'],
    queryFn: () => api<{ items: SchoolInfo[] }>('/api/school/profile'),
  })
}

export function useSiteContent() {
  return useQuery({
    queryKey: ['site-content'],
    queryFn: () => api<{ items: SiteItem[] }>('/api/site/content'),
  })
}

export function useSiteNews() {
  return useQuery({
    queryKey: ['site-news'],
    queryFn: () => api<{ items: NewsItem[] }>('/api/site/news'),
  })
}

function useSitePost(path: string, keys: string[][]) {
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

export function useUpsertContent() {
  const r = useSitePost('/api/site/content', [['site-content']])
  return { upsert: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useCreateNews() {
  const r = useSitePost('/api/site/news', [['site-news']])
  return { create: r.run, loading: r.loading, error: r.error, ok: r.ok }
}
