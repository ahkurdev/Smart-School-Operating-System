'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useNotifications, useMarkRead } from '@/lib/notice-hooks'

const KIND_COLOR: Record<string, 'blue' | 'yellow' | 'red' | 'green'> = {
  INFO: 'blue', WARNING: 'yellow', ALERT: 'red', SUCCESS: 'green',
}

export default function NotificationsPage() {
  const { data: me } = useMe()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const { data, isLoading, isError } = useNotifications(unreadOnly)
  const { mark, loading } = useMarkRead()

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          Notifikasi{data && data.unreadCount > 0 ? ` (${data.unreadCount} belum dibaca)` : ''}
        </h1>
        <button onClick={() => setUnreadOnly((v) => !v)} className={`rounded-full px-3 py-1 text-xs font-medium ${unreadOnly ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
          {unreadOnly ? 'Tampilkan semua' : 'Belum dibaca saja'}
        </button>
      </div>

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat notifikasi.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Tidak ada notifikasi" /></div>
      ) : (
        <ul className="mt-4 space-y-2">
          {data?.items.map((n) => (
            <li key={n.id} className={`rounded-xl bg-white p-4 shadow-sm ring-1 ${n.readAt ? 'ring-slate-200' : 'ring-brand-300'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge color={KIND_COLOR[n.kind] ?? 'blue'}>{n.kind}</Badge>
                  <p className="font-medium">{n.title}</p>
                </div>
                {!n.readAt && (
                  <button onClick={() => mark(n.id)} disabled={loading} className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50">
                    Tandai dibaca
                  </button>
                )}
              </div>
              {n.body && <p className="mt-1 text-sm text-slate-600">{n.body}</p>}
              <p className="mt-1 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString('id-ID')}</p>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
