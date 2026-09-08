'use client'

import { AppShell } from '@/components/app-shell'
import { useMe, useLogout } from '@/lib/auth-hooks'
import { useSummary, useAlerts } from '@/lib/command-hooks'

function fmtIDR(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

const SEV_COLOR: Record<string, string> = {
  INFO: 'bg-blue-100 text-blue-800',
  WARNING: 'bg-yellow-100 text-yellow-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

export default function CommandCenterPage() {
  const { data: me } = useMe()
  const logout = useLogout()
  const { data: s, isLoading } = useSummary()
  const { data: alerts } = useAlerts()

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  const cards: { label: string; value: string; sub?: string }[] = s
    ? [
        { label: 'Siswa Aktif', value: String(s.students.active), sub: `dari ${s.students.total} total` },
        { label: 'Kehadiran Hari Ini', value: s.students.attendanceRateToday === null ? '-' : `${s.students.attendanceRateToday}%`, sub: `${s.students.absentToday} tidak hadir` },
        { label: 'Guru', value: String(s.staff.teachers) },
        { label: 'Terkumpul', value: fmtIDR(s.finance.collectedTotal) },
        { label: 'Tunggakan', value: fmtIDR(s.finance.outstandingTotal), sub: `${s.finance.unpaidInvoices} invoice` },
        { label: 'Perangkat IoT', value: `${s.iot.devicesOnline}/${s.iot.devicesTotal}`, sub: `${s.iot.openAlerts} alert terbuka` },
        { label: 'Pinjaman Perpus', value: String(s.library.activeLoans), sub: `${s.library.overdueLoans} terlambat` },
        { label: 'Izin Menunggu', value: String(s.hr.pendingLeaves) },
      ]
    : []

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Command Center</h1>
          {s && <p className="text-xs text-slate-500">Diperbarui {new Date(s.generatedAt).toLocaleTimeString('id-ID')}</p>}
        </div>
        <button onClick={() => logout()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
          Keluar
        </button>
      </div>

      {isLoading ? (
        <div className="mt-6 h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" aria-label="Memuat" />
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{c.value}</p>
              {c.sub && <p className="mt-0.5 text-xs text-slate-400">{c.sub}</p>}
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Alert Terbuka</h2>
      {(alerts?.items.length ?? 0) === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Tidak ada alert terbuka.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-200 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {alerts?.items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span>{a.message}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEV_COLOR[a.severity] ?? 'bg-slate-100'}`}>
                {a.severity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
