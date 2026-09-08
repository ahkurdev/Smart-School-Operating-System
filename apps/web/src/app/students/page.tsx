'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { useMe, useLogout } from '@/lib/auth-hooks'
import { useStudents } from '@/lib/student-hooks'
import { useCreateStudent, useDeleteStudent } from '@/lib/student-mutations'

export default function StudentsPage() {
  const { data: me } = useMe()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading, isError } = useStudents(q || undefined, page)
  const { create, loading: creating, error: createError } = useCreateStudent()
  const { remove, loading: deleting } = useDeleteStudent()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nis: '', fullName: '', gender: 'MALE' as 'MALE' | 'FEMALE' })

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

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Data Siswa</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {showForm ? 'Tutup' : 'Tambah Siswa'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-4">
          <input
            required
            placeholder="NIS"
            value={form.nis}
            onChange={(e) => setForm({ ...form, nis: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            aria-label="NIS"
          />
          <input
            required
            minLength={2}
            placeholder="Nama lengkap"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            aria-label="Nama lengkap"
          />
          <select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value as 'MALE' | 'FEMALE' })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            aria-label="Jenis kelamin"
          >
            <option value="MALE">Laki-laki</option>
            <option value="FEMALE">Perempuan</option>
          </select>
          {createError && <p role="alert" className="text-sm text-red-600 sm:col-span-4">{createError}</p>}
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-4 sm:w-32"
          >
            {creating ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      )}

      <input
        type="search"
        placeholder="Cari nama / NIS / NISN..."
        value={q}
        onChange={(e) => { setQ(e.target.value); setPage(1) }}
        className="mt-4 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
        aria-label="Cari siswa"
      />

      {isLoading ? (
        <div className="mt-6 h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" aria-label="Memuat" />
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat data.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          Tidak ada siswa{q ? ` untuk "${q}"` : ''}.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">NIS</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">L/P</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-mono text-xs">{s.nis}</td>
                  <td className="px-4 py-3 font-medium">{s.fullName}</td>
                  <td className="px-4 py-3">{s.gender === 'MALE' ? 'L' : 'P'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { if (confirm(`Hapus ${s.fullName}?`)) remove(s.id) }}
                      disabled={deleting}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
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
        <div className="mt-4 flex items-center justify-between text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">
            Sebelumnya
          </button>
          <span className="text-slate-500">Halaman {data.page} · {data.total} siswa</span>
          <button disabled={page * data.take >= data.total} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">
            Berikutnya
          </button>
        </div>
      )}
    </AppShell>
  )
}
