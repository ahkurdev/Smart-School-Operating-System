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
import {
  TeacherForm,
  type CampusOption,
  type DepartmentOption,
} from "@/features/teachers/components/teacher-form";

export function AddTeacherDialog({
  campuses,
  departments,
}: {
  campuses: CampusOption[];
  departments: DepartmentOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden /> Add teacher
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a teacher</DialogTitle>
          <DialogDescription>
            Create the teacher record. Subject assignments and a login account can be
            added afterwards.
          </DialogDescription>
        </DialogHeader>
        <TeacherForm
          mode="create"
          campuses={campuses}
          departments={departments}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
