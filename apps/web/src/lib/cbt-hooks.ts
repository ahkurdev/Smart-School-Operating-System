'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface BankQuestion {
  id: string
  type: string
  text: string
  points: string
  difficulty: string
}

export interface Exam {
  id: string
  title: string
  status: string
  durationMin: number
  subject: { name: string }
  class: { name: string }
  _count: { sessions: number }
}

export function useQuestions(subjectId?: string) {
  const params = subjectId ? `?subjectId=${subjectId}` : ''
  return useQuery({
    queryKey: ['questions', subjectId ?? 'ALL'],
    queryFn: () => api<{ items: BankQuestion[] }>(`/api/cbt/questions${params}`),
  })
}

export function useExams() {
  return useQuery({
    queryKey: ['exams'],
    queryFn: () => api<{ items: Exam[] }>('/api/cbt/exams'),
  })
}

function usePost(path: string, keys: string[][], okMsg: string) {
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
      setOk(okMsg)
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

export function useCreateQuestion() {
  const r = usePost('/api/cbt/questions', [['questions']], 'Soal ditambahkan.')
  return { create: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useCreateExam() {
  const r = usePost('/api/cbt/exams', [['exams']], 'Ujian dibuat.')
  return { create: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useStartExam() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function start(id: string): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api(`/api/cbt/exams/${id}/start`, { method: 'POST', body: JSON.stringify({}) })
      qc.invalidateQueries({ queryKey: ['exams'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memulai')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { start, loading, error }
}
