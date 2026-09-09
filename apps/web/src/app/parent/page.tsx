'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import {
  useMyChildren,
  useChildAttendance,
  useChildInvoices,
  useChildGrades,
  useChildReportCards,
} from '@/lib/parent-hooks'

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Hadir',
  SICK: 'Sakit',
  EXCUSED: 'Izin',
  ABSENT: 'Alfa',
  LATE: 'Terlambat',
  EARLY_LEAVE: 'Pulang Awal',
}
const STATUS_COLOR: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'orange' | 'slate'> = {
  PRESENT: 'green',
  SICK: 'blue',
  EXCUSED: 'yellow',
  ABSENT: 'red',
  LATE: 'orange',
  EARLY_LEAVE: 'slate',
}

function fmtIDR(n: number | string): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n))
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ParentPage() {
  const { data: me } = useMe()
  const { data: childrenData, isLoading: childrenLoading, isError } = useMyChildren()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const children = childrenData?.items ?? []
  const selected = children.find((c) => c.id === selectedId) ?? children[0] ?? null
  const sid = selected?.id

  const to = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const { data: attendance } = useChildAttendance(sid, from, to)
  const { data: invoices } = useChildInvoices(sid)
  const { data: grades } = useChildGrades(sid)
  const { data: rapors } = useChildReportCards(sid)

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">Portal Orang Tua</h1>
      <p className="mt-1 text-sm text-slate-500">Pantau kehadiran, nilai, rapor, dan tagihan anak Anda.</p>

      {childrenLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat data anak.</p>
      ) : children.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Belum ada anak tertaut" hint="Hubungi tata usaha sekolah untuk menautkan akun Anda dengan data anak." />
        </div>
      ) : (
        <>
          {children.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Pilih anak">
              {children.map((c) => (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={selected?.id === c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                    selected?.id === c.id ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {c.fullName}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="mt-4 space-y-6">
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="font-semibold">{selected.fullName}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  NIS {selected.nis} · {selected.gender === 'MALE' ? 'Laki-laki' : 'Perempuan'} · {selected.status}
                  {selected.relation ? ` · ${selected.relation}` : ''}
                </p>
              </div>

              <section aria-label="Kehadiran 30 hari terakhir">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Kehadiran (30 hari)</h2>
                {!attendance || Object.keys(attendance.summary).length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Belum ada data kehadiran.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(attendance.summary).map(([st, n]) => (
                      <Badge key={st} color={STATUS_COLOR[st] ?? 'slate'}>
                        {STATUS_LABEL[st] ?? st}: {n}
                      </Badge>
                    ))}
                  </div>
                )}
              </section>

              <section aria-label="Nilai terbit">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Nilai Akhir per Mapel</h2>
                {!grades || grades.finals.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Belum ada nilai yang diterbitkan.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                    {grades.finals.map((g) => (
                      <li key={g.subject} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span>{g.subject}</span>
                        <span className="font-mono font-semibold">{g.final}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-label="Rapor">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Rapor</h2>
                {!rapors || rapors.items.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Belum ada rapor yang diterbitkan.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {rapors.items.map((r) => (
                      <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                        <p className="text-sm font-medium">
                          Rapor {r.publishedAt ? fmtDate(r.publishedAt) : 'Draft'}
                        </p>
                        <p className="mt-1 font-mono text-xs text-slate-500">Kode verifikasi: {r.verifyCode}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-label="Tagihan">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Tagihan</h2>
                {!invoices || invoices.items.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Tidak ada tagihan.</p>
                ) : (
                  <>
                    {invoices.totalDue > 0 && (
                      <p className="mt-2 text-sm font-semibold text-amber-700">
                        Total tunggakan: {fmtIDR(invoices.totalDue)}
                      </p>
                    )}
                    <ul className="mt-2 divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                      {invoices.items.map((inv) => (
                        <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                          <div>
                            <p className="font-medium">{inv.feeItem.name}{inv.period ? ` · ${inv.period}` : ''}</p>
                            <p className="font-mono text-xs text-slate-500">{inv.number}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-semibold">{fmtIDR(inv.due)}</p>
                            <Badge color={inv.status === 'PAID' ? 'green' : inv.status === 'PARTIALLY_PAID' ? 'yellow' : 'red'}>
                              {inv.status === 'PAID' ? 'Lunas' : inv.status === 'PARTIALLY_PAID' ? `Dibayar ${fmtIDR(inv.paid)}` : 'Belum bayar'}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
