"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveFormAction } from "@/features/admissions/actions";
import { FIELD_TYPES, type EditorField, defaultField } from "@/features/admissions/fields";

/**
 * Dynamic form builder (Phase 33).
 *
 * Staff compose the application form from a closed set of field types. Options
 * for SELECT/RADIO are edited as a comma-separated list. Everything is saved in
 * one atomic call; the server re-validates keys, types and duplicates.
 */
export function FormBuilder({ periodId, initialFields }: { periodId: string; initialFields: EditorField[] }) {
  const [fields, setFields] = useState<EditorField[]>(initialFields);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function add(type: string) {
    setFields((prev) => [...prev, defaultField(type, prev.length)]);
  }

  function remove(key: string) {
    setFields((prev) => prev.filter((f) => f.key !== key));
  }

  function move(key: string, dir: -1 | 1) {
    setFields((prev) => {
      const i = prev.findIndex((f) => f.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      const a = copy[i];
      const b = copy[j];
      if (!a || !b) return prev;
      copy[i] = b;
      copy[j] = a;
      return copy;
    });
  }

  function patch(key: string, changes: Partial<EditorField>) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...changes } : f)));
  }

  function save() {
    startTransition(async () => {
      const res = await saveFormAction(
        periodId,
        fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          placeholder: f.placeholder,
          helpText: f.helpText,
          options: f.options,
          section: f.section,
        })),
      );
      if (res.ok) {
        toast.success("Application form saved");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FIELD_TYPES.map((t) => (
            <Button key={t.type} size="sm" variant="outline" onClick={() => add(t.type)}>
              <Plus className="size-3.5" aria-hidden /> {t.label}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={save} disabled={pending} aria-busy={pending}>
          <Save className="size-4" aria-hidden /> {pending ? "Saving…" : "Save form"}
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          No fields yet. Add one above to start building the application form.
        </p>
      ) : (
        <ol className="space-y-3">
          {fields.map((field, i) => (
            <li key={field.key} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input value={field.label} onChange={(e) => patch(field.key, { label: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Key</Label>
                    <Input
                      value={field.key}
                      className="font-mono text-xs"
                      onChange={(e) => patch(field.key, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <select
                      value={field.type}
                      onChange={(e) => patch(field.key, { type: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.type} value={t.type}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(field.type === "SELECT" || field.type === "RADIO" || field.type === "MULTI_SELECT") && (
                    <div className="space-y-1 sm:col-span-3">
                      <Label className="text-xs">Options (comma separated)</Label>
                      <Input
                        value={field.options.join(", ")}
                        onChange={(e) => patch(field.key, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Placeholder</Label>
                    <Input value={field.placeholder} onChange={(e) => patch(field.key, { placeholder: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Section</Label>
                    <Input value={field.section} onChange={(e) => patch(field.key, { section: e.target.value })} placeholder="Personal details" />
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-border"
                        checked={field.required}
                        onChange={(e) => patch(field.key, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon" onClick={() => move(field.key, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => move(field.key, 1)} disabled={i === fields.length - 1} aria-label="Move down">
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(field.key)} aria-label="Remove field">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
