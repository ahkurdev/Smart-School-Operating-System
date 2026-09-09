'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Badge, EmptyState, Modal, Spinner } from '@/components/ui'
import { useMe } from '@/lib/auth-hooks'
import {
  useForms, useFormDetail, useCreateForm, useSubmitForm, type FormField,
} from '@/lib/form-hooks'

const TYPES = ['text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'date'] as const

export default function FormsPage() {
  const { data: me } = useMe()
  const { data, isLoading, isError } = useForms()
  const [selected, setSelected] = useState<string | null>(null)
  const { data: detail } = useFormDetail(selected)
  const { create, loading: creating, error: createError, ok: createOk } = useCreateForm()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<FormField[]>([{ key: 'nama', label: 'Nama', type: 'text', required: true }])

  if (!me) {
    return (
      <AppShell>
        <p className="text-slate-600">Memuat...</p>
      </AppShell>
    )
  }

  function addField() {
    const n = fields.length + 1
    setFields([...fields, { key: `field_${n}`, label: '', type: 'text', required: false }])
  }

  function setField(i: number, patch: Partial<FormField>) {
    setFields(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (await create({ title, description: description || undefined, schema: { fields } })) {
      setShowForm(false)
      setTitle('')
      setDescription('')
      setFields([{ key: 'nama', label: 'Nama', type: 'text', required: true }])
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Formulir Dinamis</h1>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          {showForm ? 'Tutup' : 'Buat Formulir'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="mt-4 space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <input required minLength={2} placeholder="Judul formulir" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Judul formulir" />
          <input placeholder="Deskripsi (opsional)" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Deskripsi" />
          {fields.map((f, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-4">
              <input required placeholder="key (a-z_)" value={f.key} onChange={(e) => setField(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} className="rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-xs" aria-label={`Key field ${i + 1}`} />
              <input required placeholder="Label" value={f.label} onChange={(e) => setField(i, { label: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" aria-label={`Label field ${i + 1}`} />
              <select value={f.type} onChange={(e) => setField(i, { type: e.target.value as FormField['type'] })} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" aria-label={`Tipe field ${i + 1}`}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={!!f.required} onChange={(e) => setField(i, { required: e.target.checked })} /> wajib
                </label>
                {['select', 'radio'].includes(f.type) && (
                  <input placeholder="opsi, pisah koma" value={(f.options ?? []).join(', ')} onChange={(e) => setField(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" aria-label={`Opsi field ${i + 1}`} />
                )}
                {fields.length > 1 && (
                  <button type="button" onClick={() => setFields(fields.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">hapus</button>
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" onClick={addField} className="rounded-lg border px-3 py-1.5 text-xs font-medium">+ Field</button>
          </div>
          {createError && <p role="alert" className="text-sm text-red-600">{createError}</p>}
          {createOk && <p className="text-sm text-green-700">{createOk}</p>}
          <button type="submit" disabled={creating} className="w-40 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {creating ? '...' : 'Simpan Formulir'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="mt-6"><Spinner /></div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">Gagal memuat formulir. Butuh hak form.manage.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="mt-6"><EmptyState title="Belum ada formulir" hint="Buat survei, form izin, atau pendaftaran event." /></div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {data?.items.map((f) => (
            <li key={f.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{f.title}</p>
                <Badge color={f.isActive ? 'green' : 'slate'}>{f.isActive ? 'Buka' : 'Tutup'}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">{f.schema.fields.length} field · {f._count.responses} respons</p>
              <button onClick={() => setSelected(f.id)} className="mt-2 text-xs font-medium text-brand-600 hover:underline">
                Isi / Lihat Respons
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={detail?.title ?? 'Formulir'}>
        {detail && <FillForm key={detail.id} form={detail} />}
      </Modal>
    </AppShell>
  )
}

function FillForm({ form }: { form: { id: string; schema: { fields: FormField[] }; responses: { id: string; answers: Record<string, unknown>; createdAt: string }[] } }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const { submit, loading, error, ok } = useSubmitForm(form.id)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (await submit(answers)) setAnswers({})
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
        {form.schema.fields.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-sm font-medium">{f.label}{f.required ? ' *' : ''}</label>
            {(f.type === 'text' || f.type === 'number' || f.type === 'date') && (
              <input type={f.type === 'text' ? 'text' : f.type} required={!!f.required} value={String(answers[f.key] ?? '')} onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            )}
            {f.type === 'textarea' && (
              <textarea required={!!f.required} value={String(answers[f.key] ?? '')} onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3} />
            )}
            {(f.type === 'select' || f.type === 'radio') && (
              <select required={!!f.required} value={String(answers[f.key] ?? '')} onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Pilih...</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {f.type === 'checkbox' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!answers[f.key]} onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.checked })} /> Ya
              </label>
            )}
          </div>
        ))}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {ok && <p className="text-sm text-green-700">{ok}</p>}
        <button type="submit" disabled={loading} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? '...' : 'Kirim'}
        </button>
      </form>
      <div>
        <h3 className="text-sm font-semibold">Respons ({form.responses.length})</h3>
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
          {form.responses.map((r) => (
            <li key={r.id} className="rounded bg-slate-50 p-2 font-mono">
              {new Date(r.createdAt).toLocaleString('id-ID')} — {Object.entries(r.answers).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
