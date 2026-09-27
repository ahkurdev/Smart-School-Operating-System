"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createAcademicYearAction, type AcademicActionResult } from "@/features/academics/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create year"}
    </Button>
  );
}

export function AddAcademicYearDialog() {
  const [open, setOpen] = useState(false);
  const [termCount, setTermCount] = useState(2);
  const [state, action] = useActionState<AcademicActionResult | undefined, FormData>(
    createAcademicYearAction,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Created");
      setOpen(false);
    }
  }, [state]);

  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden /> New academic year
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create academic year</DialogTitle>
          <DialogDescription>
            A year groups classes, enrollments, and terms. You can add more terms later.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="year-name">Name</Label>
            <Input id="year-name" name="name" placeholder="2026/2027" aria-invalid={!!fe.name} />
            {fe.name ? <p className="text-xs text-destructive">{fe.name[0]}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" name="startDate" type="date" aria-invalid={!!fe.startDate} />
              {fe.startDate ? <p className="text-xs text-destructive">{fe.startDate[0]}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" name="endDate" type="date" aria-invalid={!!fe.endDate} />
              {fe.endDate ? <p className="text-xs text-destructive">{fe.endDate[0]}</p> : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="termCount">Number of terms</Label>
            <select
              id="termCount"
              name="termCount"
              value={termCount}
              onChange={(e) => setTermCount(Number(e.target.value))}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value={0}>No terms yet</option>
              <option value={1}>1 term</option>
              <option value={2}>2 terms (semesters)</option>
              <option value={3}>3 terms (trimesters)</option>
              <option value={4}>4 terms (quarters)</option>
            </select>
          </div>
          {Array.from({ length: termCount }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Label htmlFor={`termNames-${i}`}>Term {i + 1} name</Label>
              <Input
                id={`termNames-${i}`}
                name="termNames"
                defaultValue={`Term ${i + 1}`}
              />
            </div>
          ))}
          {state && !state.ok ? <p className="text-sm text-destructive">{state.message}</p> : null}
          <div className="flex justify-end">
            <Submit />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
