'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Modal, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useStudents } from '@/lib/student-hooks'
import {
  useCounseling, useCounselingDetail, useCreateCounseling, useCompleteCounseling,
} from '@/lib/counseling-hooks'

const CATS = ['AKADEMIK', 'KELUARGA', 'MENTAL', 'DISIPLIN', 'KARIR', 'LAIN'] as const
const STATUS_COLOR: Record<string, 'blue' | 'green' | 'slate' | 'yellow'> = {
  SCHEDULED: 'blue', COMPLETED: 'green', CANCELLED: 'slate', REFERRED: 'yellow',
}

export default function CounselingPage() {
  const { data: me } = useMe()
  const { data, isLoading, isError } = useCounseling()
  const { create, loading: creating, error: createError } = useCreateCounseling()
  const { complete, loading: completing, error: completeError } = useCompleteCounseling()
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data: detail } = useCounselingDetail(detailId)
  const [showForm, setShowForm] = useState(false)
  const [studentQ, setStudentQ] = useState('')
  const { data: students } = useStudents(showForm ? studentQ || undefined : undefined, 1)
  const [form, setForm] = useState({ studentId: '', category: 'AKADEMIK', title: '', notes: '' })
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
    if (await create({ studentId: form.studentId, category: form.category, title: form.title, notes: form.notes || undefined })) {
      setShowForm(false)
      setForm({ studentId: '', category: 'AKADEMIK', title: '', notes: '' })
      setOk('Jadwal konseling dibuat.')
    }
  }

  async function onComplete() {
    if (!detailId) return
    if (await complete(detailId, {})) setDetailId(null)
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Bimbingan Konseling</h1>
          <p className="mt-0.5 text-xs text-slate-400">Data rahasia — setiap akses detail dicatat audit.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          {showForm ? 'Tutup' : 'Jadwalkan'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
          <input placeholder="Cari siswa..." value={studentQ} onChange={(e) => setStudentQ(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Cari siswa" />
          <select required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Siswa">
            <option value="">Pilih siswa</option>
            {students?.items.map((s) => <option key={s.id} value={s.id}>{s.fullName} ({s.nis})</option>)}
          </select>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Kategori">
            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input required minLength={2} placeholder="Judul sesi" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Judul sesi" />
          {createError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{createError}</p>}
          {ok && <p className="text-sm text-green-700 sm:col-span-2">{ok}</p>}
          <button type="submit" disabled={creating} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:w-40">
            {creating ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat data.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Belum ada sesi konseling" /></div>
      ) : (
        <ul className="mt-4 space-y-2">
          {data?.items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm">
                <p className="font-medium">{r.title}</p>
                <p className="text-slate-500">{r.student.fullName} · {r.category}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={STATUS_COLOR[r.status] ?? 'slate'}>{r.status}</Badge>
                <button onClick={() => setDetailId(r.id)} className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
                  Detail
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={detailId !== null} onClose={() => setDetailId(null)} title="Detail Konseling (rahasia)">
        {!detail ? (
          <Spinner />
        ) : (
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Siswa:</span> {detail.student.fullName} ({detail.student.nis})</p>
            <p><span className="font-medium">Catatan:</span> {detail.notes ?? '-'}</p>
            <p><span className="font-medium">Tindak lanjut:</span> {detail.action ?? '-'}</p>
            {completeError && <p role="alert" className="text-red-600">{completeError}</p>}
            {detail.status !== 'COMPLETED' && (
              <button onClick={onComplete} disabled={completing} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {completing ? '...' : 'Tandai Selesai'}
              </button>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  )
}
