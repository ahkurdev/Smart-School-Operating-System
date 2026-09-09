'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Modal, Spinner, useConfirm } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useStudents } from '@/lib/student-hooks'
import {
  usePrograms, useApplications, useCreateProgram, useApplyProgram, useDecideApplication,
} from '@/lib/scholarship-hooks'

const STATUS_COLOR: Record<string, 'yellow' | 'blue' | 'green' | 'red'> = {
  APPLIED: 'yellow', VERIFIED: 'blue', REVIEW: 'blue', APPROVED: 'green', REJECTED: 'red',
}
const APP_FILTERS = ['', 'APPLIED', 'VERIFIED', 'REVIEW', 'APPROVED', 'REJECTED'] as const

export default function ScholarshipPage() {
  const { data: me } = useMe()
  const { data: programs, isLoading, isError } = usePrograms()
  const [programFilter, setProgramFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const { data: apps } = useApplications(programFilter || undefined, statusFilter || undefined)
  const { create, loading: creating, error: createError, ok: createOk } = useCreateProgram()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', period: '', quota: '' })
  const [applyFor, setApplyFor] = useState<string | null>(null)
  const [studentQ, setStudentQ] = useState('')
  const { data: students } = useStudents(applyFor ? studentQ || undefined : undefined, 1)
  const [studentId, setStudentId] = useState('')
  const { apply, loading: applying, error: applyError } = useApplyProgram(applyFor ?? '')
  const { confirm, dialog } = useConfirm()
  const [decideErr, setDecideErr] = useState<string | null>(null)

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (await create({ name: form.name, period: form.period, quota: form.quota ? Number(form.quota) : undefined })) {
      setShowForm(false)
      setForm({ name: '', period: '', quota: '' })
    }
  }

  async function onApply(e: React.FormEvent) {
    e.preventDefault()
    if (await apply({ studentId })) {
      setApplyFor(null)
      setStudentId('')
    }
  }

  return (
    <AppShell>
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Beasiswa</h1>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          {showForm ? 'Tutup' : 'Program Baru'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={onCreate} className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-3">
          <input required minLength={2} placeholder="Nama program" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nama program" />
          <input required minLength={2} placeholder="Periode (mis. 2026 Ganjil)" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Periode" />
          <input type="number" min={1} placeholder="Kuota (opsional)" value={form.quota} onChange={(e) => setForm({ ...form, quota: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Kuota" />
          {createError && <p role="alert" className="text-sm text-red-600 sm:col-span-3">{createError}</p>}
          {createOk && <p className="text-sm text-green-700 sm:col-span-3">{createOk}</p>}
          <button type="submit" disabled={creating} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-3 sm:w-40">
            {creating ? '...' : 'Simpan'}
          </button>
        </form>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Program</h2>
      {isLoading ? (
        <div className="mt-4"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-4 text-sm text-red-600">Gagal memuat program.</p>
      ) : (programs?.items.length ?? 0) === 0 ? (
        <div className="mt-4"><EmptyState title="Belum ada program beasiswa" /></div>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {programs?.items.map((p) => (
            <li key={p.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-slate-500">{p.period}{p.quota ? ` · kuota ${p.quota}` : ''}</p>
              <button onClick={() => { setApplyFor(p.id); setStudentId('') }} className="mt-2 text-xs font-medium text-brand-600 hover:underline">
                Ajukan Siswa
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Pengajuan (keputusan manusia)</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs" aria-label="Filter program">
          <option value="">Semua program</option>
          {programs?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter status">
          {APP_FILTERS.map((s) => (
            <button key={s || 'ALL'} role="tab" aria-selected={statusFilter === s} onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1 text-xs font-medium ${statusFilter === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
              {s === '' ? 'Semua' : s}
            </button>
          ))}
        </div>
      </div>
      {decideErr && <p role="alert" className="mt-2 text-sm text-red-600">{decideErr}</p>}
      <div className="mt-3 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Siswa</th>
              <th className="px-4 py-2.5">Program</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(apps?.items ?? []).map((a) => (
              <AppRow key={a.id} app={a} onErr={setDecideErr} confirm={confirm} />
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={applyFor !== null} onClose={() => setApplyFor(null)} title="Ajukan Siswa">
        <form onSubmit={onApply} className="space-y-3">
          <input placeholder="Cari siswa..." value={studentQ} onChange={(e) => setStudentQ(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Cari siswa" />
          <select required value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Pilih siswa">
            <option value="">Pilih siswa</option>
            {students?.items.map((s) => <option key={s.id} value={s.id}>{s.fullName} ({s.nis})</option>)}
          </select>
          {applyError && <p role="alert" className="text-sm text-red-600">{applyError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setApplyFor(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
            <button type="submit" disabled={applying} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {applying ? '...' : 'Ajukan'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}

function AppRow({ app, onErr, confirm }: {
  app: { id: string; status: string; student: { fullName: string }; program: { name: string } }
  onErr: (m: string | null) => void
  confirm: (m: string) => Promise<boolean>
}) {
  return (
    <tr>
      <td className="px-4 py-2.5 font-medium">{app.student.fullName}</td>
      <td className="px-4 py-2.5 text-xs">{app.program.name}</td>
      <td className="px-4 py-2.5"><Badge color={STATUS_COLOR[app.status] ?? 'slate'}>{app.status}</Badge></td>
      <td className="px-4 py-2.5 text-right">
        <DecideButtons appId={app.id} status={app.status} name={app.student.fullName} confirm={confirm} onErr={onErr} />
      </td>
    </tr>
  )
}

function DecideButtons({ appId, status, name, confirm, onErr }: {
  appId: string; status: string; name: string
  confirm: (m: string) => Promise<boolean>
  onErr: (m: string | null) => void
}) {
  const { decide, loading } = useDecideApplication(appId)
  async function act(action: string, label: string) {
    if (!(await confirm(`${label} pengajuan ${name}?`))) return
    onErr(null)
    if (!(await decide({ action }))) onErr('Keputusan gagal — cek alur status.')
  }
  return (
    <div className="flex justify-end gap-2 text-xs font-medium">
      {status === 'APPLIED' && <button onClick={() => act('VERIFY', 'Verifikasi')} disabled={loading} className="text-blue-700 hover:underline disabled:opacity-50">Verifikasi</button>}
      {status === 'VERIFIED' && <button onClick={() => act('REVIEW', 'Review')} disabled={loading} className="text-blue-700 hover:underline disabled:opacity-50">Review</button>}
      {(status === 'VERIFIED' || status === 'REVIEW') && <button onClick={() => act('REJECT', 'Tolak')} disabled={loading} className="text-red-600 hover:underline disabled:opacity-50">Tolak</button>}
      {status === 'REVIEW' && <button onClick={() => act('APPROVE', 'Setujui')} disabled={loading} className="text-green-700 hover:underline disabled:opacity-50">Setujui</button>}
    </div>
  )
}
