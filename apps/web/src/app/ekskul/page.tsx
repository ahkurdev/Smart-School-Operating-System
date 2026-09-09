'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { EmptyState, Modal, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useStudents } from '@/lib/student-hooks'
import {
  useEkskul, useAchievements, useCreateEkskul, useAddMember, useAddAchievement,
} from '@/lib/ekskul-hooks'

const KINDS = ['CLUB', 'OSIS', 'TEAM'] as const
const TYPES = ['AKADEMIK', 'NON_AKADEMIK', 'OLAHRAGA', 'SENI'] as const
const LEVELS = ['SCHOOL', 'DISTRICT', 'PROVINCE', 'NATIONAL', 'INTERNATIONAL'] as const

export default function EkskulPage() {
  const { data: me } = useMe()
  const [tab, setTab] = useState<'ekskul' | 'prestasi'>('ekskul')
  const { data: ekskul, isLoading, isError } = useEkskul()
  const { data: achievements } = useAchievements()
  const { create, loading: creating, error: createError, ok: createOk } = useCreateEkskul()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', kind: 'CLUB', schedule: '' })
  const [memberFor, setMemberFor] = useState<string | null>(null)
  const [studentQ, setStudentQ] = useState('')
  const { data: students } = useStudents(memberFor ? studentQ || undefined : undefined, 1)
  const [memberId, setMemberId] = useState('')
  const { add: addMember, loading: addingM, error: memberError } = useAddMember(memberFor ?? '')
  const [showAch, setShowAch] = useState(false)
  const [achForm, setAchForm] = useState({ studentId: '', title: '', type: 'OLAHRAGA', level: 'SCHOOL', year: String(new Date().getFullYear()) })
  const [achQ, setAchQ] = useState('')
  const { data: achStudents } = useStudents(showAch ? achQ || undefined : undefined, 1)
  const { add: addAch, loading: addingA, error: achError, ok: achOk } = useAddAchievement()

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (await create({ name: form.name, kind: form.kind, schedule: form.schedule || undefined })) {
      setShowForm(false)
      setForm({ name: '', kind: 'CLUB', schedule: '' })
    }
  }

  async function onAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (await addMember({ studentId: memberId })) {
      setMemberFor(null)
      setMemberId('')
    }
  }

  async function onAddAch(e: React.FormEvent) {
    e.preventDefault()
    if (await addAch({ studentId: achForm.studentId, title: achForm.title, type: achForm.type, level: achForm.level, year: Number(achForm.year) })) {
      setShowAch(false)
      setAchForm({ studentId: '', title: '', type: 'OLAHRAGA', level: 'SCHOOL', year: String(new Date().getFullYear()) })
    }
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">Ekstrakurikuler & Prestasi</h1>
      <div className="mt-4 flex gap-2" role="tablist" aria-label="Tab ekskul">
        {(['ekskul', 'prestasi'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {t === 'ekskul' ? 'Ekskul & OSIS' : 'Prestasi'}
          </button>
        ))}
      </div>

      {tab === 'ekskul' && (
        <>
          <div className="mt-4">
            <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {showForm ? 'Tutup' : 'Tambah Ekskul'}
            </button>
          </div>
          {showForm && (
            <form onSubmit={onCreate} className="mt-3 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-3">
              <input required minLength={2} placeholder="Nama ekskul" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nama ekskul" />
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Jenis">
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <input placeholder="Jadwal (mis. Jumat 14:00)" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Jadwal" />
              {createError && <p role="alert" className="text-sm text-red-600 sm:col-span-3">{createError}</p>}
              {createOk && <p className="text-sm text-green-700 sm:col-span-3">{createOk}</p>}
              <button type="submit" disabled={creating} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-3 sm:w-40">
                {creating ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          )}
          {isLoading ? (
            <div className="mt-6"><Spinner /></div>
          ) : isError ? (
            <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat data.</p>
          ) : (ekskul?.items.length ?? 0) === 0 ? (
            <div className="mt-6"><EmptyState title="Belum ada ekskul" /></div>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ekskul?.items.map((x) => (
                <li key={x.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <p className="font-semibold">{x.name}</p>
                  <p className="text-sm text-slate-500">{x.kind}{x.schedule ? ` · ${x.schedule}` : ''}</p>
                  <p className="mt-1 text-xs text-slate-400">{x._count.members} anggota</p>
                  <button onClick={() => { setMemberFor(x.id); setMemberId('') }} className="mt-2 text-xs font-medium text-brand-600 hover:underline">
                    Tambah Anggota
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'prestasi' && (
        <>
          <div className="mt-4">
            <button onClick={() => setShowAch((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {showAch ? 'Tutup' : 'Catat Prestasi'}
            </button>
          </div>
          {showAch && (
            <form onSubmit={onAddAch} className="mt-3 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
              <input placeholder="Cari siswa..." value={achQ} onChange={(e) => setAchQ(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Cari siswa" />
              <select required value={achForm.studentId} onChange={(e) => setAchForm({ ...achForm, studentId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Siswa">
                <option value="">Pilih siswa</option>
                {achStudents?.items.map((s) => <option key={s.id} value={s.id}>{s.fullName} ({s.nis})</option>)}
              </select>
              <input required minLength={2} placeholder="Judul prestasi" value={achForm.title} onChange={(e) => setAchForm({ ...achForm, title: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" aria-label="Judul prestasi" />
              <select value={achForm.type} onChange={(e) => setAchForm({ ...achForm, type: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Jenis">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={achForm.level} onChange={(e) => setAchForm({ ...achForm, level: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Tingkat">
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <input type="number" min={2000} max={2100} value={achForm.year} onChange={(e) => setAchForm({ ...achForm, year: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Tahun" />
              <div />
              {achError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{achError}</p>}
              {achOk && <p className="text-sm text-green-700 sm:col-span-2">{achOk}</p>}
              <button type="submit" disabled={addingA} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:w-40">
                {addingA ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          )}
          <ul className="mt-4 space-y-2">
            {(achievements?.items ?? []).map((a) => (
              <li key={a.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-slate-500">{a.student.fullName} · {a.type} · {a.level}{a.rank ? ` · Juara ${a.rank}` : ''} · {a.year}</p>
              </li>
            ))}
          </ul>
          {(achievements?.items.length ?? 0) === 0 && (
            <div className="mt-3"><EmptyState title="Belum ada prestasi tercatat" /></div>
          )}
        </>
      )}

      <Modal open={memberFor !== null} onClose={() => setMemberFor(null)} title="Tambah Anggota">
        <form onSubmit={onAddMember} className="space-y-3">
          <input placeholder="Cari siswa..." value={studentQ} onChange={(e) => setStudentQ(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Cari siswa" />
          <select required value={memberId} onChange={(e) => setMemberId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Pilih siswa">
            <option value="">Pilih siswa</option>
            {students?.items.map((s) => <option key={s.id} value={s.id}>{s.fullName} ({s.nis})</option>)}
          </select>
          {memberError && <p role="alert" className="text-sm text-red-600">{memberError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMemberFor(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
            <button type="submit" disabled={addingM} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {addingM ? '...' : 'Tambah'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
