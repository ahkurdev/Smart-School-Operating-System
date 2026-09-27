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
import { StudentForm, type CampusOption, type StudentFormValues } from "@/features/students/components/student-form";
import { archiveStudentAction } from "@/features/students/actions";

export function EditStudentDialog({
  values,
  campuses,
  canSeeSensitive,
  canArchive,
}: {
  values: StudentFormValues;
  campuses: CampusOption[];
  canSeeSensitive: boolean;
  canArchive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function archive() {
    startTransition(async () => {
      const res = await archiveStudentAction(values.id ?? "");
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
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit student</DialogTitle>
          </DialogHeader>
          <StudentForm
            mode="edit"
            values={values}
            campuses={campuses}
            canSeeSensitive={canSeeSensitive}
            onDone={() => setOpen(false)}
          />
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
