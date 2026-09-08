'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface AttendanceRow {
  id: string
  personId: string
  date: string
  status: 'PRESENT' | 'SICK' | 'EXCUSED' | 'ABSENT' | 'LATE' | 'EARLY_LEAVE'
  note: string | null
  method: string
}

export interface AttendanceList {
  items: AttendanceRow[]
  summary: Record<string, number>
}

export function useAttendance(date?: string) {
  const params = date ? `?date=${date}` : ''
  return useQuery({
    queryKey: ['attendance', date],
    queryFn: () => api<AttendanceList>(`/api/attendance${params}`),
  })
}

export interface AbsentItem {
  id: string
  nis: string
  fullName: string
  status: string
}

export function useAbsent(date?: string) {
  const params = date ? `?date=${date}` : ''
  return useQuery({
    queryKey: ['absent', date],
    queryFn: () => api<{ date: string; items: AbsentItem[] }>(`/api/attendance/absent${params}`),
  })
}
