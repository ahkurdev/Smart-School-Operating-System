'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { EmptyState, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useBooks, useCreateBook } from '@/lib/library-hooks'

export default function LibraryPage() {
  const { data: me } = useMe()
  const [q, setQ] = useState('')
  const { data, isLoading, isError } = useBooks(q || undefined)
  const { create, loading, error } = useCreateBook()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', author: '', copies: '1' })
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
    const done = await create({ title: form.title, author: form.author || undefined, copies: Number(form.copies) || 1 })
    if (done) {
      setShowForm(false)
      setForm({ title: '', author: '', copies: '1' })
      setOk(true)
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Perpustakaan</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {showForm ? 'Tutup' : 'Tambah Buku'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-4">
          <input required minLength={2} placeholder="Judul" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Judul buku" />
          <input placeholder="Pengarang" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Pengarang" />
          <input type="number" min={1} max={500} placeholder="Jumlah eksemplar" value={form.copies} onChange={(e) => setForm({ ...form, copies: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Jumlah eksemplar" />
          <button type="submit" disabled={loading} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
          {error && <p role="alert" className="text-sm text-red-600 sm:col-span-4">{error}</p>}
          {ok && <p className="text-sm text-green-700 sm:col-span-4">Buku ditambahkan.</p>}
        </form>
      )}

      <input
        type="search"
        placeholder="Cari judul / pengarang / ISBN..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mt-4 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
        aria-label="Cari buku"
      />

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat katalog.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Katalog kosong" hint="Tambahkan buku pertama." /></div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((b) => (
            <li key={b.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="font-semibold">{b.title}</p>
              <p className="text-sm text-slate-500">{b.author ?? '-'}</p>
              <p className="mt-1 text-xs text-slate-400">{b.isbn ?? 'tanpa ISBN'}{b.category ? ` - ${b.category}` : ''}</p>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
