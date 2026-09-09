'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Modal, Spinner, useConfirm } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import {
  useRegistrations, useDecideReg, useEnrollReg,
} from '@/lib/ppdb-hooks'

const STATUS_COLOR: Record<string, 'yellow' | 'blue' | 'green' | 'red' | 'slate'> = {
  REGISTERED: 'yellow', VERIFIED: 'blue', SELECTED: 'green', REJECTED: 'red', ENROLLED: 'slate',
}
const FILTERS = ['', 'REGISTERED', 'VERIFIED', 'SELECTED', 'ENROLLED', 'REJECTED'] as const

export default function PpdbPage() {
  const { data: me } = useMe()
  const [filter, setFilter] = useState<string>('')
  const { data, isLoading, isError } = useRegistrations(filter || undefined)
  const { decide, loading: deciding, error: decideError } = useDecideReg()
  const { enroll, loading: enrolling, error: enrollError } = useEnrollReg()
  const { confirm, dialog } = useConfirm()
  const [enrollFor, setEnrollFor] = useState<{ id: string; name: string } | null>(null)
  const [nis, setNis] = useState('')

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onDecide(id: string, action: 'VERIFY' | 'SELECT' | 'REJECT', name: string) {
    const label = action === 'VERIFY' ? 'Verifikasi' : action === 'SELECT' ? 'Luluskan seleksi' : 'Tolak'
    if (!(await confirm(`${label} ${name}?`))) return
    await decide(id, action)
  }

  async function onEnroll(e: React.FormEvent) {
    e.preventDefault()
    if (!enrollFor) return
    if (!(await confirm(`Daftarkan ulang ${enrollFor.name} dengan NIS ${nis}? Data siswa akan dibuat.`))) return
    if (await enroll(enrollFor.id, nis)) {
      setEnrollFor(null)
      setNis('')
    }
  }

  return (
    <AppShell>
      {dialog}
      <h1 className="text-xl font-semibold">PPDB</h1>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter status">
        {FILTERS.map((s) => (
          <button key={s || 'ALL'} role="tab" aria-selected={filter === s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {s === '' ? 'Semua' : s}
          </button>
        ))}
      </div>
      {decideError && <p role="alert" className="mt-2 text-sm text-red-600">{decideError}</p>}
      {enrollError && <p role="alert" className="mt-2 text-sm text-red-600">{enrollError}</p>}

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat pendaftar.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Belum ada pendaftar" /></div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">No. Daftar</th>
                <th className="px-4 py-2.5">Nama</th>
                <th className="px-4 py-2.5">Asal Sekolah</th>
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
                    <p className="text-xs text-slate-400">{r.parentName ?? ''}{r.parentPhone ? ` · ${r.parentPhone}` : ''}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{r.originSchool ?? '-'}</td>
                  <td className="px-4 py-2.5"><Badge color={STATUS_COLOR[r.status] ?? 'slate'}>{r.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-2 text-xs font-medium">
                      {r.status === 'REGISTERED' && (
                        <>
                          <button onClick={() => onDecide(r.id, 'VERIFY', r.fullName)} disabled={deciding} className="text-blue-700 hover:underline disabled:opacity-50">Verifikasi</button>
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
                        <button onClick={() => { setEnrollFor({ id: r.id, name: r.fullName }); setNis('') }} className="text-brand-600 hover:underline">
                          Daftar Ulang
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={enrollFor !== null} onClose={() => setEnrollFor(null)} title={`Daftar Ulang — ${enrollFor?.name ?? ''}`}>
        <form onSubmit={onEnroll} className="space-y-3">
          <p className="text-sm text-slate-600">Membuat data siswa nyata dengan NIS berikut.</p>
          <input required minLength={3} placeholder="NIS baru" value={nis} onChange={(e) => setNis(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" aria-label="NIS baru" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEnrollFor(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
            <button type="submit" disabled={enrolling} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {enrolling ? '...' : 'Buat Siswa'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
