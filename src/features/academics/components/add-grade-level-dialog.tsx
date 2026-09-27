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
import { createGradeLevelAction, type AcademicActionResult } from "@/features/academics/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? "Adding…" : "Add grade level"}
    </Button>
  );
}

export function AddGradeLevelDialog() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<AcademicActionResult | undefined, FormData>(
    createGradeLevelAction,
    undefined,
  );
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Added");
      setOpen(false);
    }
  }, [state]);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="size-4" aria-hidden /> Grade level
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add grade level</DialogTitle>
          <DialogDescription>A grade level groups classes (e.g. Grade 10, Year 7).</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gl-name">Name</Label>
            <Input id="gl-name" name="name" placeholder="Grade 10" aria-invalid={!!fe.name} />
            {fe.name ? <p className="text-xs text-destructive">{fe.name[0]}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gl-code">Code</Label>
              <Input id="gl-code" name="code" placeholder="G10" aria-invalid={!!fe.code} />
              {fe.code ? <p className="text-xs text-destructive">{fe.code[0]}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gl-seq">Order</Label>
              <Input id="gl-seq" name="sequence" type="number" defaultValue={10} aria-invalid={!!fe.sequence} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gl-stage">Stage (optional)</Label>
            <Input id="gl-stage" name="stage" placeholder="Secondary" />
          </div>
          {state && !state.ok ? <p className="text-sm text-destructive">{state.message}</p> : null}
          <div className="flex justify-end">
            <Submit />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
