'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface SearchResults {
  students: { id: string; nis: string; fullName: string; status: string }[]
  employees: { id: string; nip: string | null; fullName: string; kind: string }[]
  books: { id: string; title: string; author: string | null }[]
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => api<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  })
}
