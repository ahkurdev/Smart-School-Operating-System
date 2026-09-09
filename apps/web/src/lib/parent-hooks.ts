'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface MyChild {
  id: string
  nis: string
  fullName: string
  gender: 'MALE' | 'FEMALE'
  status: string
  relation?: string
}

export function useMyChildren() {
  return useQuery({
    queryKey: ['my-children'],
    queryFn: () => api<{ items: MyChild[] }>('/api/parent/children'),
  })
}

export interface ChildAttendance {
  date: string
  status: 'PRESENT' | 'SICK' | 'EXCUSED' | 'ABSENT' | 'LATE' | 'EARLY_LEAVE'
  note: string | null
}

export function useChildAttendance(studentId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ['child-attendance', studentId, from, to],
    queryFn: () => api<{ items: ChildAttendance[]; summary: Record<string, number> }>(`/api/parent/children/${studentId}/attendance?from=${from}&to=${to}`),
    enabled: !!studentId,
  })
}

export interface ChildInvoice {
  id: string
  number: string
  amount: string
  discount: string
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED'
  period: string | null
  feeItem: { name: string }
  payments: { amount: string }[]
}

export function useChildInvoices(studentId: string | undefined) {
  return useQuery({
    queryKey: ['child-invoices', studentId],
    queryFn: () => api<{ items: (ChildInvoice & { paid: number; due: number })[]; totalDue: number }>(`/api/parent/children/${studentId}/invoices`),
    enabled: !!studentId,
  })
}

export interface ChildGradeFinal {
  subject: string
  final: number
}

export function useChildGrades(studentId: string | undefined) {
  return useQuery({
    queryKey: ['child-grades', studentId],
    queryFn: () => api<{ grades: unknown[]; finals: ChildGradeFinal[] }>(`/api/parent/children/${studentId}/grades`),
    enabled: !!studentId,
  })
}

export interface ChildReportCard {
  id: string
  verifyCode: string
  publishedAt: string | null
  summary: unknown
}

export function useChildReportCards(studentId: string | undefined) {
  return useQuery({
    queryKey: ['child-rapors', studentId],
    queryFn: () => api<{ items: ChildReportCard[] }>(`/api/parent/children/${studentId}/report-cards`),
    enabled: !!studentId,
  })
}
