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
import { createClassAction, updateClassAction, type AcademicActionResult } from "@/features/academics/actions";

type Option = { id: string; name: string };
export type ClassFormValues = {
  id?: string;
  name: string;
  code: string;
  academicYearId: string;
  gradeLevelId: string;
  campusId: string;
  stream: string;
  capacity: number;
  homeroomTeacherId: string;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  type = "text",
  errors,
}: {
  name: string;
  label: string;
  defaultValue?: string | number;
  placeholder?: string;
  type?: string;
  errors?: Record<string, string[]>;
}) {
  const err = errors?.[name];
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={!!err}
      />
      {err ? <p className="text-xs text-destructive">{err[0]}</p> : null}
    </div>
  );
}

function Select({
  name,
  label,
  options,
  defaultValue,
  includeBlank,
}: {
  name: string;
  label: string;
  options: Option[];
  defaultValue?: string;
  includeBlank?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
      >
        {includeBlank ? <option value="">{includeBlank}</option> : null}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ClassForm({
  mode,
  values,
  academicYears,
  gradeLevels,
  campuses,
  onDone,
}: {
  mode: "create" | "edit";
  values?: ClassFormValues;
  academicYears: Option[];
  gradeLevels: Option[];
  campuses: Option[];
  onDone?: () => void;
}) {
  const [state, action] = useActionState<AcademicActionResult | undefined, FormData>(
    mode === "create" ? createClassAction : updateClassAction,
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
      {values?.id ? <input type="hidden" name="classId" value={values.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Class name" defaultValue={values?.name} placeholder="Grade 10 A" errors={fe} />
        <Field name="code" label="Class code" defaultValue={values?.code} placeholder="10A" errors={fe} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="academicYearId" label="Academic year" options={academicYears} defaultValue={values?.academicYearId} includeBlank="None" />
        <Select name="gradeLevelId" label="Grade level" options={gradeLevels} defaultValue={values?.gradeLevelId} includeBlank="None" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="campusId" label="Campus" options={campuses} defaultValue={values?.campusId} includeBlank="None" />
        <Field name="stream" label="Stream / major" defaultValue={values?.stream} placeholder="Science (optional)" errors={fe} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="capacity" label="Capacity" type="number" defaultValue={values?.capacity ?? 30} errors={fe} />
        <Field name="homeroomTeacherId" label="Homeroom teacher ID" defaultValue={values?.homeroomTeacherId} placeholder="Optional" errors={fe} />
      </div>
      {state && !state.ok ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <div className="flex justify-end">
        <Submit label={mode === "create" ? "Create class" : "Save changes"} />
      </div>
    </form>
  );
}

export function AddClassDialog(props: {
  academicYears: Option[];
  gradeLevels: Option[];
  campuses: Option[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden /> New class
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create class</DialogTitle>
          <DialogDescription>Classes belong to a grade level within an academic year.</DialogDescription>
        </DialogHeader>
        <ClassForm mode="create" {...props} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
