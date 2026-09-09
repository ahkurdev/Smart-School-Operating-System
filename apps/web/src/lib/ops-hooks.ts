'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface UksVisit {
  id: string
  complaint: string
  firstAid: string | null
  temperatureC: number | null
  bloodPressure: string | null
  parentContacted: boolean
  referredTo: string | null
  visitAt: string
  student: { nis: string; fullName: string }
}

export interface Vendor {
  id: string
  name: string
  phone: string | null
  menus: { id: string; name: string; price: number }[]
}

export interface Bus {
  id: string
  plateNumber: string
  capacity: number
  driverName: string | null
  driverPhone: string | null
  routes: { id: string; name: string; departTime: string | null }[]
}

export function useVisits() {
  return useQuery({
    queryKey: ['uks-visits'],
    queryFn: () => api<{ items: UksVisit[] }>('/api/ops/uks/visits'),
  })
}

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: () => api<{ items: Vendor[] }>('/api/ops/canteen/vendors'),
  })
}

export function useBuses() {
  return useQuery({
    queryKey: ['buses'],
    queryFn: () => api<{ items: Bus[] }>('/api/ops/buses'),
  })
}

function useOpsPost(path: string, keys: string[][]) {
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

export function useCreateVisit() {
  const r = useOpsPost('/api/ops/uks/visits', [['uks-visits']])
  return { create: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useCreateVendor() {
  const r = useOpsPost('/api/ops/canteen/vendors', [['vendors']])
  return { create: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useAddMenu(vendorId: string) {
  const r = useOpsPost(`/api/ops/canteen/vendors/${vendorId}/menus`, [['vendors']])
  return { add: r.run, loading: r.loading, error: r.error }
}

export function useCreateBus() {
  const r = useOpsPost('/api/ops/buses', [['buses']])
  return { create: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useAddRoute(busId: string) {
  const r = useOpsPost(`/api/ops/buses/${busId}/routes`, [['buses']])
  return { add: r.run, loading: r.loading, error: r.error }
}
