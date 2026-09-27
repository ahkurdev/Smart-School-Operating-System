"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { saveGradesBulkAction, gradeWorkflowAction } from "@/features/work/actions";

type Assessment = { id: string; title: string; maxScore: number; weight: number; type: string; status: string };
type Row = {
  studentId: string;
  studentName: string;
  studentNumber: string;
  cells: Record<string, { gradeId: string | null; score: number | null; status: string }>;
  weightedAverage: number | null;
  letter: string | null;
};

export function GradebookGrid({ assessments, rows, canWrite }: { assessments: Assessment[]; rows: Row[]; canWrite: boolean }) {
  // Local edits keyed by `${assessmentId}:${studentId}` so typing is instant.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const key = (a: string, s: string) => `${a}:${s}`;

  function setCell(a: string, s: string, value: string) {
    setEdits((prev) => ({ ...prev, [key(a, s)]: value }));
  }

  function saveColumn(a: Assessment) {
    const entries = rows.map((r) => {
      const raw = edits[key(a.id, r.studentId)];
      const existing = r.cells[a.id]?.score ?? null;
      const score = raw === undefined ? existing : raw === "" ? null : Number(raw);
      return { studentId: r.studentId, score };
    });
    startTransition(async () => {
      const res = await saveGradesBulkAction(a.id, entries);
      if (res.ok) {
        toast.success(`Saved ${a.title}`);
        setEdits((prev) => {
          const next = { ...prev };
          for (const r of rows) delete next[key(a.id, r.studentId)];
          return next;
        });
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function workflow(a: Assessment, step: "submit" | "approve" | "publish") {
    startTransition(async () => {
      const res = await gradeWorkflowAction(a.id, step);
      if (res.ok) {
        toast.success(`Grades ${step === "submit" ? "submitted" : step === "approve" ? "approved" : "published"}`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="sticky left-0 z-10 bg-muted/40 p-3 font-medium">Student</th>
            {assessments.map((a) => (
              <th key={a.id} className="min-w-32 p-3 font-medium">
                <div className="flex flex-col gap-1">
                  <span className="truncate">{a.title}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {a.type.toLowerCase()} · /{a.maxScore} · w{a.weight}
                  </span>
                  <Badge variant={a.status === "PUBLISHED" ? "success" : a.status === "DRAFT" ? "neutral" : "info"}>{a.status.toLowerCase()}</Badge>
                </div>
              </th>
            ))}
            <th className="p-3 font-medium">Average</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.studentId} className="border-b border-border last:border-0">
              <th scope="row" className="sticky left-0 z-10 bg-background p-3 text-left font-normal">
                <span className="block font-medium">{r.studentName}</span>
                <span className="font-mono text-xs text-muted-foreground">{r.studentNumber}</span>
              </th>
              {assessments.map((a) => {
                const cell = r.cells[a.id];
                const raw = edits[key(a.id, r.studentId)];
                const value = raw !== undefined ? raw : cell?.score != null ? String(cell.score) : "";
                return (
                  <td key={a.id} className="p-2">
                    <input
                      type="number"
                      min={0}
                      max={a.maxScore}
                      value={value}
                      disabled={!canWrite}
                      onChange={(e) => setCell(a.id, r.studentId, e.target.value)}
                      aria-label={`${r.studentName} — ${a.title}`}
                      className="h-9 w-20 rounded-md border border-input bg-transparent px-2 text-center tabular disabled:opacity-60"
                    />
                  </td>
                );
              })}
              <td className="p-3 tabular font-medium">
                {r.weightedAverage != null ? `${r.weightedAverage} (${r.letter})` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="p-3" />
            {assessments.map((a) => (
              <td key={a.id} className="p-2">
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" disabled={pending || !canWrite} onClick={() => saveColumn(a)}>
                    Save
                  </Button>
                  {a.status === "DRAFT" && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => workflow(a, "submit")}>
                      Submit
                    </Button>
                  )}
                  {a.status === "SUBMITTED" && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => workflow(a, "approve")}>
                      Approve
                    </Button>
                  )}
                  {(a.status === "SUBMITTED" || a.status === "APPROVED") && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => workflow(a, "publish")}>
                      Publish
                    </Button>
                  )}
                </div>
              </td>
            ))}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
