'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Modal, Spinner, useConfirm } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import {
  useEmployees, useLeaves, useCreateEmployee, useRequestLeave, useDecideLeave,
} from '@/lib/hr-hooks'

const LEAVE_LABEL: Record<string, string> = { SICK: 'Sakit', ANNUAL: 'Tahunan', PERMISSION: 'Izin', OTHER: 'Lainnya' }
const LEAVE_COLOR: Record<string, 'yellow' | 'green' | 'red'> = { PENDING: 'yellow', APPROVED: 'green', REJECTED: 'red' }

export default function HrPage() {
  const { data: me } = useMe()
  const [q, setQ] = useState('')
  const { data, isLoading, isError } = useEmployees(q || undefined)
  const [leaveFilter, setLeaveFilter] = useState('PENDING')
  const { data: leaves } = useLeaves(leaveFilter || undefined)
  const { create, loading: creating, error: createError, ok: createOk } = useCreateEmployee()
  const { decide, loading: deciding } = useDecideLeave()
  const { confirm, dialog } = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fullName: '', nip: '', kind: 'TEACHER', position: '' })
  const [leaveFor, setLeaveFor] = useState<{ id: string; name: string } | null>(null)
  const [leaveForm, setLeaveForm] = useState({ kind: 'SICK', fromDate: '', toDate: '', reason: '' })
  const { request: requestFor, loading: requestingFor, error: reqForError } = useRequestLeave(leaveFor?.id ?? '')

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (await create({ fullName: form.fullName, nip: form.nip || undefined, kind: form.kind, position: form.position || undefined })) {
      setShowForm(false)
      setForm({ fullName: '', nip: '', kind: 'TEACHER', position: '' })
    }
  }

  async function onRequestLeave(e: React.FormEvent) {
    e.preventDefault()
    if (await requestFor({ kind: leaveForm.kind, fromDate: leaveForm.fromDate, toDate: leaveForm.toDate, reason: leaveForm.reason || undefined })) {
      setLeaveFor(null)
      setLeaveForm({ kind: 'SICK', fromDate: '', toDate: '', reason: '' })
    }
  }

  async function onDecide(id: string, action: 'APPROVE' | 'REJECT', name: string) {
    if (!(await confirm(`${action === 'APPROVE' ? 'Setujui' : 'Tolak'} cuti ${name}?`))) return
    await decide(id, action)
  }

  return (
    <AppShell>
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Guru & Staf</h1>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          {showForm ? 'Tutup' : 'Tambah Pegawai'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
          <input required minLength={2} placeholder="Nama lengkap" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nama lengkap" />
          <input placeholder="NIP" value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="NIP" />
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Jenis">
            <option value="TEACHER">Guru</option>
            <option value="STAFF">Staf</option>
          </select>
          <input placeholder="Jabatan" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Jabatan" />
          {createError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{createError}</p>}
          {createOk && <p className="text-sm text-green-700 sm:col-span-2">{createOk}</p>}
          <button type="submit" disabled={creating} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:w-40">
            {creating ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      )}

      <input type="search" placeholder="Cari nama..." value={q} onChange={(e) => setQ(e.target.value)} className="mt-4 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Cari pegawai" />

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat data.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Belum ada data pegawai" /></div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Nama</th>
                <th className="px-4 py-2.5">NIP</th>
                <th className="px-4 py-2.5">Jabatan</th>
                <th className="px-4 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5 font-medium">{e.fullName}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{e.nip ?? '-'}</td>
                  <td className="px-4 py-2.5">{e.position ?? e.kind}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => { setLeaveFor({ id: e.id, name: e.fullName }); setLeaveForm({ kind: 'SICK', fromDate: '', toDate: '', reason: '' }) }} className="text-xs font-medium text-brand-600 hover:underline">
                      Ajukan Cuti
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Pengajuan Cuti</h2>
      <div className="mt-2 flex flex-wrap gap-2" role="tablist" aria-label="Filter cuti">
        {['PENDING', 'APPROVED', 'REJECTED', ''].map((s) => (
          <button key={s || 'ALL'} role="tab" aria-selected={leaveFilter === s} onClick={() => setLeaveFilter(s)} className={`rounded-full px-3 py-1 text-xs font-medium ${leaveFilter === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {s === '' ? 'Semua' : s === 'PENDING' ? 'Menunggu' : s === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
          </button>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {(leaves?.items ?? []).map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm">
              <p className="font-medium">{l.employee.fullName}</p>
              <p className="text-slate-500">{LEAVE_LABEL[l.kind] ?? l.kind} · {l.fromDate.slice(0, 10)} s/d {l.toDate.slice(0, 10)}{l.reason ? ` · ${l.reason}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color={LEAVE_COLOR[l.status] ?? 'slate'}>{l.status}</Badge>
              {l.status === 'PENDING' && (
                <>
                  <button onClick={() => onDecide(l.id, 'APPROVE', l.employee.fullName)} disabled={deciding} className="text-xs font-medium text-green-700 hover:underline disabled:opacity-50">Setujui</button>
                  <button onClick={() => onDecide(l.id, 'REJECT', l.employee.fullName)} disabled={deciding} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">Tolak</button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Modal open={leaveFor !== null} onClose={() => setLeaveFor(null)} title={`Cuti — ${leaveFor?.name ?? ''}`}>
        <form onSubmit={onRequestLeave} className="space-y-3">
          <select value={leaveForm.kind} onChange={(e) => setLeaveForm({ ...leaveForm, kind: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Jenis cuti">
            {Object.entries(LEAVE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input required type="date" value={leaveForm.fromDate} onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Dari tanggal" />
            <input required type="date" value={leaveForm.toDate} onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Sampai tanggal" />
          </div>
          <input placeholder="Alasan (opsional)" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Alasan" />
          {reqForError && <p role="alert" className="text-sm text-red-600">{reqForError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setLeaveFor(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
            <button type="submit" disabled={requestingFor} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {requestingFor ? '...' : 'Ajukan'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
