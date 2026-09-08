'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface Book {
  id: string
  title: string
  author: string | null
  isbn: string | null
  category: string | null
  _count?: { copies: { where?: unknown } | number }
}

export function useBooks(q?: string) {
  const params = q ? `?q=${encodeURIComponent(q)}` : ''
  return useQuery({
    queryKey: ['books', q],
    queryFn: () => api<{ items: Book[] }>(`/api/library/books${params}`),
  })
}

export function useCreateBook() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function create(input: { title: string; author?: string; isbn?: string; copies?: number }): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api('/api/library/books', { method: 'POST', body: JSON.stringify(input) })
      qc.invalidateQueries({ queryKey: ['books'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menambah buku')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { create, loading, error }
}
