'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { EmptyState, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useTimetable, useClasses, type TimetableSlot } from '@/lib/timetable-hooks'

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export default function TimetablePage() {
  const { data: me } = useMe()
  const { data: classes } = useClasses()
  const [classId, setClassId] = useState<string>('')
  const { data, isLoading, isError } = useTimetable(classId || undefined)

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  const byDay = new Map<number, TimetableSlot[]>()
  for (const slot of data?.items ?? []) {
    const list = byDay.get(slot.dayOfWeek) ?? []
    list.push(slot)
    byDay.set(slot.dayOfWeek, list)
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">Jadwal Pelajaran</h1>

      <div className="mt-4">
        <label htmlFor="class-select" className="block text-sm font-medium text-slate-700">Pilih Kelas</label>
        <select
          id="class-select"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Semua kelas</option>
          {classes?.items.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.academicYear.name})</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat jadwal.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Belum ada jadwal" hint="Tambahkan slot jadwal dari panel admin." /></div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DAYS.map((day, i) => {
            const slots = byDay.get(i + 1) ?? []
            if (slots.length === 0) return null
            return (
              <div key={day} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-sm font-semibold text-brand-700">{day}</h2>
                <ul className="mt-2 space-y-2">
                  {slots.sort((a, b) => a.startTime.localeCompare(b.startTime)).map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{s.subject.name}</p>
                        <p className="text-xs text-slate-500">{s.class.name}{s.room ? ` - ${s.room.name}` : ''}</p>
                      </div>
                      <span className="font-mono text-xs text-slate-600">{s.startTime}-{s.endTime}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
