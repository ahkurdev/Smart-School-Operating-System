'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export interface Course {
  id: string
  name: string
  description: string | null
  subject: { id: string; name: string; code: string }
  class: { id: string; name: string }
  _count: { materials: number; assignments: number }
}

export interface CourseDetail extends Omit<Course, '_count'> {
  materials: { id: string; title: string; kind: string; body: string | null; linkUrl: string | null }[]
  assignments: { id: string; title: string; kind: string; dueAt: string | null; maxScore: string }[]
}

export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: () => api<{ items: Course[] }>('/api/lms/courses'),
  })
}

export function useCourse(id: string | null) {
  return useQuery({
    queryKey: ['course', id],
    queryFn: () => api<CourseDetail>(`/api/lms/courses/${id}`),
    enabled: !!id,
  })
}

export function useCreateCourse() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function create(input: { subjectId: string; classId: string; teacherUserId: string; name: string; description?: string }): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api('/api/lms/courses', { method: 'POST', body: JSON.stringify(input) })
      qc.invalidateQueries({ queryKey: ['courses'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat kelas')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { create, loading, error }
}

export function useAddMaterial(courseId: string) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function add(input: { title: string; kind: string; body?: string; linkUrl?: string }): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api(`/api/lms/courses/${courseId}/materials`, { method: 'POST', body: JSON.stringify(input) })
      qc.invalidateQueries({ queryKey: ['course', courseId] })
      qc.invalidateQueries({ queryKey: ['courses'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menambah materi')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { add, loading, error }
}

export function useAddAssignment(courseId: string) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function add(input: { title: string; kind: string; instructions?: string; dueAt?: string; maxScore?: number }): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      await api(`/api/lms/courses/${courseId}/assignments`, { method: 'POST', body: JSON.stringify(input) })
      qc.invalidateQueries({ queryKey: ['course', courseId] })
      qc.invalidateQueries({ queryKey: ['courses'] })
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat tugas')
      return false
    } finally {
      setLoading(false)
    }
  }
  return { add, loading, error }
}

export interface OrgUser {
  id: string
  fullName: string
  email: string | null
}

export function useOrgUsers(q?: string) {
  return useQuery({
    queryKey: ['org-users', q ?? ''],
    queryFn: () => api<{ items: OrgUser[] }>(`/api/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  })
}
