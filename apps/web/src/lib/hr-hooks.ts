'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface Employee {
  id: string
  nip: string | null
  kind: string
  fullName: string
  position: string | null
  department: string | null
}

export interface Leave {
  id: string
  kind: string
  fromDate: string
  toDate: string
  reason: string | null
  status: string
  employee: { fullName: string; nip: string | null }
}

export function useEmployees(q?: string) {
  const params = q ? `?q=${encodeURIComponent(q)}` : ''
  return useQuery({
    queryKey: ['employees', q ?? ''],
    queryFn: () => api<{ items: Employee[] }>(`/api/hr/employees${params}`),
  })
}

export function useLeaves(status?: string) {
  const params = status ? `?status=${status}` : ''
  return useQuery({
    queryKey: ['leaves', status ?? 'ALL'],
    queryFn: () => api<{ items: Leave[] }>(`/api/hr/leaves${params}`),
  })
}

function useHrPost(path: string) {
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
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['leaves'] })
      setOk('Tersimpan.')
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

export function useCreateEmployee() {
  const r = useHrPost('/api/hr/employees')
  return { create: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useRequestLeave(employeeId: string) {
  const r = useHrPost(`/api/hr/employees/${employeeId}/leave`)
  return { request: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useDecideLeave() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  async function decide(leaveId: string, action: 'APPROVE' | 'REJECT'): Promise<void> {
    setLoading(true)
    try {
      await api(`/api/hr/leave/${leaveId}/decide`, { method: 'POST', body: JSON.stringify({ action }) })
      qc.invalidateQueries({ queryKey: ['leaves'] })
    } finally {
      setLoading(false)
    }
  }
  return { decide, loading }
}
