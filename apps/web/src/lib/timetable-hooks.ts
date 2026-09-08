'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface TimetableSlot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  class: { id: string; name: string }
  subject: { id: string; name: string; code: string }
  room: { id: string; name: string; code: string } | null
}

export function useTimetable(classId?: string) {
  const params = classId ? `?classId=${classId}` : ''
  return useQuery({
    queryKey: ['timetable', classId],
    queryFn: () => api<{ items: TimetableSlot[] }>(`/api/timetable${params}`),
  })
}

export interface SchoolClass {
  id: string
  name: string
  gradeLevel: number
  academicYear: { id: string; name: string }
  _count: { enrollments: number }
}

export function useClasses() {
  return useQuery({
    queryKey: ['classes'],
    queryFn: () => api<{ items: SchoolClass[] }>('/api/school/classes'),
  })
}

export function useCreateSlot() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function create(input: { classId: string; subjectId: string; teacherUserId: string; dayOfWeek: number; startTime: string; endTime: string }): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api('/api/timetable', { method: 'POST', body: JSON.stringify(input) })
      qc.invalidateQueries({ queryKey: ['timetable'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat slot')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { create, loading, error }
}
