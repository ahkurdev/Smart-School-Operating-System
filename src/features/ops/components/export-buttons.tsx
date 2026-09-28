"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportStudentsAction, exportAttendanceAction } from "@/features/ops/data-actions";

/** Trigger a browser download from returned text content. */
function download(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportButtons({ canExportStudents, canExportAttendance }: { canExportStudents: boolean; canExportAttendance: boolean }) {
  const [pending, start] = useTransition();
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  function runExport(fn: () => Promise<{ ok: true; filename: string; mime: string; content: string } | { ok: false; error: string }>) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        download(res.filename, res.mime, res.content);
        toast.success("Export ready");
      } else {
        toast.error(res.error);
      }
    });
  }

  if (!canExportStudents && !canExportAttendance) return null;

  return (
    <div className="flex flex-wrap items-end gap-3">
      {canExportStudents ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => runExport(() => exportStudentsAction("csv"))}>
            <Download className="size-4" aria-hidden /> Students CSV
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => runExport(() => exportStudentsAction("xlsx"))}>
            <Download className="size-4" aria-hidden /> Students XLSX
          </Button>
        </div>
      ) : null}
      {canExportAttendance ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="exp-from" className="text-xs">From</Label>
            <Input id="exp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-to" className="text-xs">To</Label>
            <Input id="exp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36" />
          </div>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => runExport(() => exportAttendanceAction(from, to, "csv"))}>
            <Download className="size-4" aria-hidden /> Attendance
          </Button>
        </div>
      ) : null}
    </div>
  );
}
