'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface Asset {
  id: string
  code: string
  name: string
  category: string
  condition: string
  serialNumber: string | null
  value: string | null
  room: { name: string; code: string } | null
}

export interface Maintenance {
  id: string
  description: string
  scheduledAt: string | null
  completedAt: string | null
  cost: string | null
  asset: { code: string; name: string; condition: string }
}

export function useAssets(condition?: string) {
  const params = condition ? `?condition=${condition}` : ''
  return useQuery({
    queryKey: ['assets', condition ?? 'ALL'],
    queryFn: () => api<{ items: Asset[] }>(`/api/assets${params}`),
  })
}

export function useDueMaintenance() {
  return useQuery({
    queryKey: ['maintenance-due'],
    queryFn: () => api<{ items: Maintenance[] }>('/api/assets/maintenance/due'),
  })
}

function useAssetPost(path: string, keys: string[][]) {
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

export function useCreateAsset() {
  const r = useAssetPost('/api/assets', [['assets']])
  return { create: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useScheduleMaintenance(assetId: string) {
  const r = useAssetPost(`/api/assets/${assetId}/maintenance`, [['assets'], ['maintenance-due']])
  return { schedule: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useCompleteMaintenance() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function complete(mid: string): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api(`/api/assets/maintenance/${mid}/complete`, { method: 'POST', body: JSON.stringify({}) })
      qc.invalidateQueries({ queryKey: ['maintenance-due'] })
      qc.invalidateQueries({ queryKey: ['assets'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { complete, loading, error }
}
