'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useAuditLog } from '@/lib/notice-hooks'

const ACTION_COLOR: Record<string, 'green' | 'blue' | 'red' | 'yellow' | 'slate'> = {
  CREATE: 'green', UPDATE: 'blue', DELETE: 'red', APPROVE: 'green', REJECT: 'red', READ_SENSITIVE: 'yellow',
}

export default function AuditPage() {
  const { data: me } = useMe()
  const [resource, setResource] = useState('')
  const [action, setAction] = useState('')
  const { data, isLoading, isError } = useAuditLog(resource || undefined, action || undefined)

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">Audit Log</h1>
      <p className="mt-1 text-sm text-slate-500">Jejak aktivitas pengguna — read-only, tidak bisa diubah.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input placeholder="Filter resource (mis. student)" value={resource} onChange={(e) => setResource(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs" aria-label="Filter resource" />
        <input placeholder="Filter aksi (mis. UPDATE)" value={action} onChange={(e) => setAction(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs" aria-label="Filter aksi" />
      </div>

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat audit log. Butuh hak audit.read.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Tidak ada jejak" /></div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Waktu</th>
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Aksi</th>
                <th className="px-4 py-2.5">Resource</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{new Date(a.createdAt).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2.5 text-xs">{a.user?.fullName ?? '(sistem)'}</td>
                  <td className="px-4 py-2.5"><Badge color={ACTION_COLOR[a.action] ?? 'slate'}>{a.action}</Badge></td>
                  <td className="px-4 py-2.5 font-mono text-xs">{a.resource}{a.resourceId ? ` · ${a.resourceId.slice(0, 8)}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  )
}
