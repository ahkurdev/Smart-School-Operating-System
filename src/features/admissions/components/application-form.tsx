"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { saveApplicationAction, submitApplicationAction, attachDocumentAction } from "@/features/admissions/actions";

export type PublicField = {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options: string[];
  section: string | null;
};

export type ExistingDoc = { id: string; documentType: string; fileId: string };

/**
 * Applicant-facing dynamic form (Phase 34/35).
 *
 * Renders the period's fields (closed set of types), saves answers in one call,
 * lets the applicant upload required documents, then submit. Read-only once the
 * application is past DRAFT/NEEDS_REVISION.
 */
export function ApplicationForm({
  applicationId,
  fields,
  initialValues,
  documents,
  canEdit,
}: {
  applicationId: string;
  fields: PublicField[];
  initialValues: Record<string, unknown>;
  documents: ExistingDoc[];
  canEdit: boolean;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function set(fieldKey: string, v: unknown) {
    setValues((prev) => ({ ...prev, [fieldKey]: v }));
  }

  function save() {
    startTransition(async () => {
      const res = await saveApplicationAction(
        applicationId,
        fields.map((f) => ({ fieldId: f.id, value: values[f.key] ?? "" })),
      );
      if (res.ok) {
        toast.success("Saved");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function submit() {
    startTransition(async () => {
      const saved = await saveApplicationAction(
        applicationId,
        fields.map((f) => ({ fieldId: f.id, value: values[f.key] ?? "" })),
      );
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      const res = await submitApplicationAction(applicationId);
      if (res.ok) {
        toast.success("Application submitted");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  // Group by section for a clean layout.
  const sections = new Map<string, PublicField[]>();
  for (const f of fields) {
    const key = f.section?.trim() || "Application details";
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(f);
  }

  return (
    <div className="space-y-6">
      {[...sections.entries()].map(([section, sectionFields]) => (
        <section key={section} className="space-y-4">
          <h2 className="font-medium">{section}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {sectionFields.map((f) => (
              <div key={f.id} className={f.type === "LONG_TEXT" ? "sm:col-span-2" : ""}>
                <Field
                  field={f}
                  value={values[f.key]}
                  onChange={(v) => set(f.key, v)}
                  disabled={!canEdit}
                  applicationId={applicationId}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      {documents.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Uploaded documents</h2>
          <ul className="space-y-1 text-sm">
            {documents.map((d) => (
              <li key={d.id}>
                <a href={`/api/files/${d.fileId}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {d.documentType}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canEdit && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={save} disabled={pending}>
            Save draft
          </Button>
          <Button onClick={submit} disabled={pending} aria-busy={pending}>
            {pending ? "Submitting…" : "Submit application"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
  disabled,
  applicationId,
}: {
  field: PublicField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled: boolean;
  applicationId: string;
}) {
  const label = (
    <Label htmlFor={field.key}>
      {field.label}
      {field.required && <span className="text-destructive"> *</span>}
    </Label>
  );
  const help = field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null;
  const strVal = typeof value === "string" ? value : "";

  switch (field.type) {
    case "LONG_TEXT":
      return (
        <div className="space-y-1">
          {label}
          <Textarea id={field.key} rows={4} value={strVal} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={field.placeholder ?? ""} />
          {help}
        </div>
      );
    case "SELECT":
    case "RADIO":
      return (
        <div className="space-y-1">
          {label}
          <select
            id={field.key}
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Select…</option>
            {field.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {help}
        </div>
      );
    case "MULTI_SELECT": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-1">
          {label}
          <div className="flex flex-wrap gap-2">
            {field.options.map((o) => {
              const checked = arr.includes(o);
              return (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
                  />
                  {o}
                </label>
              );
            })}
          </div>
          {help}
        </div>
      );
    }
    case "CHECKBOX":
      return (
        <div className="flex items-center gap-2 pt-6">
          <input id={field.key} type="checkbox" className="size-4 rounded border-border" checked={Boolean(value)} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
          {label}
        </div>
      );
    case "FILE":
    case "IMAGE":
      return <FileField field={field} applicationId={applicationId} disabled={disabled} />;
    default: {
      const typeAttr =
        field.type === "NUMBER" ? "number" : field.type === "EMAIL" ? "email" : field.type === "DATE" ? "date" : field.type === "PHONE" ? "tel" : "text";
      return (
        <div className="space-y-1">
          {label}
          <Input id={field.key} type={typeAttr} value={strVal} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={field.placeholder ?? ""} />
          {help}
        </div>
      );
    }
  }
}

function FileField({ field, applicationId, disabled }: { field: PublicField; applicationId: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [uploaded, setUploaded] = useState(false);
  const router = useRouter();

  function upload(file: File) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload-temp", { method: "POST", body: fd });
      if (!res.ok) {
        toast.error("Upload failed");
        return;
      }
      const { fileId } = (await res.json()) as { fileId: string };
      const attached = await attachDocumentAction(applicationId, fileId, field.label);
      if (attached.ok) {
        toast.success("Uploaded");
        setUploaded(true);
        router.refresh();
      } else toast.error(attached.error);
    });
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={field.key}>
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      {uploaded ? (
        <Badge variant="success">Uploaded</Badge>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          <Upload className="size-4" aria-hidden />
          {pending ? "Uploading…" : "Choose file"}
          <input
            id={field.key}
            type="file"
            className="sr-only"
            disabled={disabled || pending}
            accept={field.type === "IMAGE" ? "image/*" : undefined}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
        </label>
      )}
      {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
    </div>
  );
}
