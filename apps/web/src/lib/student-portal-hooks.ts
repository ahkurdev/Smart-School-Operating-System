'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface StudentMe {
  id: string
  nis: string
  fullName: string
  gender: 'MALE' | 'FEMALE'
  status: string
  enrollment: {
    class: { id: string; name: string; gradeLevel: number }
    academicYear: { id: string; name: string; isCurrent: boolean }
  } | null
}

export function useStudentMe() {
  return useQuery({
    queryKey: ['student-me'],
    queryFn: () => api<StudentMe>('/api/student/me'),
    retry: false,
  })
}

export interface MySlot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  subject: { name: string; code: string }
  room: { name: string } | null
}

export function useMyTimetable() {
  return useQuery({
    queryKey: ['student-timetable'],
    queryFn: () => api<{ items: MySlot[] }>('/api/student/me/timetable'),
  })
}

export interface MySubmission {
  id: string
  status: string
  score: string | null
  submittedAt: string | null
}

export interface MyAssignment {
  id: string
  title: string
  kind: string
  dueAt: string | null
  maxScore: string
  submissions: MySubmission[]
}

export interface MyCourse {
  id: string
  name: string
  subject: { name: string }
  assignments: MyAssignment[]
}

export function useMyAssignments() {
  return useQuery({
    queryKey: ['student-assignments'],
    queryFn: () => api<{ items: MyCourse[] }>('/api/student/me/assignments'),
  })
}

export function useMyGrades() {
  return useQuery({
    queryKey: ['student-grades'],
    queryFn: () => api<{ grades: unknown[]; finals: { subject: string; final: number }[] }>('/api/student/me/grades'),
  })
}

export function useMyAttendance(from: string, to: string) {
  return useQuery({
    queryKey: ['student-attendance', from, to],
    queryFn: () => api<{ items: { date: string; status: string; note: string | null }[]; summary: Record<string, number> }>(
      `/api/student/me/attendance?from=${from}&to=${to}`,
    ),
  })
}
