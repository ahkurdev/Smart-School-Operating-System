"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createInvoiceAction, type OpsResult } from "@/features/ops/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Creating…" : "Create invoice"}
    </Button>
  );
}

export function CreateInvoiceDialog({
  students,
  academicYearId,
}: {
  students: { id: string; name: string; studentNumber: string }[];
  academicYearId: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([{ id: 0 }]);
  const [state, action] = useActionState<OpsResult | null, FormData>(createInvoiceAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Invoice created");
      setOpen(false);
      setRows([{ id: 0 }]);
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
          <Plus className="size-4" aria-hidden /> New invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New invoice</DialogTitle>
          <DialogDescription>Bill a student&apos;s family. Amounts are totals before any discount.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="academicYearId" value={academicYearId} />
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
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
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" name="dueDate" type="date" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Line items</Label>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2">
                  <Input name="itemDescription" placeholder="Description (e.g. Tuition)" required aria-label={`Item ${i + 1} description`} />
                  <Input name="itemPrice" type="number" min={0} step="0.01" placeholder="Amount" className="w-32" required aria-label={`Item ${i + 1} amount`} />
                  {rows.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setRows((p) => p.filter((x) => x.id !== r.id))} aria-label="Remove item">
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((p) => [...p, { id: Math.max(...p.map((x) => x.id)) + 1 }])}>
              <Plus className="size-4" aria-hidden /> Add item
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="discount">Discount</Label>
              <Input id="discount" name="discount" type="number" min={0} step="0.01" defaultValue={0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="IDR" maxLength={8} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          <DialogFooter>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
