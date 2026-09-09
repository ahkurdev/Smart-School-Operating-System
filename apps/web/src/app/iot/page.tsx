'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Spinner, useConfirm } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import {
  useDevices, useAlerts, useRules, useRegisterDevice, useResolveAlert, useCreateRule, useToggleRule,
} from '@/lib/iot-hooks'

const KINDS = ['SENSOR_TEMP', 'SENSOR_AIR', 'ENERGY', 'GPS', 'ACCESS', 'CCTV_HEALTH', 'OTHER'] as const
const STATUS_COLOR: Record<string, 'green' | 'slate' | 'yellow'> = { ONLINE: 'green', OFFLINE: 'slate', MAINTENANCE: 'yellow' }
const SEV_COLOR: Record<string, 'blue' | 'yellow' | 'red'> = { INFO: 'blue', WARNING: 'yellow', CRITICAL: 'red' }
const EVENTS = ['student.absent', 'device.offline', 'sensor.threshold', 'book.overdue', 'payment.overdue', 'assignment.deadline'] as const
const ACTIONS = ['notify_guardian', 'notify_role', 'notify_user', 'create_alert'] as const

export default function IotPage() {
  const { data: me } = useMe()
  const [tab, setTab] = useState<'devices' | 'alerts' | 'rules'>('devices')
  const { data: devices, isLoading, isError } = useDevices()
  const { data: alerts } = useAlerts()
  const { data: rules } = useRules()
  const { register, loading: registering, error: regError, ok: regOk } = useRegisterDevice()
  const { resolve, loading: resolving } = useResolveAlert()
  const { create, loading: creating, error: ruleError, ok: ruleOk } = useCreateRule()
  const { toggle } = useToggleRule()
  const { confirm, dialog } = useConfirm()
  const [showDev, setShowDev] = useState(false)
  const [devForm, setDevForm] = useState({ deviceId: '', name: '', kind: 'SENSOR_TEMP' })
  const [showRule, setShowRule] = useState(false)
  const [ruleForm, setRuleForm] = useState({ name: '', event: 'student.absent', action: 'create_alert' })

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault()
    if (await register({ deviceId: devForm.deviceId, name: devForm.name, kind: devForm.kind })) {
      setShowDev(false)
      setDevForm({ deviceId: '', name: '', kind: 'SENSOR_TEMP' })
    }
  }

  async function onCreateRule(e: React.FormEvent) {
    e.preventDefault()
    if (await create({ name: ruleForm.name, event: ruleForm.event, action: ruleForm.action })) {
      setShowRule(false)
      setRuleForm({ name: '', event: 'student.absent', action: 'create_alert' })
    }
  }

  async function onResolve(id: string, msg: string) {
    if (!(await confirm(`Tandai alert selesai?\n${msg}`))) return
    await resolve(id)
  }

  return (
    <AppShell>
      {dialog}
      <h1 className="text-xl font-semibold">IoT & Otomasi</h1>
      <div className="mt-4 flex gap-2" role="tablist" aria-label="Tab IoT">
        {(['devices', 'alerts', 'rules'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {t === 'devices' ? `Perangkat (${devices?.items.length ?? 0})` : t === 'alerts' ? `Alert (${alerts?.items.length ?? 0})` : 'Aturan'}
          </button>
        ))}
      </div>

      {tab === 'devices' && (
        <>
          <div className="mt-4">
            <button onClick={() => setShowDev((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {showDev ? 'Tutup' : 'Daftarkan Perangkat'}
            </button>
          </div>
          {showDev && (
            <form onSubmit={onRegister} className="mt-3 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-3">
              <input required minLength={3} placeholder="ID perangkat (mis. sensor-01)" value={devForm.deviceId} onChange={(e) => setDevForm({ ...devForm, deviceId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" aria-label="ID perangkat" />
              <input required minLength={2} placeholder="Nama" value={devForm.name} onChange={(e) => setDevForm({ ...devForm, name: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nama perangkat" />
              <select value={devForm.kind} onChange={(e) => setDevForm({ ...devForm, kind: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Jenis">
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              {regError && <p role="alert" className="text-sm text-red-600 sm:col-span-3">{regError}</p>}
              {regOk && <p className="text-sm text-green-700 sm:col-span-3">{regOk}</p>}
              <button type="submit" disabled={registering} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-3 sm:w-40">
                {registering ? '...' : 'Daftarkan'}
              </button>
            </form>
          )}
          {isLoading ? (
            <div className="mt-6"><Spinner /></div>
          ) : isError ? (
            <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat perangkat.</p>
          ) : (devices?.items.length ?? 0) === 0 ? (
            <div className="mt-6"><EmptyState title="Belum ada perangkat" hint="Daftarkan gateway/sensor pertama." /></div>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {devices?.items.map((d) => (
                <li key={d.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{d.name}</p>
                    <Badge color={STATUS_COLOR[d.status] ?? 'slate'}>{d.status}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-400">{d.deviceId} · {d.kind}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {d.battery !== null ? `Baterai ${d.battery}% · ` : ''}{d.lastSeenAt ? `Terakhir ${new Date(d.lastSeenAt).toLocaleString('id-ID')}` : 'Belum pernah lapor'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'alerts' && (
        (alerts?.items.length ?? 0) === 0 ? (
          <div className="mt-6"><EmptyState title="Tidak ada alert terbuka" /></div>
        ) : (
          <ul className="mt-4 space-y-2">
            {alerts?.items.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm">
                  <p>{a.message}</p>
                  <p className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleString('id-ID')} · {a.kind}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={SEV_COLOR[a.severity] ?? 'blue'}>{a.severity}</Badge>
                  <button onClick={() => onResolve(a.id, a.message)} disabled={resolving} className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50">
                    Selesaikan
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'rules' && (
        <>
          <div className="mt-4">
            <button onClick={() => setShowRule((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {showRule ? 'Tutup' : 'Buat Aturan'}
            </button>
          </div>
          {showRule && (
            <form onSubmit={onCreateRule} className="mt-3 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-3">
              <input required minLength={2} placeholder="Nama aturan" value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nama aturan" />
              <select value={ruleForm.event} onChange={(e) => setRuleForm({ ...ruleForm, event: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" aria-label="Event">
                {EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
              </select>
              <select value={ruleForm.action} onChange={(e) => setRuleForm({ ...ruleForm, action: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" aria-label="Aksi">
                {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              {ruleError && <p role="alert" className="text-sm text-red-600 sm:col-span-3">{ruleError}</p>}
              {ruleOk && <p className="text-sm text-green-700 sm:col-span-3">{ruleOk}</p>}
              <button type="submit" disabled={creating} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-3 sm:w-40">
                {creating ? '...' : 'Simpan Aturan'}
              </button>
            </form>
          )}
          <ul className="mt-4 space-y-2">
            {(rules?.items ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm">
                  <p className="font-medium">{r.name}</p>
                  <p className="font-mono text-xs text-slate-400">WHEN {r.event} → THEN {r.action}</p>
                </div>
                <button onClick={() => toggle(r.id)} className={`rounded-full px-3 py-1 text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
                  {r.isActive ? 'AKTIF' : 'MATI'}
                </button>
              </li>
            ))}
          </ul>
          {(rules?.items.length ?? 0) === 0 && (
            <div className="mt-3"><EmptyState title="Belum ada aturan otomasi" hint="Contoh: siswa alpa → beri tahu wali." /></div>
          )}
        </>
      )}
    </AppShell>
  )
}
