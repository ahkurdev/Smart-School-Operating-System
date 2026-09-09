'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import {
  useSchools, useSiteContent, useSiteNews, useUpsertContent, useCreateNews,
} from '@/lib/site-hooks'

const SECTIONS = ['HOME', 'PROFILE', 'VISION', 'PROGRAMS', 'FACILITIES', 'NEWS', 'AGENDA', 'GALLERY', 'FAQ', 'CONTACT'] as const

export default function SitePage() {
  const { data: me } = useMe()
  const [tab, setTab] = useState<'content' | 'news'>('content')
  const { data: schools } = useSchools()
  const { data: contents, isLoading, isError } = useSiteContent()
  const { data: news } = useSiteNews()
  const { upsert, loading: upserting, error: upsertError, ok: upsertOk } = useUpsertContent()
  const { create, loading: creating, error: newsError, ok: newsOk } = useCreateNews()
  const [form, setForm] = useState({ section: 'NEWS', title: '', body: '', published: true })
  const [newsForm, setNewsForm] = useState({ title: '', body: '' })

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onUpsert(e: React.FormEvent) {
    e.preventDefault()
    if (await upsert({ section: form.section, title: form.title, body: form.body || undefined, published: form.published })) {
      setForm({ section: 'NEWS', title: '', body: '', published: true })
    }
  }

  async function onNews(e: React.FormEvent) {
    e.preventDefault()
    if (await create({ title: newsForm.title, body: newsForm.body, publish: true })) {
      setNewsForm({ title: '', body: '' })
    }
  }

  const schoolCode = schools?.items[0]?.code ?? ''

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">Website Sekolah</h1>
      <p className="mt-1 text-sm text-slate-500">
        Kelola konten publik{schoolCode ? <> · pratinjau: <span className="font-mono text-xs">/api/site/public/{schoolCode}/content</span></> : ''}.
      </p>

      <div className="mt-4 flex gap-2" role="tablist" aria-label="Tab website">
        {(['content', 'news'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {t === 'content' ? 'Konten Halaman' : 'Berita'}
          </button>
        ))}
      </div>

      {tab === 'content' && (
        <>
          <form onSubmit={onUpsert} className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Bagian">
                {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input required minLength={2} placeholder="Judul blok" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Judul blok" />
            </div>
            <textarea rows={3} placeholder="Isi konten" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Isi konten" />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
              Tampilkan di website publik
            </label>
            {upsertError && <p role="alert" className="text-sm text-red-600">{upsertError}</p>}
            {upsertOk && <p className="text-sm text-green-700">{upsertOk}</p>}
            <button type="submit" disabled={upserting} className="w-40 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {upserting ? '...' : 'Simpan'}
            </button>
          </form>

          {isLoading ? (
            <div className="mt-6"><Spinner /></div>
          ) : isError ? (
            <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat konten.</p>
          ) : (contents?.items.length ?? 0) === 0 ? (
            <div className="mt-6"><EmptyState title="Belum ada konten" /></div>
          ) : (
            <ul className="mt-4 space-y-2">
              {contents?.items.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="text-sm">
                    <p className="font-medium">{c.title}</p>
                    <p className="font-mono text-xs text-slate-400">{c.section}</p>
                  </div>
                  <Badge color={c.published ? 'green' : 'slate'}>{c.published ? 'Tayang' : 'Draft'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'news' && (
        <>
          <form onSubmit={onNews} className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <input required minLength={2} placeholder="Judul berita" value={newsForm.title} onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Judul berita" />
            <textarea required minLength={2} rows={3} placeholder="Isi berita" value={newsForm.body} onChange={(e) => setNewsForm({ ...newsForm, body: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Isi berita" />
            {newsError && <p role="alert" className="text-sm text-red-600">{newsError}</p>}
            {newsOk && <p className="text-sm text-green-700">{newsOk}</p>}
            <button type="submit" disabled={creating} className="w-40 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {creating ? '...' : 'Terbitkan'}
            </button>
          </form>
          <ul className="mt-4 space-y-2">
            {(news?.items ?? []).map((n) => (
              <li key={n.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{n.title}</p>
                  <Badge color={n.publishedAt ? 'green' : 'slate'}>{n.publishedAt ? new Date(n.publishedAt).toLocaleDateString('id-ID') : 'Draft'}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{n.body}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  )
}
