"use client";

import { useState, useTransition } from "react";
import { Pencil, Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  GuardianForm,
  type GuardianFormValues,
} from "@/features/guardians/components/guardian-form";
import { archiveGuardianAction } from "@/features/guardians/actions";

export function EditGuardianDialog({
  values,
  canArchive = false,
}: {
  values: GuardianFormValues;
  canArchive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function archive() {
    startTransition(async () => {
      const res = await archiveGuardianAction(values.id ?? "");
      if (res.ok) toast.success(res.message ?? "Archived");
      else toast.error(res.message);
    });
  }

  return (
    <div className="flex gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Pencil className="size-4" aria-hidden /> Edit
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit guardian</DialogTitle>
          </DialogHeader>
          <GuardianForm mode="edit" values={values} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      {canArchive ? (
        <Button size="sm" variant="ghost" onClick={archive} disabled={pending}>
          <Archive className="size-4" aria-hidden /> Archive
        </Button>
      ) : null}
    </div>
  );
}
