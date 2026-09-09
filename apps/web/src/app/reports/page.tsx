'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { EmptyState, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { api, ApiError } from '@/lib/api'

type Source = 'students' | 'ppdb' | 'audit'

const SOURCES: { id: Source; label: string; path: string; fields: string[] }[] = [
  { id: 'students', label: 'Data Siswa', path: '/api/students?take=1000', fields: ['nis', 'nisn', 'fullName', 'gender', 'entryYear', 'status'] },
  { id: 'ppdb', label: 'Pendaftar PPDB', path: '/api/ppdb/registrations', fields: ['regNumber', 'fullName', 'gender', 'originSchool', 'parentName', 'parentPhone', 'status'] },
  { id: 'audit', label: 'Audit Log', path: '/api/audit', fields: ['action', 'resource', 'resourceId', 'createdAt'] },
]

function toCsv(rows: Record<string, unknown>[], cols: string[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

export default function ReportsPage() {
  const { data: me } = useMe()
  const [source, setSource] = useState<Source>('students')
  const [cols, setCols] = useState<string[]>(SOURCES[0].fields)
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const def = SOURCES.find((s) => s.id === source)!

  function pickSource(id: Source) {
    setSource(id)
    const d = SOURCES.find((s) => s.id === id)!
    setCols(d.fields)
    setRows(null)
    setError(null)
  }

  function toggleCol(c: string) {
    setCols(cols.includes(c) ? cols.filter((x) => x !== c) : [...cols, c])
  }

  async function preview() {
    setLoading(true)
    setError(null)
    try {
      const data = await api<{ items: Record<string, unknown>[] }>(def.path)
      setRows(data.items.slice(0, 500))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  function download() {
    if (!rows || cols.length === 0) return
    const blob = new Blob([toCsv(rows, cols)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-${source}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">Laporan</h1>
      <p className="mt-1 text-sm text-slate-500">Pilih sumber data, kolom, pratinjau, lalu unduh CSV.</p>

      <div className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sumber data">
          {SOURCES.map((s) => (
            <button key={s.id} role="tab" aria-selected={source === s.id} onClick={() => pickSource(s.id)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${source === s.id ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <fieldset className="mt-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kolom</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {def.fields.map((f) => (
              <label key={f} className="flex items-center gap-1.5 font-mono text-xs">
                <input type="checkbox" checked={cols.includes(f)} onChange={() => toggleCol(f)} /> {f}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-3 flex gap-2">
          <button onClick={preview} disabled={loading || cols.length === 0} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? 'Memuat...' : 'Pratinjau'}
          </button>
          <button onClick={download} disabled={!rows || rows.length === 0} className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50">
            Unduh CSV
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {loading && <div className="mt-6"><Spinner /></div>}
      {rows && rows.length === 0 && <div className="mt-6"><EmptyState title="Tidak ada baris data" /></div>}
      {rows && rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left font-mono text-xs text-slate-500">
              <tr>
                {cols.map((c) => <th key={c} className="px-4 py-2.5">{c}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 50).map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => <td key={c} className="px-4 py-2 text-xs">{String(r[c] ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-3 text-xs text-slate-400">Menampilkan 50 dari {rows.length} baris. File CSV berisi semua.</p>
        </div>
      )}
    </AppShell>
  )
}
