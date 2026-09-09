'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface Book {
  id: string
  title: string
  author: string | null
  isbn: string | null
  category: string | null
  _count?: { copies: { where?: unknown } | number }
}

export function useBooks(q?: string) {
  const params = q ? `?q=${encodeURIComponent(q)}` : ''
  return useQuery({
    queryKey: ['books', q],
    queryFn: () => api<{ items: Book[] }>(`/api/library/books${params}`),
  })
}

export function useCreateBook() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function create(input: { title: string; author?: string; isbn?: string; copies?: number }): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api('/api/library/books', { method: 'POST', body: JSON.stringify(input) })
      qc.invalidateQueries({ queryKey: ['books'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menambah buku')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { create, loading, error }
}

export interface BookCopy {
  id: string
  barcode: string
  condition: string
  isAvailable: boolean
}

export function useCopies(bookId: string | null) {
  return useQuery({
    queryKey: ['copies', bookId],
    queryFn: () => api<{ items: BookCopy[] }>(`/api/library/books/${bookId}/copies`),
    enabled: !!bookId,
  })
}

export interface Loan {
  id: string
  status: string
  borrowedAt: string
  dueAt: string
  returnedAt: string | null
  fineAmount: string
  copy: { barcode: string; book: { title: string } }
  student: { nis: string; fullName: string }
}

export function useLoans(status?: string) {
  const params = status ? `?status=${status}` : ''
  return useQuery({
    queryKey: ['loans', status ?? 'ALL'],
    queryFn: () => api<{ items: Loan[] }>(`/api/library/loans${params}`),
  })
}

export function useBorrow() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function borrow(input: { studentId: string; copyId: string; days?: number }): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api('/api/library/loans', { method: 'POST', body: JSON.stringify(input) })
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['copies'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal meminjam')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { borrow, loading, error }
}

export function useReturnLoan() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ status: string; overdueDays: number; fine: number } | null>(null)
  async function returnLoan(id: string, opts?: { damaged?: boolean; lost?: boolean }): Promise<boolean> {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await api<{ status: string; overdueDays: number; fine: number }>(`/api/library/loans/${id}/return`, {
        method: 'POST',
        body: JSON.stringify(opts ?? {}),
      })
      setResult(r)
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['copies'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengembalikan')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { returnLoan, loading, error, result }
}
