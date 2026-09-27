"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { createPeriodAction, type AdmissionResult } from "@/features/admissions/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Creating…" : "Create period"}
    </Button>
  );
}

export function CreatePeriodDialog() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<AdmissionResult | null, FormData>(createPeriodAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Admission period created");
      setOpen(false);
      router.refresh();
      if (state.id) router.push(`/app/admissions/periods/${state.id}`);
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden /> New period
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New admission period</DialogTitle>
          <DialogDescription>Define the application window. You can open it when ready.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={160} placeholder="2026/2027 Intake" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} maxLength={1000} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="openAt">Opens</Label>
              <Input id="openAt" name="openAt" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closeAt">Closes</Label>
              <Input id="closeAt" name="closeAt" type="datetime-local" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quota">Total quota (optional)</Label>
            <Input id="quota" name="quota" type="number" min={1} />
          </div>
          <DialogFooter>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
