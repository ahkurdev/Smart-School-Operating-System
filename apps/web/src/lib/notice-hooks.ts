'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'

export interface Notice {
  id: string
  title: string
  body: string | null
  kind: string
  readAt: string | null
  createdAt: string
}

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: ['notifications', unreadOnly ? 'unread' : 'all'],
    queryFn: () => api<{ items: Notice[]; unreadCount: number }>(`/api/notifications/me${unreadOnly ? '?unread=1' : ''}`),
    refetchInterval: 60_000,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  async function mark(id: string): Promise<void> {
    setLoading(true)
    try {
      await api(`/api/notifications/${id}/read`, { method: 'POST', body: JSON.stringify({}) })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    } finally {
      setLoading(false)
    }
  }
  return { mark, loading }
}

export interface AuditEntry {
  id: string
  action: string
  resource: string
  resourceId: string | null
  reason: string | null
  ip: string | null
  createdAt: string
  user: { fullName: string; email: string | null } | null
}

export function useAuditLog(resource?: string, action?: string) {
  const q = new URLSearchParams()
  if (resource) q.set('resource', resource)
  if (action) q.set('action', action)
  const s = q.toString() ? `?${q}` : ''
  return useQuery({
    queryKey: ['audit', resource ?? '', action ?? ''],
    queryFn: () => api<{ items: AuditEntry[] }>(`/api/audit${s}`),
  })
}
