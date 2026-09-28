"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  previewStudentImportAction,
  commitStudentImportAction,
  type PreviewResult,
  type DataResult,
} from "@/features/ops/data-actions";

function PickButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      <Upload className="size-4" aria-hidden /> {pending ? "Checking…" : "Check file"}
    </Button>
  );
}

export function StudentImport() {
  const [state, action] = useActionState<PreviewResult | null, FormData>(previewStudentImportAction, null);
  const [committing, startCommit] = useTransition();
  const router = useRouter();
  const [committed, setCommitted] = useState<DataResult | null>(null);

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  const preview = state && state.ok ? state.preview : null;

  function commit() {
    if (!preview) return;
    startCommit(async () => {
      const res = await commitStudentImportAction(
        preview.rows.map((r) => ({ fullName: r.fullName!, studentNumber: r.studentNumber!, email: r.email || undefined })),
      );
      setCommitted(res);
      if (res.ok) {
        toast.success("Import complete");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4 rounded-xl border border-border p-4">
        <div className="space-y-2">
          <Label htmlFor="csv">CSV file</Label>
          <Input id="csv" name="file" type="file" accept=".csv,text/csv" required />
          <p className="text-sm text-muted-foreground">
            Required columns: <code>fullName</code>, <code>studentNumber</code>. Optional: <code>email</code>. Save spreadsheets as CSV.
          </p>
        </div>
        <PickButton />
      </form>

      {preview ? (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium">{preview.totalRows} data rows</span>
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 className="size-4" aria-hidden /> {preview.validCount} valid
            </span>
            {preview.errors.length > 0 ? (
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="size-4" aria-hidden /> {preview.errors.length} problems
              </span>
            ) : null}
          </div>

          {preview.errors.length > 0 ? (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-inside list-disc text-sm">
                  {preview.errors.slice(0, 8).map((e) => (
                    <li key={`${e.row}-${e.message}`}>Row {e.row}: {e.message}</li>
                  ))}
                  {preview.errors.length > 8 ? <li>…and {preview.errors.length - 8} more.</li> : null}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          {preview.validCount > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Preview of valid rows to import</caption>
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    {preview.columns.map((c) => (
                      <th key={c} scope="col" className="py-2 pr-4 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.rows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      {preview.columns.map((c) => (
                        <td key={c} className="py-2 pr-4">
                          {r[c] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 10 ? <p className="mt-2 text-xs text-muted-foreground">Showing first 10 of {preview.rows.length}.</p> : null}
            </div>
          ) : null}

          <Button onClick={commit} disabled={committing || preview.validCount === 0} aria-busy={committing}>
            {committing ? "Importing…" : `Import ${preview.validCount} students`}
          </Button>

          {committed?.ok ? <p className="text-sm text-success">Import finished{committed.summary ? ` (${committed.summary})` : ""}. Students are now visible in the Students list.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
