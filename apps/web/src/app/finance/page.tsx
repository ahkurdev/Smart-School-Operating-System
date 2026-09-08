'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useInvoices, useOutstanding, usePay, type FinanceInvoice } from '@/lib/finance-hooks'

function fmtIDR(n: number | string): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n))
}

const STATUS_BADGE: Record<string, 'green' | 'red' | 'yellow' | 'slate'> = {
  PAID: 'green',
  UNPAID: 'red',
  PARTIALLY_PAID: 'yellow',
  CANCELLED: 'slate',
}
const STATUS_LABEL: Record<string, string> = {
  PAID: 'Lunas', UNPAID: 'Belum Bayar', PARTIALLY_PAID: 'Sebagian', CANCELLED: 'Batal',
}

export default function FinancePage() {
  const { data: me } = useMe()
  const { data, isLoading, isError } = useInvoices()
  const { data: outstanding } = useOutstanding()
  const { pay, loading: paying, error: payError } = usePay()
  const [payFor, setPayFor] = useState<FinanceInvoice | null>(null)
  const [amount, setAmount] = useState('')

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function submitPay(e: React.FormEvent) {
    e.preventDefault()
    if (!payFor) return
    const ok = await pay(payFor.id, Number(amount))
    if (ok) {
      setPayFor(null)
      setAmount('')
    }
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">Keuangan</h1>

      {outstanding && outstanding.items.length > 0 && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-xs font-semibold uppercase text-amber-700">Total Tunggakan: {fmtIDR(outstanding.total)}</p>
          <ul className="mt-1 text-sm text-amber-800">
            {outstanding.items.slice(0, 5).map((o) => (
              <li key={o.invoiceId}>{o.student.fullName} - {o.fee}: {fmtIDR(o.due)}</li>
            ))}
          </ul>
        </div>
      )}

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat invoice.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Belum ada invoice" hint="Buat tagihan dari menu keuangan admin." /></div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">No.</th>
                <th className="px-4 py-2.5">Siswa</th>
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5">Jumlah</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((inv) => {
                const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
                const due = Number(inv.amount) - Number(inv.discount) - paid
                return (
                  <tr key={inv.id}>
                    <td className="px-4 py-2.5 font-mono text-xs">{inv.number}</td>
                    <td className="px-4 py-2.5">{inv.student.fullName}</td>
                    <td className="px-4 py-2.5">{inv.feeItem.name}{inv.period ? ` (${inv.period})` : ''}</td>
                    <td className="px-4 py-2.5">{fmtIDR(inv.amount)}</td>
                    <td className="px-4 py-2.5"><Badge color={STATUS_BADGE[inv.status] ?? 'slate'}>{STATUS_LABEL[inv.status] ?? inv.status}</Badge></td>
                    <td className="px-4 py-2.5 text-right">
                      {due > 0 && inv.status !== 'CANCELLED' && (
                        <button
                          onClick={() => { setPayFor(inv); setAmount(String(due)) }}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Bayar {fmtIDR(due)}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {payFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Pembayaran">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setPayFor(null)} aria-hidden="true" />
          <form onSubmit={submitPay} className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Pembayaran</h2>
            <p className="mt-1 text-sm text-slate-500">{payFor.number} - {payFor.student.fullName}</p>
            <label htmlFor="pay-amount" className="mt-4 block text-sm font-medium text-slate-700">Jumlah (Rp)</label>
            <input
              id="pay-amount"
              type="number"
              min={1}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {payError && <p role="alert" className="mt-2 text-sm text-red-600">{payError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPayFor(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
              <button type="submit" disabled={paying} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {paying ? 'Memproses...' : 'Bayar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  )
}
