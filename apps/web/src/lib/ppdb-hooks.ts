'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface PpdbReg {
  id: string
  regNumber: string
  fullName: string
  nisn: string | null
  gender: string
  birthPlace: string | null
  birthDate: string | null
  address: string | null
  phone: string | null
  parentName: string | null
  parentPhone: string | null
  originSchool: string | null
  status: string
  createdAt: string
  enrolledStudentId: string | null
}

export function useRegistrations(status?: string) {
  const q = status ? `?status=${status}` : ''
  return useQuery({
    queryKey: ['ppdb', status ?? ''],
    queryFn: () => api<{ items: PpdbReg[] }>(`/api/ppdb/registrations${q}`),
  })
}

export function useDecideReg() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function decide(id: string, action: 'VERIFY' | 'SELECT' | 'REJECT'): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api(`/api/ppdb/registrations/${id}/decide`, { method: 'POST', body: JSON.stringify({ action }) })
      qc.invalidateQueries({ queryKey: ['ppdb'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Keputusan gagal')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { decide, loading, error }
}

export function useEnrollReg() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function enroll(id: string, nis: string): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api(`/api/ppdb/registrations/${id}/enroll`, { method: 'POST', body: JSON.stringify({ nis }) })
      qc.invalidateQueries({ queryKey: ['ppdb'] })
      qc.invalidateQueries({ queryKey: ['students'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Daftar ulang gagal')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { enroll, loading, error }
}
