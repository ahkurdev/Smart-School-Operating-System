"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createSubjectAction,
  updateSubjectAction,
  createDepartmentAction,
  type AcademicActionResult,
} from "@/features/academics/actions";

type Option = { id: string; name: string };
export type SubjectFormValues = {
  id?: string;
  code: string;
  name: string;
  credits: number;
  departmentId: string;
  description: string;
  learningObjectives: string;
  isActive: boolean;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function SubjectForm({
  mode,
  values,
  departments,
  onDone,
}: {
  mode: "create" | "edit";
  values?: SubjectFormValues;
  departments: Option[];
  onDone?: () => void;
}) {
  const [state, action] = useActionState<AcademicActionResult | undefined, FormData>(
    mode === "create" ? createSubjectAction : updateSubjectAction,
    undefined,
  );
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Saved");
      onDone?.();
    }
  }, [state, onDone]);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={action} className="space-y-4">
      {values?.id ? <input type="hidden" name="subjectId" value={values.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="code">Code</Label>
          <Input id="code" name="code" defaultValue={values?.code} placeholder="MATH" aria-invalid={!!fe.code} />
          {fe.code ? <p className="text-xs text-destructive">{fe.code[0]}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="credits">Credits / periods</Label>
          <Input id="credits" name="credits" type="number" defaultValue={values?.credits ?? 1} min={0} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={values?.name} placeholder="Mathematics" aria-invalid={!!fe.name} />
        {fe.name ? <p className="text-xs text-destructive">{fe.name[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="departmentId">Department</Label>
        <select
          id="departmentId"
          name="departmentId"
          defaultValue={values?.departmentId ?? ""}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">None</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={values?.description} rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="learningObjectives">Learning objectives</Label>
        <Textarea id="learningObjectives" name="learningObjectives" defaultValue={values?.learningObjectives} rows={2} />
      </div>
      {mode === "edit" ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={values?.isActive ?? true} className="size-4" />
          Active
        </label>
      ) : null}
      {state && !state.ok ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <div className="flex justify-end">
        <Submit label={mode === "create" ? "Create subject" : "Save changes"} />
      </div>
    </form>
  );
}

export function AddSubjectDialog({ departments }: { departments: Option[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden /> New subject
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create subject</DialogTitle>
          <DialogDescription>Subjects are taught in classes and carry assessments.</DialogDescription>
        </DialogHeader>
        <SubjectForm mode="create" departments={departments} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function EditSubjectDialog({ values, departments }: { values: SubjectFormValues; departments: Option[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Pencil className="size-4" aria-hidden />
          <span className="sr-only">Edit {values.name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit subject</DialogTitle>
        </DialogHeader>
        <SubjectForm mode="edit" values={values} departments={departments} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function AddDepartmentDialog() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<AcademicActionResult | undefined, FormData>(
    createDepartmentAction,
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
          <Plus className="size-4" aria-hidden /> Department
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add department</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dept-name">Name</Label>
            <Input id="dept-name" name="name" placeholder="Science" aria-invalid={!!fe.name} />
            {fe.name ? <p className="text-xs text-destructive">{fe.name[0]}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-code">Code</Label>
            <Input id="dept-code" name="code" placeholder="SCI" aria-invalid={!!fe.code} />
            {fe.code ? <p className="text-xs text-destructive">{fe.code[0]}</p> : null}
          </div>
          {state && !state.ok ? <p className="text-sm text-destructive">{state.message}</p> : null}
          <div className="flex justify-end">
            <Submit label="Add department" />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
