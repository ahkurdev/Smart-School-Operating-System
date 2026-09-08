'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Student {
  id: string
  nis: string
  nisn: string | null
  fullName: string
  gender: 'MALE' | 'FEMALE'
  status: string
  phone: string | null
  entryYear: string | null
}

export interface StudentList {
  items: Student[]
  total: number
  page: number
  take: number
}

export function useStudents(q?: string, page = 1) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  params.set('page', String(page))
  return useQuery({
    queryKey: ['students', q, page],
    queryFn: () => api<StudentList>(`/api/students?${params.toString()}`),
  })
}
