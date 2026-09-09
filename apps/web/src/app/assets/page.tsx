'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Modal, Spinner, useConfirm } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import {
  useAssets, useDueMaintenance, useCreateAsset, useScheduleMaintenance, useCompleteMaintenance,
} from '@/lib/asset-hooks'

const CATS = ['ELECTRONIC', 'FURNITURE', 'VEHICLE', 'LAB', 'SPORT', 'OTHER'] as const
const COND_COLOR: Record<string, 'green' | 'yellow' | 'red' | 'slate'> = {
  GOOD: 'green', NEEDS_REPAIR: 'yellow', DAMAGED: 'red', DISPOSED: 'slate',
}

function fmtIDR(n: string | null): string {
  if (n === null) return '-'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n))
}

export default function AssetsPage() {
  const { data: me } = useMe()
  const [condFilter, setCondFilter] = useState('')
  const { data, isLoading, isError } = useAssets(condFilter || undefined)
  const { data: due } = useDueMaintenance()
  const { create, loading: creating, error: createError, ok: createOk } = useCreateAsset()
  const { complete, loading: completing } = useCompleteMaintenance()
  const { confirm, dialog } = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'ELECTRONIC', serialNumber: '', value: '' })
  const [maintFor, setMaintFor] = useState<{ id: string; name: string } | null>(null)
  const [maintDesc, setMaintDesc] = useState('')
  const { schedule, loading: scheduling, error: schedError } = useScheduleMaintenance(maintFor?.id ?? '')

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (await create({ name: form.name, category: form.category, serialNumber: form.serialNumber || undefined, value: form.value ? Number(form.value) : undefined })) {
      setShowForm(false)
      setForm({ name: '', category: 'ELECTRONIC', serialNumber: '', value: '' })
    }
  }

  async function onSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (await schedule({ description: maintDesc })) {
      setMaintFor(null)
      setMaintDesc('')
    }
  }

  async function onComplete(mid: string, name: string) {
    if (!(await confirm(`Maintenance "${name}" selesai? Kondisi aset kembali BAIK.`))) return
    await complete(mid)
  }

  return (
    <AppShell>
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Aset & Sarana</h1>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          {showForm ? 'Tutup' : 'Tambah Aset'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
          <input required minLength={2} placeholder="Nama aset" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nama aset" />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Kategori">
            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Nomor seri" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nomor seri" />
          <input type="number" min={0} placeholder="Nilai (Rp)" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nilai" />
          {createError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{createError}</p>}
          {createOk && <p className="text-sm text-green-700 sm:col-span-2">{createOk}</p>}
          <button type="submit" disabled={creating} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:w-40">
            {creating ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      )}

      {(due?.items.length ?? 0) > 0 && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-xs font-semibold uppercase text-amber-700">Perlu Maintenance ({due?.items.length})</p>
          <ul className="mt-1 space-y-1">
            {due?.items.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-800">
                <span>{m.asset.code} · {m.asset.name} — {m.description}</span>
                <button onClick={() => onComplete(m.id, m.asset.name)} disabled={completing} className="rounded-lg border border-amber-300 px-3 py-1 text-xs font-medium hover:bg-amber-100 disabled:opacity-50">
                  Selesai
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter kondisi">
        {['', 'GOOD', 'NEEDS_REPAIR', 'DAMAGED'].map((c) => (
          <button key={c || 'ALL'} role="tab" aria-selected={condFilter === c} onClick={() => setCondFilter(c)} className={`rounded-full px-3 py-1 text-xs font-medium ${condFilter === c ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {c === '' ? 'Semua' : c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat aset.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Belum ada aset" /></div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Kode</th>
                <th className="px-4 py-2.5">Nama</th>
                <th className="px-4 py-2.5">Nilai</th>
                <th className="px-4 py-2.5">Kondisi</th>
                <th className="px-4 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2.5 font-mono text-xs">{a.code}</td>
                  <td className="px-4 py-2.5 font-medium">{a.name}</td>
                  <td className="px-4 py-2.5">{fmtIDR(a.value)}</td>
                  <td className="px-4 py-2.5"><Badge color={COND_COLOR[a.condition] ?? 'slate'}>{a.condition}</Badge></td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => { setMaintFor({ id: a.id, name: a.name }); setMaintDesc('') }} className="text-xs font-medium text-brand-600 hover:underline">
                      Maintenance
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={maintFor !== null} onClose={() => setMaintFor(null)} title={`Maintenance — ${maintFor?.name ?? ''}`}>
        <form onSubmit={onSchedule} className="space-y-3">
          <textarea required minLength={2} rows={3} placeholder="Deskripsi kerusakan / pekerjaan" value={maintDesc} onChange={(e) => setMaintDesc(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Deskripsi maintenance" />
          {schedError && <p role="alert" className="text-sm text-red-600">{schedError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMaintFor(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
            <button type="submit" disabled={scheduling} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {scheduling ? '...' : 'Jadwalkan'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
