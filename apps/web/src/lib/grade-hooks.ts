'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface Grade {
  id: string
  studentId: string
  subjectId: string
  semesterId: string
  component: string
  title: string | null
  score: string
  weight: string
  status: string
  subject: { name: string; code: string }
}

export function useGrades(studentId?: string) {
  const params = studentId ? `?studentId=${studentId}` : ''
  return useQuery({
    queryKey: ['grades', studentId ?? 'ALL'],
    queryFn: () => api<{ items: Grade[] }>(`/api/grades${params}`),
  })
}

export interface Subject {
  id: string
  name: string
  code: string
}

export function useSubjects() {
  return useQuery({
    queryKey: ['subjects'],
    queryFn: () => api<{ items: Subject[] }>('/api/school/subjects'),
  })
}

export interface Semester {
  id: string
  name: string
  sequence: number
  isCurrent: boolean
}

export interface AcademicYear {
  id: string
  name: string
  isCurrent: boolean
  semesters: Semester[]
}

export function useAcademicYears() {
  return useQuery({
    queryKey: ['academic-years'],
    queryFn: () => api<{ items: AcademicYear[] }>('/api/school/academic-years'),
  })
}

export function useInputGrade() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function input(g: { studentId: string; subjectId: string; semesterId: string; component: string; title?: string; score: number; weight?: number }): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api('/api/grades', { method: 'POST', body: JSON.stringify(g) })
      qc.invalidateQueries({ queryKey: ['grades'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan nilai')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { input, loading, error }
}

export function useGradeWorkflow() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  async function run(action: 'SUBMIT' | 'APPROVE' | 'PUBLISH', semesterId: string): Promise<boolean> {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await api<{ action: string; affected?: number; students?: number }>('/api/grades/workflow', {
        method: 'POST',
        body: JSON.stringify({ action, semesterId }),
      })
      setResult(action === 'PUBLISH' ? `${r.students ?? 0} rapor diterbitkan` : `${r.affected ?? 0} nilai diproses`)
      qc.invalidateQueries({ queryKey: ['grades'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menjalankan workflow')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { run, loading, error, result }
}
