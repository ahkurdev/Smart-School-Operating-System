'use client'

import { useMemo, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useStudents } from '@/lib/student-hooks'
import {
  useGrades,
  useSubjects,
  useAcademicYears,
  useInputGrade,
  useGradeWorkflow,
} from '@/lib/grade-hooks'

const COMPONENTS = ['ASSIGNMENT', 'QUIZ', 'EXAM', 'PROJECT', 'PRACTICUM', 'CUSTOM'] as const
const COMPONENT_LABEL: Record<string, string> = {
  ASSIGNMENT: 'Tugas', QUIZ: 'Kuis', EXAM: 'Ujian', PROJECT: 'Proyek', PRACTICUM: 'Praktik', CUSTOM: 'Lainnya',
}
const STATUS_COLOR: Record<string, 'slate' | 'yellow' | 'blue' | 'green'> = {
  DRAFT: 'slate', SUBMITTED: 'yellow', APPROVED: 'blue', PUBLISHED: 'green',
}

export default function GradesPage() {
  const { data: me } = useMe()
  const [studentQ, setStudentQ] = useState('')
  const [studentId, setStudentId] = useState('')
  const { data: students } = useStudents(studentQ || undefined, 1)
  const { data: gradesData, isLoading, isError } = useGrades(studentId || undefined)
  const { data: subjects } = useSubjects()
  const { data: years } = useAcademicYears()
  const { input, loading: inputting, error: inputError } = useInputGrade()
  const { run, loading: running, error: runError, result } = useGradeWorkflow()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ studentId: '', subjectId: '', semesterId: '', component: 'ASSIGNMENT', title: '', score: '', weight: '1' })

  const semesters = useMemo(
    () => (years?.items ?? []).flatMap((y) => y.semesters.map((s) => ({ ...s, yearName: y.name }))),
    [years],
  )

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ok = await input({
      studentId: form.studentId,
      subjectId: form.subjectId,
      semesterId: form.semesterId,
      component: form.component,
      title: form.title || undefined,
      score: Number(form.score),
      weight: Number(form.weight) || 1,
    })
    if (ok) {
      setShowForm(false)
      setForm({ studentId: '', subjectId: '', semesterId: '', component: 'ASSIGNMENT', title: '', score: '', weight: '1' })
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Nilai</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {showForm ? 'Tutup' : 'Input Nilai'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-3">
          <input
            placeholder="Cari siswa (nama/NIS)..."
            value={studentQ}
            onChange={(e) => setStudentQ(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            aria-label="Cari siswa"
          />
          <select required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Siswa">
            <option value="">Pilih siswa</option>
            {students?.items.map((s) => (
              <option key={s.id} value={s.id}>{s.fullName} ({s.nis})</option>
            ))}
          </select>
          <select required value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Mapel">
            <option value="">Pilih mapel</option>
            {subjects?.items.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select required value={form.semesterId} onChange={(e) => setForm({ ...form, semesterId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Semester">
            <option value="">Pilih semester</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>{s.yearName} - {s.name}</option>
            ))}
          </select>
          <select value={form.component} onChange={(e) => setForm({ ...form, component: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Komponen">
            {COMPONENTS.map((c) => (
              <option key={c} value={c}>{COMPONENT_LABEL[c]}</option>
            ))}
          </select>
          <input placeholder="Judul (opsional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Judul" />
          <input required type="number" min={0} max={1000} step="any" placeholder="Skor" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Skor" />
          <input type="number" min={0.1} max={100} step="any" placeholder="Bobot" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Bobot" />
          {inputError && <p role="alert" className="text-sm text-red-600 sm:col-span-3">{inputError}</p>}
          <button type="submit" disabled={inputting} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-3 sm:w-40">
            {inputting ? 'Menyimpan...' : 'Simpan Nilai'}
          </button>
        </form>
      )}

      <div className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Workflow Nilai</h2>
        <p className="mt-1 text-xs text-slate-400">Ajukan → Setujui → Terbitkan per semester. Penerbitan menghitung rapor berbobot.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={form.semesterId}
            onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            aria-label="Semester workflow"
          >
            <option value="">Pilih semester</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>{s.yearName} - {s.name}</option>
            ))}
          </select>
          {(['SUBMIT', 'APPROVE', 'PUBLISH'] as const).map((a) => (
            <button
              key={a}
              disabled={running || !form.semesterId}
              onClick={() => run(a, form.semesterId)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              {a === 'SUBMIT' ? 'Ajukan' : a === 'APPROVE' ? 'Setujui' : 'Terbitkan'}
            </button>
          ))}
        </div>
        {runError && <p role="alert" className="mt-2 text-sm text-red-600">{runError}</p>}
        {result && <p className="mt-2 text-sm text-green-700">{result}</p>}
      </div>

      <div className="mt-6">
        <input
          type="search"
          placeholder="Filter daftar: cari siswa lalu pilih..."
          value={studentQ}
          onChange={(e) => setStudentQ(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
          aria-label="Filter nilai per siswa"
        />
        {(students?.items.length ?? 0) > 0 && studentQ && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => setStudentId('')} className={`rounded-full px-3 py-1 text-xs ${!studentId ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-slate-200'}`}>Semua</button>
            {students?.items.slice(0, 8).map((s) => (
              <button
                key={s.id}
                onClick={() => setStudentId(s.id)}
                className={`rounded-full px-3 py-1 text-xs ${studentId === s.id ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-slate-200'}`}
              >
                {s.fullName}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat nilai.</p>
      ) : (gradesData?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Belum ada nilai" hint="Input nilai pertama di atas." /></div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Mapel</th>
                <th className="px-4 py-2.5">Komponen</th>
                <th className="px-4 py-2.5">Skor</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gradesData?.items.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-2.5 font-medium">{g.subject.name}</td>
                  <td className="px-4 py-2.5">{COMPONENT_LABEL[g.component] ?? g.component}{g.title ? ` - ${g.title}` : ''}</td>
                  <td className="px-4 py-2.5 font-mono">{g.score}</td>
                  <td className="px-4 py-2.5"><Badge color={STATUS_COLOR[g.status] ?? 'slate'}>{g.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  )
}
