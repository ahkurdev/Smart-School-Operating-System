'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface CommandSummary {
  academic: { agendaToday: number }
  students: { total: number; active: number; attendanceRateToday: number | null; absentToday: number }
  staff: { teachers: number }
  finance: { unpaidInvoices: number; outstandingTotal: number; collectedTotal: number }
  library: { activeLoans: number; overdueLoans: number }
  iot: { devicesTotal: number; devicesOnline: number; openAlerts: number }
  hr: { pendingLeaves: number }
  generatedAt: string
}

export function useSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: () => api<CommandSummary>('/api/command-center/summary'),
    refetchInterval: 60_000,
  })
}

export interface AlertItem {
  id: string
  kind: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  message: string
  createdAt: string
  resolvedAt: string | null
}

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: () => api<{ items: AlertItem[] }>('/api/iot/alerts?unresolved=1'),
    refetchInterval: 60_000,
  })
}
