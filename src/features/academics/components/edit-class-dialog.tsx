"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClassForm, type ClassFormValues } from "@/features/academics/components/class-form";

type Option = { id: string; name: string };

export function EditClassDialog({
  values,
  academicYears,
  gradeLevels,
  campuses,
}: {
  values: ClassFormValues;
  academicYears: Option[];
  gradeLevels: Option[];
  campuses: Option[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="size-4" aria-hidden /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit class</DialogTitle>
        </DialogHeader>
        <ClassForm
          mode="edit"
          values={values}
          academicYears={academicYears}
          gradeLevels={gradeLevels}
          campuses={campuses}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
