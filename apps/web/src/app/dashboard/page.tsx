'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { useMe, useLogout } from '@/lib/auth-hooks'
import { useStudents } from '@/lib/student-hooks'
import { useCreateStudent, useDeleteStudent } from '@/lib/student-mutations'
import { useAttendance, useAbsent } from '@/lib/attendance-hooks'
import { useSummary, useAlerts } from '@/lib/command-hooks'

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Hadir', SICK: 'Sakit', EXCUSED: 'Izin', ABSENT: 'Alfa', LATE: 'Terlambat', EARLY_LEAVE: 'Pulang Awal',
}
const STATUS_COLOR: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-800', SICK: 'bg-blue-100 text-blue-800',
  EXCUSED: 'bg-yellow-100 text-yellow-800', ABSENT: 'bg-red-100 text-red-800',
  LATE: 'bg-orange-100 text-orange-800', EARLY_LEAVE: 'bg-slate-100 text-slate-700',
}
const SEV_COLOR: Record<string, string> = {
  INFO: 'bg-blue-100 text-blue-800', WARNING: 'bg-yellow-100 text-yellow-800', CRITICAL: 'bg-red-100 text-red-800',
}
function fmtIDR(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function StudentsPage() {
  const { data: me } = useMe()
  const logout = useLogout()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading, isError } = useStudents(q || undefined, page)
  const { create, loading: creating, error: createError } = useCreateStudent()
  const { remove, loading: deleting } = useDeleteStudent()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nis: '', fullName: '', gender: 'MALE' as 'MALE' | 'FEMALE' })
  const today = new Date().toISOString().slice(0, 10)
  const { data: attendance } = useAttendance(today)
  const { data: absent } = useAbsent(today)
  const { data: summary } = useSummary()
  const { data: alerts } = useAlerts()

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ok = await create(form)
    if (ok) {
      setShowForm(false)
      setForm({ nis: '', fullName: '', gender: 'MALE' })
    }
  }

  const cards = summary
    ? [
        { label: 'Siswa Aktif', value: String(summary.students.active), sub: `dari ${summary.students.total}` },
        { label: 'Kehadiran', value: summary.students.attendanceRateToday === null ? '-' : `${summary.students.attendanceRateToday}%` },
        { label: 'Terkumpul', value: fmtIDR(summary.finance.collectedTotal) },
        { label: 'Tunggakan', value: fmtIDR(summary.finance.outstandingTotal) },
      ]
    : []

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <button onClick={() => logout()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
          Keluar
        </button>
      </div>

      {summary && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className="mt-1 text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {alerts && alerts.items.length > 0 && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-xs font-semibold uppercase text-amber-700">{alerts.items.length} Alert Terbuka</p>
          <ul className="mt-1 space-y-1 text-sm text-amber-800">
            {alerts.items.slice(0, 3).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span>{a.message}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${SEV_COLOR[a.severity] ?? ''}`}>{a.severity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Absensi Hari Ini</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {attendance && Object.keys(attendance.summary).length > 0 ? (
            Object.entries(attendance.summary).map(([st, n]) => (
              <span key={st} className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLOR[st] ?? 'bg-slate-100'}`}>
                {STATUS_LABEL[st] ?? st}: {n}
              </span>
            ))
          ) : (
            <p className="text-sm text-slate-500">Belum ada data.</p>
          )}
        </div>
        {absent && absent.items.length > 0 && (
          <p className="mt-2 text-sm text-slate-600">
            Tidak hadir: {absent.items.map((i) => i.fullName).slice(0, 5).join(', ')}
            {absent.items.length > 5 ? ` +${absent.items.length - 5}` : ''}
          </p>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Siswa Terbaru</h2>
          <div className="flex gap-2">
            <input
              type="search"
              placeholder="Cari..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              aria-label="Cari siswa"
            />
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {showForm ? 'Tutup' : 'Tambah'}
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={onSubmit} className="mt-3 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-4">
            <input required placeholder="NIS" value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="NIS" />
            <input required minLength={2} placeholder="Nama lengkap" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" aria-label="Nama lengkap" />
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as 'MALE' | 'FEMALE' })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Jenis kelamin">
              <option value="MALE">Laki-laki</option>
              <option value="FEMALE">Perempuan</option>
            </select>
            {createError && <p role="alert" className="text-sm text-red-600 sm:col-span-4">{createError}</p>}
            <button type="submit" disabled={creating} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-4 sm:w-32">
              {creating ? 'Menyimpan...' : 'Simpan'}
            </button>
          </form>
        )}

        {isLoading ? (
          <div className="mt-4 h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" aria-label="Memuat" />
        ) : isError ? (
          <p role="alert" className="mt-4 text-sm text-red-600">Gagal memuat data.</p>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Belum ada siswa.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">NIS</th>
                  <th className="px-4 py-2.5">Nama</th>
                  <th className="px-4 py-2.5">L/P</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2.5 font-mono text-xs">{s.nis}</td>
                    <td className="px-4 py-2.5 font-medium">{s.fullName}</td>
                    <td className="px-4 py-2.5">{s.gender === 'MALE' ? 'L' : 'P'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => { if (confirm(`Hapus ${s.fullName}?`)) remove(s.id) }} disabled={deleting} className="text-xs text-red-600 hover:underline disabled:opacity-50">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > data.take && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Sebelumnya</button>
            <span className="text-slate-500">Halaman {data.page} / {Math.ceil(data.total / data.take)}</span>
            <button disabled={page * data.take >= data.total} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Berikutnya</button>
          </div>
        )}
      </section>
    </AppShell>
  )
}
