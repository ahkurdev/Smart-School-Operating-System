'use client'

import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import { useMe, useLogout } from '@/lib/auth-hooks'
import {
  useStudentMe,
  useMyTimetable,
  useMyAssignments,
  useMyGrades,
  useMyAttendance,
} from '@/lib/student-portal-hooks'

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Hadir', SICK: 'Sakit', EXCUSED: 'Izin', ABSENT: 'Alfa', LATE: 'Terlambat', EARLY_LEAVE: 'Pulang Awal',
}
const STATUS_COLOR: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'orange' | 'slate'> = {
  PRESENT: 'green', SICK: 'blue', EXCUSED: 'yellow', ABSENT: 'red', LATE: 'orange', EARLY_LEAVE: 'slate',
}

export default function StudentPortalPage() {
  const { data: me, isLoading: meLoading, isError: meError } = useMe()
  const logout = useLogout()
  const { data: profile, isLoading: profileLoading, isError: profileError } = useStudentMe()
  const { data: timetable } = useMyTimetable()
  const { data: courses } = useMyAssignments()
  const { data: grades } = useMyGrades()
  const to = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const { data: attendance } = useMyAttendance(from, to)

  if (!me && !meLoading) {
    return (
      <AppShell>
        <EmptyState title="Belum masuk" hint="Masuk untuk membuka portal siswa." />
      </AppShell>
    )
  }

  const pending = (courses?.items ?? []).flatMap((c) =>
    c.assignments
      .filter((a) => a.submissions.length === 0)
      .map((a) => ({ ...a, courseName: c.name, subjectName: c.subject.name })),
  )

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Portal Siswa</h1>
        <button onClick={() => logout()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
          Keluar
        </button>
      </div>

      {meLoading || profileLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : meError || profileError || !profile ? (
        <div className="mt-6">
          <EmptyState
            title="Akun ini belum tertaut ke data siswa"
            hint="Hubungi tata usaha untuk menautkan akun Anda."
          />
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="font-semibold">{profile.fullName}</p>
            <p className="mt-0.5 text-sm text-slate-500">
              NIS {profile.nis}
              {profile.enrollment ? ` · ${profile.enrollment.class.name} · ${profile.enrollment.academicYear.name}` : ' · Belum ada kelas'}
            </p>
          </div>

          <section aria-label="Tugas belum dikumpulkan">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Tugas Menunggu ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Semua tugas sudah dikumpulkan.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                {pending.slice(0, 10).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-slate-500">{a.subjectName}{a.dueAt ? ` · Tenggat ${new Date(a.dueAt).toLocaleString('id-ID')}` : ''}</p>
                    </div>
                    {a.dueAt && new Date(a.dueAt) < new Date() && <Badge color="red">Terlambat</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Jadwal saya">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Jadwal Kelas</h2>
            {!timetable || timetable.items.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Belum ada jadwal.</p>
            ) : (
              <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {DAYS.map((day, i) => {
                  const slots = (timetable?.items ?? [])
                    .filter((s) => s.dayOfWeek === i + 1)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  if (slots.length === 0) return null
                  return (
                    <div key={day} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                      <h3 className="text-sm font-semibold text-brand-700">{day}</h3>
                      <ul className="mt-2 space-y-2">
                        {slots.map((s) => (
                          <li key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                            <div>
                              <p className="font-medium">{s.subject.name}</p>
                              <p className="text-xs text-slate-500">{s.room ? s.room.name : ''}</p>
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
          </section>

          <section aria-label="Nilai saya">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Nilai Akhir</h2>
            {!grades || grades.finals.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Belum ada nilai yang diterbitkan.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                {grades.finals.map((g) => (
                  <li key={g.subject} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>{g.subject}</span>
                    <span className="font-mono font-semibold">{g.final}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Kehadiran saya">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Kehadiran (30 hari)</h2>
            {!attendance || Object.keys(attendance.summary).length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Belum ada data.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(attendance.summary).map(([st, n]) => (
                  <Badge key={st} color={STATUS_COLOR[st] ?? 'slate'}>
                    {STATUS_LABEL[st] ?? st}: {n}
                  </Badge>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  )
}
