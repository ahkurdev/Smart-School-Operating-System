'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { EmptyState, Modal, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import { useStudents } from '@/lib/student-hooks'
import {
  useVisits, useVendors, useBuses, useCreateVisit, useCreateVendor, useAddMenu, useCreateBus, useAddRoute,
} from '@/lib/ops-hooks'

export default function OpsPage() {
  const { data: me } = useMe()
  const [tab, setTab] = useState<'uks' | 'kantin' | 'bus'>('uks')
  const { data: visits, isLoading, isError } = useVisits()
  const { data: vendors } = useVendors()
  const { data: buses } = useBuses()
  const { create: createVisit, loading: creatingV, error: visitError, ok: visitOk } = useCreateVisit()
  const { create: createVendor, loading: creatingVen, error: vendorError, ok: vendorOk } = useCreateVendor()
  const { create: createBus, loading: creatingB, error: busError, ok: busOk } = useCreateBus()

  const [showVisit, setShowVisit] = useState(false)
  const [visitQ, setVisitQ] = useState('')
  const { data: students } = useStudents(showVisit ? visitQ || undefined : undefined, 1)
  const [visitForm, setVisitForm] = useState({ studentId: '', complaint: '', temperatureC: '', parentContacted: false, referredTo: '' })

  const [showVendor, setShowVendor] = useState(false)
  const [vendorForm, setVendorForm] = useState({ name: '', phone: '' })
  const [menuFor, setMenuFor] = useState<{ id: string; name: string } | null>(null)
  const [menuForm, setMenuForm] = useState({ name: '', price: '' })
  const { add: addMenu, loading: addingM, error: menuError } = useAddMenu(menuFor?.id ?? '')

  const [showBus, setShowBus] = useState(false)
  const [busForm, setBusForm] = useState({ plateNumber: '', capacity: '', driverName: '' })
  const [routeFor, setRouteFor] = useState<{ id: string; plate: string } | null>(null)
  const [routeForm, setRouteForm] = useState({ name: '', departTime: '' })
  const { add: addRoute, loading: addingR, error: routeError } = useAddRoute(routeFor?.id ?? '')

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  async function onVisit(e: React.FormEvent) {
    e.preventDefault()
    if (await createVisit({
      studentId: visitForm.studentId,
      complaint: visitForm.complaint,
      temperatureC: visitForm.temperatureC ? Number(visitForm.temperatureC) : undefined,
      parentContacted: visitForm.parentContacted,
      referredTo: visitForm.referredTo || undefined,
    })) {
      setShowVisit(false)
      setVisitForm({ studentId: '', complaint: '', temperatureC: '', parentContacted: false, referredTo: '' })
    }
  }

  async function onVendor(e: React.FormEvent) {
    e.preventDefault()
    if (await createVendor({ name: vendorForm.name, phone: vendorForm.phone || undefined })) {
      setShowVendor(false)
      setVendorForm({ name: '', phone: '' })
    }
  }

  async function onMenu(e: React.FormEvent) {
    e.preventDefault()
    if (await addMenu({ name: menuForm.name, price: Number(menuForm.price) })) {
      setMenuFor(null)
      setMenuForm({ name: '', price: '' })
    }
  }

  async function onBus(e: React.FormEvent) {
    e.preventDefault()
    if (await createBus({ plateNumber: busForm.plateNumber, capacity: Number(busForm.capacity), driverName: busForm.driverName || undefined })) {
      setShowBus(false)
      setBusForm({ plateNumber: '', capacity: '', driverName: '' })
    }
  }

  async function onRoute(e: React.FormEvent) {
    e.preventDefault()
    if (await addRoute({ name: routeForm.name, departTime: routeForm.departTime || undefined })) {
      setRouteFor(null)
      setRouteForm({ name: '', departTime: '' })
    }
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">UKS · Kantin · Bus</h1>
      <div className="mt-4 flex gap-2" role="tablist" aria-label="Tab operasional">
        {(['uks', 'kantin', 'bus'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {t === 'uks' ? 'UKS' : t === 'kantin' ? 'Kantin' : 'Bus'}
          </button>
        ))}
      </div>

      {tab === 'uks' && (
        <>
          <div className="mt-4">
            <button onClick={() => setShowVisit((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {showVisit ? 'Tutup' : 'Catat Kunjungan'}
            </button>
          </div>
          {showVisit && (
            <form onSubmit={onVisit} className="mt-3 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
              <input placeholder="Cari siswa..." value={visitQ} onChange={(e) => setVisitQ(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Cari siswa" />
              <select required value={visitForm.studentId} onChange={(e) => setVisitForm({ ...visitForm, studentId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Siswa">
                <option value="">Pilih siswa</option>
                {students?.items.map((s) => <option key={s.id} value={s.id}>{s.fullName} ({s.nis})</option>)}
              </select>
              <input required minLength={2} placeholder="Keluhan" value={visitForm.complaint} onChange={(e) => setVisitForm({ ...visitForm, complaint: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" aria-label="Keluhan" />
              <input type="number" step="0.1" min={30} max={45} placeholder="Suhu (C)" value={visitForm.temperatureC} onChange={(e) => setVisitForm({ ...visitForm, temperatureC: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Suhu" />
              <input placeholder="Rujuk ke (opsional)" value={visitForm.referredTo} onChange={(e) => setVisitForm({ ...visitForm, referredTo: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Rujukan" />
              <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
                <input type="checkbox" checked={visitForm.parentContacted} onChange={(e) => setVisitForm({ ...visitForm, parentContacted: e.target.checked })} />
                Orang tua sudah dihubungi
              </label>
              {visitError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{visitError}</p>}
              {visitOk && <p className="text-sm text-green-700 sm:col-span-2">{visitOk}</p>}
              <button type="submit" disabled={creatingV} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:w-40">
                {creatingV ? '...' : 'Simpan'}
              </button>
            </form>
          )}
          {isLoading ? (
            <div className="mt-6"><Spinner /></div>
          ) : isError ? (
            <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat kunjungan.</p>
          ) : (visits?.items.length ?? 0) === 0 ? (
            <div className="mt-6"><EmptyState title="Belum ada kunjungan UKS" /></div>
          ) : (
            <ul className="mt-4 space-y-2">
              {visits?.items.map((v) => (
                <li key={v.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <p className="font-medium">{v.student.fullName}</p>
                  <p className="text-sm text-slate-500">{v.complaint}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(v.visitAt).toLocaleString('id-ID')}
                    {v.temperatureC ? ` · ${v.temperatureC}C` : ''}{v.parentContacted ? ' · ortu dihubungi' : ''}{v.referredTo ? ` · rujuk: ${v.referredTo}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'kantin' && (
        <>
          <div className="mt-4">
            <button onClick={() => setShowVendor((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {showVendor ? 'Tutup' : 'Tambah Vendor'}
            </button>
          </div>
          {showVendor && (
            <form onSubmit={onVendor} className="mt-3 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
              <input required minLength={2} placeholder="Nama vendor" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nama vendor" />
              <input placeholder="No. HP" value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="No HP" />
              {vendorError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{vendorError}</p>}
              {vendorOk && <p className="text-sm text-green-700 sm:col-span-2">{vendorOk}</p>}
              <button type="submit" disabled={creatingVen} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:w-40">
                {creatingVen ? '...' : 'Simpan'}
              </button>
            </form>
          )}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {(vendors?.items ?? []).map((v) => (
              <li key={v.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="font-semibold">{v.name}</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {v.menus.map((m) => (
                    <li key={m.id} className="flex justify-between"><span>{m.name}</span><span className="font-mono">Rp{m.price.toLocaleString('id-ID')}</span></li>
                  ))}
                  {v.menus.length === 0 && <li className="text-xs text-slate-400">Belum ada menu.</li>}
                </ul>
                <button onClick={() => { setMenuFor({ id: v.id, name: v.name }); setMenuForm({ name: '', price: '' }) }} className="mt-2 text-xs font-medium text-brand-600 hover:underline">
                  Tambah Menu
                </button>
              </li>
            ))}
          </ul>

          <Modal open={menuFor !== null} onClose={() => setMenuFor(null)} title={`Menu — ${menuFor?.name ?? ''}`}>
            <form onSubmit={onMenu} className="space-y-3">
              <input required minLength={2} placeholder="Nama menu" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nama menu" />
              <input required type="number" min={1} placeholder="Harga (Rp)" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Harga" />
              {menuError && <p role="alert" className="text-sm text-red-600">{menuError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setMenuFor(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
                <button type="submit" disabled={addingM} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {addingM ? '...' : 'Tambah'}
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}

      {tab === 'bus' && (
        <>
          <div className="mt-4">
            <button onClick={() => setShowBus((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {showBus ? 'Tutup' : 'Tambah Bus'}
            </button>
          </div>
          {showBus && (
            <form onSubmit={onBus} className="mt-3 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-3">
              <input required minLength={3} placeholder="Plat nomor" value={busForm.plateNumber} onChange={(e) => setBusForm({ ...busForm, plateNumber: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" aria-label="Plat nomor" />
              <input required type="number" min={1} max={100} placeholder="Kapasitas" value={busForm.capacity} onChange={(e) => setBusForm({ ...busForm, capacity: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Kapasitas" />
              <input placeholder="Nama sopir" value={busForm.driverName} onChange={(e) => setBusForm({ ...busForm, driverName: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Sopir" />
              {busError && <p role="alert" className="text-sm text-red-600 sm:col-span-3">{busError}</p>}
              {busOk && <p className="text-sm text-green-700 sm:col-span-3">{busOk}</p>}
              <button type="submit" disabled={creatingB} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-3 sm:w-40">
                {creatingB ? '...' : 'Simpan'}
              </button>
            </form>
          )}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {(buses?.items ?? []).map((b) => (
              <li key={b.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="font-mono font-semibold">{b.plateNumber}</p>
                <p className="text-sm text-slate-500">Kapasitas {b.capacity}{b.driverName ? ` · ${b.driverName}` : ''}</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {b.routes.map((r) => (
                    <li key={r.id}>{r.name}{r.departTime ? ` · ${r.departTime}` : ''}</li>
                  ))}
                </ul>
                <button onClick={() => { setRouteFor({ id: b.id, plate: b.plateNumber }); setRouteForm({ name: '', departTime: '' }) }} className="mt-2 text-xs font-medium text-brand-600 hover:underline">
                  Tambah Rute
                </button>
              </li>
            ))}
          </ul>

          <Modal open={routeFor !== null} onClose={() => setRouteFor(null)} title={`Rute — ${routeFor?.plate ?? ''}`}>
            <form onSubmit={onRoute} className="space-y-3">
              <input required minLength={2} placeholder="Nama rute" value={routeForm.name} onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Nama rute" />
              <input type="time" value={routeForm.departTime} onChange={(e) => setRouteForm({ ...routeForm, departTime: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Jam berangkat" />
              {routeError && <p role="alert" className="text-sm text-red-600">{routeError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setRouteFor(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
                <button type="submit" disabled={addingR} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {addingR ? '...' : 'Tambah'}
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </AppShell>
  )
}
