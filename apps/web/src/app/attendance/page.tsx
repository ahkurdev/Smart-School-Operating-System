'use client'

import { AppShell } from '@/components/app-shell'
import { useMe } from '@/lib/auth-hooks'
import { useAttendance, useAbsent } from '@/lib/attendance-hooks'

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Hadir',
  SICK: 'Sakit',
  EXCUSED: 'Izin',
  ABSENT: 'Alfa',
  LATE: 'Terlambat',
  EARLY_LEAVE: 'Pulang Awal',
}

const STATUS_COLOR: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-800',
  SICK: 'bg-blue-100 text-blue-800',
  EXCUSED: 'bg-yellow-100 text-yellow-800',
  ABSENT: 'bg-red-100 text-red-800',
  LATE: 'bg-orange-100 text-orange-800',
  EARLY_LEAVE: 'bg-slate-100 text-slate-700',
}

export default function AttendancePage() {
  const { data: me } = useMe()
  const today = new Date().toISOString().slice(0, 10)
  const { data, isLoading, isError } = useAttendance(today)
  const { data: absent } = useAbsent(today)

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">Absensi Hari Ini</h1>
      <p className="mt-1 text-sm text-slate-500">{today}</p>

      {isLoading ? (
        <div className="mt-6 h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" aria-label="Memuat" />
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat absensi.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(data?.summary ?? {}).map(([status, count]) => (
              <div key={status} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-2xl font-bold">{count}</p>
                <p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status] ?? 'bg-slate-100'}`}>
                  {STATUS_LABEL[status] ?? status}
                </p>
              </div>
            ))}
          </div>
          {(data?.summary && Object.keys(data.summary).length === 0) && (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Belum ada absensi tercatat hari ini.
            </div>
          )}

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Tidak Hadir / Terlambat</h2>
          {(absent?.items.length ?? 0) === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Semua siswa hadir.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-200 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              {absent?.items.map((s) => (
                <li key={s.id} className="flex items-center justify-between p-3 text-sm">
                  <span className="font-medium">{s.fullName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[s.status] ?? 'bg-slate-100'}`}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AppShell>
  )
}
