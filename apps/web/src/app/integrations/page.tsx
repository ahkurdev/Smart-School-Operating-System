'use client'

import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { api } from '@/lib/api'

interface StatusItem {
  provider: string
  configured: boolean
  envVar: string
}

export default function IntegrationsPage() {
  const { data: me } = useMe()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api<{ items: StatusItem[] }>('/api/integrations/status'),
    enabled: !!me,
  })

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">Integrasi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Status konektor eksternal. Kunci API diisi via environment server, tidak pernah tampil di sini.
      </p>
      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat status. Butuh hak school.manage.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Tidak ada konektor" /></div>
      ) : (
        <ul className="mt-4 space-y-2">
          {data?.items.map((s) => (
            <li key={s.provider} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm">
                <p className="font-medium">{s.provider}</p>
                <p className="font-mono text-xs text-slate-400">{s.envVar}</p>
              </div>
              <Badge color={s.configured ? 'green' : 'slate'}>
                {s.configured ? 'Terhubung' : 'Belum dikonfigurasi'}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
