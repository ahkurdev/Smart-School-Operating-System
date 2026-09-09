'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Modal, Spinner, useConfirm } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import {
  usePpdbRegistrations,
  useRegisterPpdb,
  useDecidePpdb,
  useEnrollPpdb,
  type PpdbStatus,
} from '@/lib/ppdb-hooks'

const STATUS_LABEL: Record<PpdbStatus, string> = {
  REGISTERED: 'Terdaftar',
  VERIFIED: 'Terverifikasi',
  SELECTED: 'Lolos Seleksi',
  REJECTED: 'Ditolak',
  ENROLLED: 'Daftar Ulang',
}
const STATUS_COLOR: Record<PpdbStatus, 'slate' | 'blue' | 'yellow' | 'red' | 'green'> = {
  REGISTERED: 'slate',
  VERIFIED: 'blue',
  SELECTED: 'yellow',
  REJECTED: 'red',
  ENROLLED: 'green',
}
const FILTERS: (PpdbStatus | 'ALL')[] = ['ALL', 'REGISTERED', 'VERIFIED', 'SELECTED', 'REJECTED', 'ENROLLED']

export default function PpdbPage() {
  const { data: me } = useMe()
  const [filter, setFilter] = useState<PpdbStatus | 'ALL'>('ALL')
  const { data, isLoading, isError } = usePpdbRegistrations(filter === 'ALL' ? undefined : filter)
  const { register, loading: registering, error: regError } = useRegisterPpdb()
  const { decide, loading: deciding, error: decideError } = useDecidePpdb()
  const { enroll, loading: enrolling, error: enrollError } = useEnrollPpdb()
  const { confirm, dialog } = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fullName: '', gender: 'MALE' as 'MALE' | 'FEMALE', originSchool: '', parentName: '', parentPhone: '' })
  const [enrollFor, setEnrollFor] = useState<string | null>(null)
  const [nis, setNis] = useState('')

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ok = await register({
      fullName: form.fullName,
      gender: form.gender,
      originSchool: form.originSchool || undefined,
      parentName: form.parentName || undefined,
      parentPhone: form.parentPhone || undefined,
    })
    if (ok) {
      setShowForm(false)
      setForm({ fullName: '', gender: 'MALE', originSchool: '', parentName: '', parentPhone: '' })
    }
  }

  async function onDecide(id: string, action: 'VERIFY' | 'SELECT' | 'REJECT', name: string) {
    if (!(await confirm(`${action === 'REJECT' ? 'Tolak' : action === 'VERIFY' ? 'Verifikasi' : 'Luluskan'} ${name}?`))) return
    await decide(id, action)
  }

  async function onEnroll(e: React.FormEvent) {
    e.preventDefault()
    if (!enrollFor) return
    const ok = await enroll(enrollFor, nis)
    if (ok) {
      setEnrollFor(null)
      setNis('')
    }
  }

  return (
    <AppShell>
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">PPDB</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {showForm ? 'Tutup' : 'Pendaftaran Baru'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
          <input required minLength={2} placeholder="Nama lengkap calon siswa" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nama lengkap" />
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as 'MALE' | 'FEMALE' })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Jenis kelamin">
            <option value="MALE">Laki-laki</option>
            <option value="FEMALE">Perempuan</option>
          </select>
          <input placeholder="Asal sekolah" value={form.originSchool} onChange={(e) => setForm({ ...form, originSchool: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Asal sekolah" />
          <input placeholder="Nama orang tua" value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nama orang tua" />
          <input placeholder="No. HP orang tua" value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" aria-label="No HP orang tua" />
          {regError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{regError}</p>}
          <button type="submit" disabled={registering} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:w-40">
            {registering ? 'Menyimpan...' : 'Daftarkan'}
          </button>
        </form>
      )}

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter status">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === f ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
          >
            {f === 'ALL' ? 'Semua' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {(decideError || enrollError) && (
        <p role="alert" className="mt-3 text-sm text-red-600">{decideError ?? enrollError}</p>
      )}

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat pendaftar.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Belum ada pendaftar" hint="Tambahkan pendaftaran baru di atas." /></div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">No. Daftar</th>
                <th className="px-4 py-2.5">Nama</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.regNumber}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{r.fullName}</p>
                    <p className="text-xs text-slate-400">{r.originSchool ?? '-'}</p>
                  </td>
                  <td className="px-4 py-2.5"><Badge color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-2 text-xs font-medium">
                      {r.status === 'REGISTERED' && (
                        <>
                          <button onClick={() => onDecide(r.id, 'VERIFY', r.fullName)} disabled={deciding} className="text-brand-600 hover:underline disabled:opacity-50">Verifikasi</button>
                          <button onClick={() => onDecide(r.id, 'REJECT', r.fullName)} disabled={deciding} className="text-red-600 hover:underline disabled:opacity-50">Tolak</button>
                        </>
                      )}
                      {r.status === 'VERIFIED' && (
                        <>
                          <button onClick={() => onDecide(r.id, 'SELECT', r.fullName)} disabled={deciding} className="text-green-700 hover:underline disabled:opacity-50">Luluskan</button>
                          <button onClick={() => onDecide(r.id, 'REJECT', r.fullName)} disabled={deciding} className="text-red-600 hover:underline disabled:opacity-50">Tolak</button>
                        </>
                      )}
                      {r.status === 'SELECTED' && (
                        <button onClick={() => { setEnrollFor(r.id); setNis('') }} className="text-brand-600 hover:underline">Daftar Ulang</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={enrollFor !== null} onClose={() => setEnrollFor(null)} title="Daftar Ulang">
        <form onSubmit={onEnroll} className="space-y-3">
          <p className="text-sm text-slate-600">Masukkan NIS untuk membuat data siswa dari pendaftar ini.</p>
          <input
            required
            placeholder="NIS"
            value={nis}
            onChange={(e) => setNis(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            aria-label="NIS siswa baru"
          />
          {enrollError && <p role="alert" className="text-sm text-red-600">{enrollError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEnrollFor(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
            <button type="submit" disabled={enrolling} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {enrolling ? 'Memproses...' : 'Buat Siswa'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
