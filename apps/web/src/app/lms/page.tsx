'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Modal, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useSubjects } from '@/lib/grade-hooks'
import { useClasses } from '@/lib/timetable-hooks'
import {
  useCourses, useCourse, useCreateCourse, useAddMaterial, useAddAssignment, useOrgUsers,
} from '@/lib/lms-hooks'

export default function LmsPage() {
  const { data: me } = useMe()
  const { data: courses, isLoading, isError } = useCourses()
  const { data: subjects } = useSubjects()
  const { data: classes } = useClasses()
  const { data: teachers } = useOrgUsers()
  const { create, loading: creating, error: createError } = useCreateCourse()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: detail } = useCourse(selectedId)
  const { add: addMaterial, loading: addingM, error: materialError } = useAddMaterial(selectedId ?? '')
  const { add: addAssignment, loading: addingA, error: assignmentError } = useAddAssignment(selectedId ?? '')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ subjectId: '', classId: '', teacherUserId: '', name: '' })
  const [matForm, setMatForm] = useState({ title: '', kind: 'TEXT', body: '' })
  const [asgForm, setAsgForm] = useState({ title: '', kind: 'ESSAY', dueAt: '' })
  const [ok, setOk] = useState<string | null>(null)

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setOk(null)
    if (await create(form)) {
      setShowForm(false)
      setForm({ subjectId: '', classId: '', teacherUserId: '', name: '' })
      setOk('Kelas dibuat.')
    }
  }

  async function onAddMaterial(e: React.FormEvent) {
    e.preventDefault()
    setOk(null)
    if (await addMaterial({ title: matForm.title, kind: matForm.kind, body: matForm.body || undefined })) {
      setMatForm({ title: '', kind: 'TEXT', body: '' })
      setOk('Materi ditambahkan.')
    }
  }

  async function onAddAssignment(e: React.FormEvent) {
    e.preventDefault()
    setOk(null)
    if (await addAssignment({ title: asgForm.title, kind: asgForm.kind, dueAt: asgForm.dueAt || undefined })) {
      setAsgForm({ title: '', kind: 'ESSAY', dueAt: '' })
      setOk('Tugas dibuat.')
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">E-Learning</h1>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          {showForm ? 'Tutup' : 'Buat Kelas'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
          <input required minLength={2} placeholder="Nama kelas (mis. IPA X-1)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nama kelas" />
          <select required value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Mapel">
            <option value="">Pilih mapel</option>
            {subjects?.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Rombel">
            <option value="">Pilih rombel</option>
            {classes?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select required value={form.teacherUserId} onChange={(e) => setForm({ ...form, teacherUserId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Guru">
            <option value="">Pilih guru</option>
            {teachers?.items.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </select>
          {createError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{createError}</p>}
          <button type="submit" disabled={creating} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:w-40">
            {creating ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      )}
      {ok && <p className="mt-2 text-sm text-green-700">{ok}</p>}

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat kelas.</p>
      ) : (courses?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Belum ada kelas" hint="Buat kelas pertama di atas." /></div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ul className="space-y-2">
            {courses?.items.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-xl bg-white p-4 text-left shadow-sm ring-1 ${selectedId === c.id ? 'ring-2 ring-brand-500' : 'ring-slate-200 hover:ring-slate-300'}`}
                >
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-slate-500">{c.subject.name} · {c.class.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{c._count.materials} materi · {c._count.assignments} tugas</p>
                </button>
              </li>
            ))}
          </ul>

          <div>
            {!selectedId ? (
              <EmptyState title="Pilih kelas" hint="Klik salah satu kelas untuk melihat materi dan tugas." />
            ) : !detail ? (
              <Spinner />
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <h2 className="font-semibold">{detail.name}</h2>
                  <h3 className="mt-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Materi ({detail.materials.length})</h3>
                  <ul className="mt-1 space-y-1">
                    {detail.materials.map((m) => (
                      <li key={m.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span>{m.title}</span>
                        <Badge color="blue">{m.kind}</Badge>
                      </li>
                    ))}
                  </ul>
                  <form onSubmit={onAddMaterial} className="mt-3 flex flex-wrap gap-2">
                    <input required minLength={2} placeholder="Judul materi" value={matForm.title} onChange={(e) => setMatForm({ ...matForm, title: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" aria-label="Judul materi" />
                    <button disabled={addingM} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                      {addingM ? '...' : 'Tambah'}
                    </button>
                  </form>
                  {materialError && <p role="alert" className="mt-1 text-xs text-red-600">{materialError}</p>}
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Tugas ({detail.assignments.length})</h3>
                  <ul className="mt-1 space-y-1">
                    {detail.assignments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span>{a.title}</span>
                        <span className="text-xs text-slate-400">{a.dueAt ? new Date(a.dueAt).toLocaleDateString('id-ID') : 'Tanpa tenggat'}</span>
                      </li>
                    ))}
                  </ul>
                  <form onSubmit={onAddAssignment} className="mt-3 flex flex-wrap gap-2">
                    <input required minLength={2} placeholder="Judul tugas" value={asgForm.title} onChange={(e) => setAsgForm({ ...asgForm, title: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" aria-label="Judul tugas" />
                    <input type="datetime-local" value={asgForm.dueAt} onChange={(e) => setAsgForm({ ...asgForm, dueAt: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" aria-label="Tenggat" />
                    <button disabled={addingA} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                      {addingA ? '...' : 'Buat'}
                    </button>
                  </form>
                  {assignmentError && <p role="alert" className="mt-1 text-xs text-red-600">{assignmentError}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  )
}
