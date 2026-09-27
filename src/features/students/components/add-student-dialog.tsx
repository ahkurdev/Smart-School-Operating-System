"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StudentForm, type CampusOption } from "@/features/students/components/student-form";

export function AddStudentDialog({
  campuses,
  canSeeSensitive,
}: {
  campuses: CampusOption[];
  canSeeSensitive: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden /> Add student
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a student</DialogTitle>
          <DialogDescription>
            Create the student record. Enrollment, guardians, and accounts can be
            added afterwards.
          </DialogDescription>
        </DialogHeader>
        <StudentForm
          mode="create"
          campuses={campuses}
          canSeeSensitive={canSeeSensitive}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
