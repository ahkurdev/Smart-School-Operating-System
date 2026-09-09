'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface FormField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'date' | 'time' | 'file'
  required?: boolean
  options?: string[]
}

export interface DynForm {
  id: string
  title: string
  description: string | null
  schema: { fields: FormField[] }
  isActive: boolean
  _count: { responses: number }
}

export interface DynFormDetail extends DynForm {
  responses: { id: string; answers: Record<string, unknown>; createdAt: string }[]
}

export function useForms() {
  return useQuery({
    queryKey: ['forms'],
    queryFn: () => api<{ items: DynForm[] }>('/api/forms'),
  })
}

export function useFormDetail(id: string | null) {
  return useQuery({
    queryKey: ['form', id],
    queryFn: () => api<DynFormDetail>(`/api/forms/${id}`),
    enabled: !!id,
  })
}

export function useCreateForm() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  async function create(body: { title: string; description?: string; schema: { fields: FormField[] } }): Promise<boolean> {
    setLoading(true)
    setError(null)
    setOk(null)
    try {
      await api('/api/forms', { method: 'POST', body: JSON.stringify(body) })
      qc.invalidateQueries({ queryKey: ['forms'] })
      setOk('Formulir dibuat.')
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { create, loading, error, ok }
}

export function useSubmitForm(formId: string) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  async function submit(answers: Record<string, unknown>): Promise<boolean> {
    setLoading(true)
    setError(null)
    setOk(null)
    try {
      await api(`/api/forms/${formId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) })
      qc.invalidateQueries({ queryKey: ['form', formId] })
      setOk('Jawaban terkirim.')
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengirim')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { submit, loading, error, ok }
}
