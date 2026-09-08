'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface FinanceInvoice {
  id: string
  number: string
  amount: string
  discount: string
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED'
  period: string | null
  feeItem: { name: string; kind: string }
  student: { nis: string; fullName: string }
  payments: { amount: string; method: string; paidAt: string }[]
}

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: () => api<{ items: FinanceInvoice[] }>('/api/finance/invoices'),
  })
}

export function useOutstanding() {
  return useQuery({
    queryKey: ['outstanding'],
    queryFn: () => api<{ items: { invoiceId: string; number: string; student: { fullName: string }; fee: string; due: number }[]; total: number }>('/api/finance/outstanding'),
  })
}

export function usePay() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function pay(invoiceId: string, amount: number): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api(`/api/finance/invoices/${invoiceId}/pay`, { method: 'POST', body: JSON.stringify({ amount, method: 'CASH' }) })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['outstanding'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membayar')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { pay, loading, error }
}
