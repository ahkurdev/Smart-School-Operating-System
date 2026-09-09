'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export type PpdbStatus = 'REGISTERED' | 'VERIFIED' | 'SELECTED' | 'REJECTED' | 'ENROLLED'

export interface PpdbRegistration {
  id: string
  regNumber: string
  fullName: string
  nisn: string | null
  gender: 'MALE' | 'FEMALE'
  status: PpdbStatus
  originSchool: string | null
  parentName: string | null
  parentPhone: string | null
  createdAt: string
}

export function usePpdbRegistrations(status?: string) {
  const params = status ? `?status=${status}` : ''
  return useQuery({
    queryKey: ['ppdb', status ?? 'ALL'],
    queryFn: () => api<{ items: PpdbRegistration[] }>(`/api/ppdb/registrations${params}`),
  })
}

export function useRegisterPpdb() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function register(input: { fullName: string; gender: 'MALE' | 'FEMALE'; nisn?: string; originSchool?: string; parentName?: string; parentPhone?: string }): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api('/api/ppdb/registrations', { method: 'POST', body: JSON.stringify(input) })
      qc.invalidateQueries({ queryKey: ['ppdb'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mendaftar')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { register, loading, error }
}

export function useDecidePpdb() {
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
      setError(err instanceof ApiError ? err.message : 'Gagal memproses')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { decide, loading, error }
}

export function useEnrollPpdb() {
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
      setError(err instanceof ApiError ? err.message : 'Gagal daftar ulang')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { enroll, loading, error }
}
