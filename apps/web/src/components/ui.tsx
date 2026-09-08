import { useState } from 'react'

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

export function Badge({ color, children }: { color: 'green' | 'red' | 'yellow' | 'blue' | 'slate' | 'orange'; children: React.ReactNode }) {
  const map = {
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue: 'bg-blue-100 text-blue-800',
    slate: 'bg-slate-100 text-slate-600',
    orange: 'bg-orange-100 text-orange-800',
  }
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${map[color]}`}>{children}</span>
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function Spinner({ label = 'Memuat' }: { label?: string }) {
  return <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" role="status" aria-label={label} />
}

export function useConfirm() {
  const [msg, setMsg] = useState<string | null>(null)
  const [resolve, setResolve] = useState<((v: boolean) => void) | null>(null)
  function confirm(m: string): Promise<boolean> {
    setMsg(m)
    return new Promise((res) => setResolve(() => res))
  }
  const dialog = msg ? (
    <Modal open onClose={() => { resolve?.(false); setMsg(null) }} title="Konfirmasi">
      <p className="text-sm text-slate-700">{msg}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button className="rounded-lg border px-4 py-2 text-sm" onClick={() => { resolve?.(false); setMsg(null) }}>Batal</button>
        <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => { resolve?.(true); setMsg(null) }}>Ya, lanjut</button>
      </div>
    </Modal>
  ) : null
  return { confirm, dialog }
}
