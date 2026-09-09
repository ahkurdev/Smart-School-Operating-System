'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, Spinner } from '@/components/ui'
import { useSearch } from '@/lib/search-hooks'

export function SearchPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const { data, isLoading } = useSearch(open ? q : '')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQ('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open ])

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  const empty =
    data && data.students.length === 0 && data.employees.length === 0 && data.books.length === 0

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200 md:flex"
        aria-label="Buka pencarian (Ctrl K)"
      >
        Cari siswa, guru, buku...
        <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Pencarian">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ketik minimal 2 huruf..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          aria-label="Kata kunci pencarian"
        />
        <div className="mt-3 max-h-80 overflow-y-auto">
          {isLoading && q.trim().length >= 2 ? (
            <div className="py-4"><Spinner /></div>
          ) : q.trim().length < 2 ? (
            <p className="py-4 text-center text-xs text-slate-400">Siswa, guru, buku — hasil mengikuti hak akses Anda.</p>
          ) : empty ? (
            <p className="py-4 text-center text-sm text-slate-500">Tidak ditemukan untuk “{q}”.</p>
          ) : (
            <>
              {(data?.students.length ?? 0) > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold uppercase text-slate-400">Siswa</p>
                  <ul>
                    {data?.students.map((s) => (
                      <li key={s.id}>
                        <button onClick={() => go(`/students?q=${encodeURIComponent(s.nis)}`)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50">
                          <span className="font-medium">{s.fullName}</span>
                          <span className="font-mono text-xs text-slate-400">{s.nis}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(data?.employees.length ?? 0) > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold uppercase text-slate-400">Guru & Staf</p>
                  <ul>
                    {data?.employees.map((e) => (
                      <li key={e.id} className="rounded-lg px-2 py-2 text-sm">
                        <span className="font-medium">{e.fullName}</span>
                        <span className="ml-2 text-xs text-slate-400">{e.kind}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(data?.books.length ?? 0) > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold uppercase text-slate-400">Buku</p>
                  <ul>
                    {data?.books.map((b) => (
                      <li key={b.id}>
                        <button onClick={() => go(`/library?q=${encodeURIComponent(b.title)}`)} className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50">
                          <span className="font-medium">{b.title}</span>
                          {b.author && <span className="ml-2 text-xs text-slate-400">{b.author}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
