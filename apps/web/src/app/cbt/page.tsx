'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Spinner, useConfirm } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useSubjects } from '@/lib/grade-hooks'
import { useClasses } from '@/lib/timetable-hooks'
import {
  useQuestions, useExams, useCreateQuestion, useCreateExam, useStartExam,
} from '@/lib/cbt-hooks'

const TYPES = ['MC', 'MR', 'TF', 'MATCH', 'SHORT', 'ESSAY'] as const
const STATUS_COLOR: Record<string, 'slate' | 'blue' | 'green' | 'yellow'> = {
  DRAFT: 'slate', SCHEDULED: 'blue', ACTIVE: 'green', ENDED: 'yellow',
}

export default function CbtPage() {
  const { data: me } = useMe()
  const { data: subjects } = useSubjects()
  const { data: classes } = useClasses()
  const [subjectId, setSubjectId] = useState('')
  const { data: questions } = useQuestions(subjectId || undefined)
  const { data: exams, isLoading, isError } = useExams()
  const { create: createQ, loading: creatingQ, error: qError, ok: qOk } = useCreateQuestion()
  const { create: createE, loading: creatingE, error: eError, ok: eOk } = useCreateExam()
  const { start, loading: starting } = useStartExam()
  const { confirm, dialog } = useConfirm()

  const [qForm, setQForm] = useState({ type: 'MC', text: '', options: '', answer: '' })
  const [eForm, setEForm] = useState({ classId: '', subjectId: '', title: '', durationMin: '60' })
  const [picked, setPicked] = useState<string[]>([])
  const [tab, setTab] = useState<'exams' | 'bank'>('exams')

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onCreateQuestion(e: React.FormEvent) {
    e.preventDefault()
    if (!subjectId) return
    const options =
      qForm.type === 'MC' || qForm.type === 'MR'
        ? qForm.options.split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => {
            const key = String.fromCharCode(65 + i)
            const text = l.replace(/^[A-D][.)]\s*/, '')
            return { key, text }
          })
        : undefined
    await createQ({
      subjectId,
      type: qForm.type,
      text: qForm.text,
      options,
      answer: qForm.answer || undefined,
    })
  }

  async function onCreateExam(e: React.FormEvent) {
    e.preventDefault()
    if (picked.length === 0) return
    const ok = await createE({
      classId: eForm.classId,
      subjectId: eForm.subjectId,
      title: eForm.title,
      durationMin: Number(eForm.durationMin) || 60,
      questionIds: picked,
    })
    if (ok) setPicked([])
  }

  async function onStart(id: string, title: string) {
    if (!(await confirm(`Aktifkan ujian "${title}"? Siswa bisa mulai mengerjakan.`))) return
    await start(id)
  }

  function togglePick(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  return (
    <AppShell>
      {dialog}
      <h1 className="text-xl font-semibold">Ujian CBT</h1>

      <div className="mt-4 flex gap-2" role="tablist" aria-label="Tab CBT">
        {(['exams', 'bank'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            {t === 'exams' ? 'Ujian' : 'Bank Soal'}
          </button>
        ))}
      </div>

      {tab === 'exams' && (
        <>
          <form onSubmit={onCreateExam} className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
            <input required minLength={2} placeholder="Judul ujian" value={eForm.title} onChange={(e) => setEForm({ ...eForm, title: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Judul ujian" />
            <input type="number" min={5} max={300} placeholder="Durasi (menit)" value={eForm.durationMin} onChange={(e) => setEForm({ ...eForm, durationMin: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Durasi" />
            <select required value={eForm.classId} onChange={(e) => setEForm({ ...eForm, classId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Kelas">
              <option value="">Pilih kelas</option>
              {classes?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select required value={eForm.subjectId} onChange={(e) => setEForm({ ...eForm, subjectId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Mapel">
              <option value="">Pilih mapel</option>
              {subjects?.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {eError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{eError}</p>}
            {eOk && <p className="text-sm text-green-700 sm:col-span-2">{eOk}</p>}
            <button type="submit" disabled={creatingE || picked.length === 0} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:w-64">
              {creatingE ? 'Membuat...' : `Buat Ujian (${picked.length} soal dipilih)`}
            </button>
          </form>

          {isLoading ? (
            <div className="mt-6"><Spinner /></div>
          ) : isError ? (
            <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat ujian.</p>
          ) : (exams?.items.length ?? 0) === 0 ? (
            <div className="mt-6"><EmptyState title="Belum ada ujian" /></div>
          ) : (
            <ul className="mt-4 space-y-2">
              {exams?.items.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div>
                    <p className="font-semibold">{x.title}</p>
                    <p className="text-sm text-slate-500">{x.subject.name} · {x.class.name} · {x.durationMin} mnt · {x._count.sessions} sesi</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={STATUS_COLOR[x.status] ?? 'slate'}>{x.status}</Badge>
                    {(x.status === 'DRAFT' || x.status === 'SCHEDULED') && (
                      <button onClick={() => onStart(x.id, x.title)} disabled={starting} className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                        Aktifkan
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'bank' && (
        <>
          <div className="mt-4">
            <label htmlFor="bank-subject" className="block text-sm font-medium text-slate-700">Mapel bank soal</label>
            <select id="bank-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Pilih mapel</option>
              {subjects?.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {subjectId && (
            <form onSubmit={onCreateQuestion} className="mt-3 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={qForm.type} onChange={(e) => setQForm({ ...qForm, type: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Tipe soal">
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input placeholder="Kunci jawaban (mis. B)" value={qForm.answer} onChange={(e) => setQForm({ ...qForm, answer: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Kunci jawaban" />
              </div>
              <textarea required minLength={2} rows={2} placeholder="Teks soal" value={qForm.text} onChange={(e) => setQForm({ ...qForm, text: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Teks soal" />
              {(qForm.type === 'MC' || qForm.type === 'MR') && (
                <textarea rows={3} placeholder={'Opsi, satu per baris:\nJakarta\nBandung\nSurabaya'} value={qForm.options} onChange={(e) => setQForm({ ...qForm, options: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" aria-label="Opsi jawaban" />
              )}
              {qError && <p role="alert" className="text-sm text-red-600">{qError}</p>}
              {qOk && <p className="text-sm text-green-700">{qOk}</p>}
              <button type="submit" disabled={creatingQ} className="w-40 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {creatingQ ? 'Menyimpan...' : 'Tambah Soal'}
              </button>
            </form>
          )}

          <ul className="mt-4 space-y-2">
            {(questions?.items ?? []).map((q) => (
              <li key={q.id} className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                <input
                  type="checkbox"
                  checked={picked.includes(q.id)}
                  onChange={() => togglePick(q.id)}
                  className="mt-1"
                  aria-label={`Pilih soal ${q.text.slice(0, 30)}`}
                />
                <div className="text-sm">
                  <p>{q.text}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{q.type} · {q.points} poin · {q.difficulty}</p>
                </div>
              </li>
            ))}
          </ul>
          {subjectId && (questions?.items.length ?? 0) === 0 && (
            <div className="mt-3"><EmptyState title="Bank soal kosong untuk mapel ini" /></div>
          )}
        </>
      )}
    </AppShell>
  )
}
