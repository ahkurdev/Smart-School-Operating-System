"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { BookUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { borrowItemAction, type LibraryResult } from "@/features/library/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Loaning…" : "Loan copy"}
    </Button>
  );
}

export function BorrowDialog({
  copies,
  students,
}: {
  copies: { id: string; barcode: string; status: string }[];
  students: { id: string; name: string; studentNumber: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<LibraryResult | null, FormData>(borrowItemAction, null);
  const router = useRouter();
  const available = copies.filter((c) => c.status === "AVAILABLE");

  useEffect(() => {
    if (state?.ok) {
      toast.success("Copy loaned");
      setOpen(false);
      router.refresh();
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  const sel = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

  if (available.length === 0) {
    return <p className="text-sm text-muted-foreground">No copies are currently available.</p>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <BookUp className="size-4" aria-hidden /> Loan a copy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Loan a copy</DialogTitle>
          <DialogDescription>Choose an available copy and the student borrowing it.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="copyId">Copy</Label>
            <select id="copyId" name="copyId" className={sel} required>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.barcode}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="studentId">Borrower</Label>
            <select id="studentId" name="studentId" className={sel} required>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.studentNumber})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="days">Loan period (days)</Label>
            <Input id="days" name="days" type="number" min={1} max={120} defaultValue={14} />
          </div>
          <DialogFooter>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
