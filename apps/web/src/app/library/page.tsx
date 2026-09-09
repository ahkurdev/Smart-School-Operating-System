'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Modal, Spinner, useConfirm } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useStudents } from '@/lib/student-hooks'
import {
  useBooks, useCreateBook, useCopies, useLoans, useBorrow, useReturnLoan,
} from '@/lib/library-hooks'

const LOAN_COLOR: Record<string, 'blue' | 'green' | 'red' | 'slate'> = {
  BORROWED: 'blue', RETURNED: 'green', OVERDUE: 'red', LOST: 'slate',
}
const LOAN_LABEL: Record<string, string> = {
  BORROWED: 'Dipinjam', RETURNED: 'Kembali', OVERDUE: 'Terlambat', LOST: 'Hilang',
}

export default function LibraryPage() {
  const { data: me } = useMe()
  const [tab, setTab] = useState<'catalog' | 'loans'>('catalog')
  const [q, setQ] = useState('')
  const { data, isLoading, isError } = useBooks(tab === 'catalog' ? q || undefined : undefined)
  const { create, loading, error } = useCreateBook()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', author: '', copies: '1' })
  const [ok, setOk] = useState(false)

  // loans tab state
  const [loanFilter, setLoanFilter] = useState<string>('')
  const { data: loans } = useLoans(tab === 'loans' ? loanFilter || undefined : undefined)
  const { borrow, loading: borrowing, error: borrowError } = useBorrow()
  const { returnLoan, loading: returning, error: returnError, result: returnResult } = useReturnLoan()
  const { confirm, dialog } = useConfirm()
  const [borrowFor, setBorrowFor] = useState<string | null>(null)
  const { data: copies } = useCopies(borrowFor)
  const [studentQ, setStudentQ] = useState('')
  const { data: students } = useStudents(tab === 'loans' && borrowFor ? studentQ || undefined : undefined, 1)
  const [borrowForm, setBorrowForm] = useState({ studentId: '', copyId: '' })

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

  async function onBorrow(e: React.FormEvent) {
    e.preventDefault()
    if (await borrow({ studentId: borrowForm.studentId, copyId: borrowForm.copyId })) {
      setBorrowFor(null)
      setBorrowForm({ studentId: '', copyId: '' })
    }
  }

  async function onReturn(id: string, label: string) {
    if (!(await confirm(`Tandai "${label}" sudah kembali?`))) return
    await returnLoan(id)
  }

  return (
    <AppShell>
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Perpustakaan</h1>
        {tab === 'catalog' && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {showForm ? 'Tutup' : 'Tambah Buku'}
          </button>
        )}
      </div>

      <div className="mt-4 flex gap-2" role="tablist" aria-label="Tab perpustakaan">
        {(['catalog', 'loans'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            {t === 'catalog' ? 'Katalog' : 'Peminjaman'}
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <>
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
                  <button onClick={() => { setBorrowFor(b.id); setBorrowForm({ studentId: '', copyId: '' }) }} className="mt-2 text-xs font-medium text-brand-600 hover:underline">
                    Pinjamkan
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'loans' && (
        <>
          <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter pinjaman">
            {['', 'BORROWED', 'OVERDUE', 'RETURNED', 'LOST'].map((s) => (
              <button
                key={s || 'ALL'}
                role="tab"
                aria-selected={loanFilter === s}
                onClick={() => setLoanFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${loanFilter === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
              >
                {s === '' ? 'Semua' : (LOAN_LABEL[s] ?? s)}
              </button>
            ))}
          </div>
          {returnError && <p role="alert" className="mt-2 text-sm text-red-600">{returnError}</p>}
          {returnResult && (
            <p className="mt-2 text-sm text-green-700">
              Dikembalikan{returnResult.overdueDays > 0 ? ` · terlambat ${returnResult.overdueDays} hari · denda Rp${returnResult.fine.toLocaleString('id-ID')}` : ' · tepat waktu'}.
            </p>
          )}
          {(loans?.items.length ?? 0) === 0 ? (
            <div className="mt-4"><EmptyState title="Tidak ada pinjaman" /></div>
          ) : (
            <ul className="mt-4 space-y-2">
              {loans?.items.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="text-sm">
                    <p className="font-medium">{l.copy.book.title}</p>
                    <p className="text-slate-500">{l.student.fullName} ({l.student.nis}) · {l.copy.barcode}</p>
                    <p className="text-xs text-slate-400">Jatuh tempo {new Date(l.dueAt).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={LOAN_COLOR[l.status] ?? 'slate'}>{LOAN_LABEL[l.status] ?? l.status}</Badge>
                    {l.status === 'BORROWED' && (
                      <button onClick={() => onReturn(l.id, l.copy.book.title)} disabled={returning} className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50">
                        Kembalikan
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Modal open={borrowFor !== null} onClose={() => setBorrowFor(null)} title="Pinjamkan Buku">
        <form onSubmit={onBorrow} className="space-y-3">
          <div>
            <label htmlFor="borrow-student" className="block text-sm font-medium text-slate-700">Siswa</label>
            <input
              id="borrow-student"
              placeholder="Cari nama / NIS..."
              value={studentQ}
              onChange={(e) => setStudentQ(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select required value={borrowForm.studentId} onChange={(e) => setBorrowForm({ ...borrowForm, studentId: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Pilih siswa">
              <option value="">Pilih siswa</option>
              {students?.items.map((s) => <option key={s.id} value={s.id}>{s.fullName} ({s.nis})</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="borrow-copy" className="block text-sm font-medium text-slate-700">Eksemplar tersedia</label>
            <select id="borrow-copy" required value={borrowForm.copyId} onChange={(e) => setBorrowForm({ ...borrowForm, copyId: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Pilih eksemplar</option>
              {(copies?.items ?? []).filter((c) => c.isAvailable).map((c) => (
                <option key={c.id} value={c.id}>{c.barcode}</option>
              ))}
            </select>
          </div>
          {borrowError && <p role="alert" className="text-sm text-red-600">{borrowError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setBorrowFor(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
            <button type="submit" disabled={borrowing} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {borrowing ? 'Memproses...' : 'Pinjamkan'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
