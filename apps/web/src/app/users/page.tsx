'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Modal, Spinner, useConfirm } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useUsers, useCreateUser, useResetPassword } from '@/lib/user-hooks'
import { ROLES } from '@/lib/roles'

export default function UsersPage() {
  const { data: me } = useMe()
  const [q, setQ] = useState('')
  const { data, isLoading, isError } = useUsers(q || undefined)
  const { create, loading: creating, error: createError, ok: createOk } = useCreateUser()
  const { reset, loading: resetting, error: resetError } = useResetPassword()
  const { confirm, dialog } = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', username: '', tempPassword: '', role: 'GURU' })
  const [resetFor, setResetFor] = useState<{ id: string; name: string } | null>(null)
  const [newPass, setNewPass] = useState('')
  const [resetOk, setResetOk] = useState(false)

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (await create({
      fullName: form.fullName,
      email: form.email || undefined,
      username: form.username || undefined,
      tempPassword: form.tempPassword,
      role: form.role,
    })) {
      setShowForm(false)
      setForm({ fullName: '', email: '', username: '', tempPassword: '', role: 'GURU' })
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault()
    if (!resetFor) return
    if (!(await confirm(`Reset password ${resetFor.name}? Semua sesi aktif akan dicabut.`))) return
    if (await reset(resetFor.id, newPass)) {
      setResetFor(null)
      setNewPass('')
      setResetOk(true)
    }
  }

  return (
    <AppShell>
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Pengguna</h1>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          {showForm ? 'Tutup' : 'Buat Akun'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
          <input required minLength={2} placeholder="Nama lengkap" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nama lengkap" />
          <input type="email" placeholder="Email (opsional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Email" />
          <input minLength={3} placeholder="Username (opsional)" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Username" />
          <input required minLength={8} type="password" placeholder="Password sementara (min 8)" value={form.tempPassword} onChange={(e) => setForm({ ...form, tempPassword: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Password sementara" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm sm:col-span-2" aria-label="Peran">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {createError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{createError}</p>}
          {createOk && <p className="text-sm text-green-700 sm:col-span-2">{createOk}</p>}
          <button type="submit" disabled={creating} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:w-40">
            {creating ? '...' : 'Buat Akun'}
          </button>
        </form>
      )}
      {resetOk && <p className="mt-2 text-sm text-green-700">Password direset, sesi lama dicabut.</p>}

      <input type="search" placeholder="Cari nama / email / username..." value={q} onChange={(e) => setQ(e.target.value)} className="mt-4 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Cari pengguna" />

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat pengguna.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Tidak ada pengguna" /></div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Nama</th>
                <th className="px-4 py-2.5">Login</th>
                <th className="px-4 py-2.5">Peran</th>
                <th className="px-4 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5 font-medium">{u.fullName}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{u.email ?? u.username ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {u.memberships.map((m, i) => (
                        <Badge key={i} color="blue">{m.role}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => { setResetFor({ id: u.id, name: u.fullName }); setNewPass(''); setResetOk(false) }} className="text-xs font-medium text-brand-600 hover:underline">
                      Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {resetError && <p role="alert" className="mt-2 text-sm text-red-600">{resetError}</p>}

      <Modal open={resetFor !== null} onClose={() => setResetFor(null)} title={`Reset — ${resetFor?.name ?? ''}`}>
        <form onSubmit={onReset} className="space-y-3">
          <p className="text-sm text-slate-600">Password baru langsung berlaku; semua sesi user ini dicabut.</p>
          <input required minLength={8} type="password" placeholder="Password baru (min 8)" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Password baru" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setResetFor(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
            <button type="submit" disabled={resetting} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {resetting ? '...' : 'Reset'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
