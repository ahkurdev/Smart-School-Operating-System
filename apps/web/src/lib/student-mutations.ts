'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'
import type { Student } from './student-hooks'

export function useCreateStudent() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(input: { nis: string; fullName: string; gender: 'MALE' | 'FEMALE'; nisn?: string; phone?: string; entryYear?: string }): Promise<Student | null> {
    setLoading(true)
    setError(null)
    try {
      const s = await api<Student>('/api/students', { method: 'POST', body: JSON.stringify(input) })
      qc.invalidateQueries({ queryKey: ['students'] })
      return s
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan')
      return null
    } finally {
      setLoading(false)
    }
  }
  return { create, loading, error }
}

export function useDeleteStudent() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove(id: string): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api(`/api/students/${id}`, { method: 'DELETE' })
      qc.invalidateQueries({ queryKey: ['students'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { remove, loading, error }
}
