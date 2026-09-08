'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { EmptyState, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useAnnouncements, useCreateAnnouncement } from '@/lib/announcement-hooks'

const AUDIENCE_LABEL: Record<string, string> = {
  ALL: 'Semua', STUDENTS: 'Siswa', PARENTS: 'Orang Tua', TEACHERS: 'Guru',
}

export default function AnnouncementsPage() {
  const { data: me } = useMe()
  const { data, isLoading, isError } = useAnnouncements()
  const { create, loading, error } = useCreateAnnouncement()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', audience: 'ALL' })
  const [ok, setOk] = useState(false)

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setOk(false)
    const done = await create(form)
    if (done) {
      setShowForm(false)
      setForm({ title: '', body: '', audience: 'ALL' })
      setOk(true)
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pengumuman</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {showForm ? 'Tutup' : 'Buat'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <input
            required
            minLength={2}
            placeholder="Judul"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            aria-label="Judul pengumuman"
          />
          <textarea
            required
            minLength={2}
            rows={4}
            placeholder="Isi pengumuman"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            aria-label="Isi pengumuman"
          />
          <select
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            aria-label="Penerima"
          >
            {Object.entries(AUDIENCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {ok && <p className="text-sm text-green-700">Pengumuman terbit.</p>}
          <button type="submit" disabled={loading} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? 'Menerbitkan...' : 'Terbitkan'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat pengumuman.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Belum ada pengumuman" /></div>
      ) : (
        <ul className="mt-4 space-y-3">
          {data?.items.map((a) => (
            <li key={a.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{a.title}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{AUDIENCE_LABEL[a.audience] ?? a.audience}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>
              <p className="mt-2 text-xs text-slate-400">{a.publishedAt ? new Date(a.publishedAt).toLocaleString('id-ID') : 'Draft'}</p>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
