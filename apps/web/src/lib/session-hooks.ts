'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface SessionInfo {
  id: string
  userAgent: string | null
  ip: string | null
  lastUsedAt: string
  createdAt: string
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => api<SessionInfo[]>('/api/auth/sessions'),
  })
}
