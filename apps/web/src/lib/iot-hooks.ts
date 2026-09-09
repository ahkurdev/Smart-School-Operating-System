'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface Device {
  id: string
  deviceId: string
  name: string
  kind: string
  status: string
  battery: number | null
  signal: number | null
  firmware: string | null
  lastSeenAt: string | null
  room: { name: string; code: string } | null
}

export interface Alert {
  id: string
  kind: string
  severity: string
  message: string
  createdAt: string
  resolvedAt: string | null
}

export interface Rule {
  id: string
  name: string
  event: string
  action: string
  isActive: boolean
}

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: () => api<{ items: Device[] }>('/api/iot/devices'),
    refetchInterval: 30_000,
  })
}

export function useAlerts() {
  return useQuery({
    queryKey: ['iot-alerts'],
    queryFn: () => api<{ items: Alert[] }>('/api/iot/alerts?unresolved=1'),
    refetchInterval: 30_000,
  })
}

export function useRules() {
  return useQuery({
    queryKey: ['rules'],
    queryFn: () => api<{ items: Rule[] }>('/api/automation/rules'),
  })
}

function useIotPost(path: string, keys: string[][]) {
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

export function useRegisterDevice() {
  const r = useIotPost('/api/iot/devices', [['devices']])
  return { register: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useResolveAlert() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  async function resolve(id: string): Promise<void> {
    setLoading(true)
    try {
      await api(`/api/iot/alerts/${id}/resolve`, { method: 'POST', body: JSON.stringify({}) })
      qc.invalidateQueries({ queryKey: ['iot-alerts'] })
    } finally {
      setLoading(false)
    }
  }
  return { resolve, loading }
}

export function useCreateRule() {
  const r = useIotPost('/api/automation/rules', [['rules']])
  return { create: r.run, loading: r.loading, error: r.error, ok: r.ok }
}

export function useToggleRule() {
  const qc = useQueryClient()
  async function toggle(id: string): Promise<void> {
    await api(`/api/automation/rules/${id}/toggle`, { method: 'POST', body: JSON.stringify({}) })
    qc.invalidateQueries({ queryKey: ['rules'] })
  }
  return { toggle }
}
