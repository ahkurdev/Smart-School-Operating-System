'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { api, type Me } from '@/lib/api'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/api/auth/me'),
    retry: false,
    staleTime: 60_000,
  })
}

export function useLogout() {
  const qc = useQueryClient()
  const router = useRouter()
  return async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => null)
    qc.clear()
    router.push('/login')
  }
}
