"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generateReportCardAction, type OpsResult } from "@/features/ops/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Generating…" : "Generate report card"}
    </Button>
  );
}

export function GenerateReportCardDialog({
  students,
  academicYearId,
  terms,
}: {
  students: { id: string; name: string; studentNumber: string }[];
  academicYearId: string;
  terms: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<OpsResult | null, FormData>(generateReportCardAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Report card generated");
      setOpen(false);
      router.refresh();
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  const sel = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <FileText className="size-4" aria-hidden /> Generate report card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate report card</DialogTitle>
          <DialogDescription>
            Snapshots the student&apos;s published grades and attendance. You can review before publishing.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="academicYearId" value={academicYearId} />
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="studentId">Student</Label>
            <select id="studentId" name="studentId" className={sel} required>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.studentNumber})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="termId">Term (optional)</Label>
            <select id="termId" name="termId" className={sel} defaultValue="">
              <option value="">Whole year</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="teacherRemarks">Teacher remarks</Label>
            <Textarea id="teacherRemarks" name="teacherRemarks" rows={3} />
          </div>
          <DialogFooter>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
