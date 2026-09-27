"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  createTeacherAction,
  updateTeacherAction,
  type TeacherActionResult,
} from "@/features/teachers/actions";

export type TeacherFormValues = {
  id?: string;
  fullName: string;
  employeeNumber: string;
  gender: string;
  qualification: string;
  specialization: string;
  employmentType: string;
  joinDate: string;
  exitDate: string;
  email: string;
  phone: string;
  address: string;
  campusId: string;
  departmentId: string;
  status: string;
};

export type CampusOption = { id: string; name: string };
export type DepartmentOption = { id: string; name: string };

function Submit({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  const label = mode === "create" ? "Add teacher" : "Save changes";
  const pendingLabel = mode === "create" ? "Adding..." : "Saving...";
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function Field({
  name,
  label,
  children,
  error,
  hint,
}: {
  name: string;
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function TeacherForm({
  mode,
  values,
  campuses,
  departments,
  onDone,
}: {
  mode: "create" | "edit";
  values?: Partial<TeacherFormValues>;
  campuses: CampusOption[];
  departments: DepartmentOption[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const action = mode === "create" ? createTeacherAction : updateTeacherAction;
  const [state, formAction] = useActionState<TeacherActionResult | undefined, FormData>(
    action,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Saved");
      onDone?.();
      router.refresh();
    }
  }, [state, onDone, router]);

  const err = (name: string) =>
    state && !state.ok ? state.fieldErrors?.[name]?.[0] : undefined;
  const v = values ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {values?.id ? <input type="hidden" name="teacherId" value={values.id} /> : null}
      {state && !state.ok ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field name="fullName" label="Full name" error={err("fullName")}>
          <Input id="fullName" name="fullName" defaultValue={v.fullName ?? ""} required />
        </Field>
        <Field
          name="employeeNumber"
          label="Employee number"
          hint="Leave blank to generate automatically."
          error={err("employeeNumber")}
        >
          <Input
            id="employeeNumber"
            name="employeeNumber"
            defaultValue={v.employeeNumber ?? ""}
            className="tabular"
          />
        </Field>
        <Field name="gender" label="Gender">
          <select
            id="gender"
            name="gender"
            defaultValue={v.gender ?? ""}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Not specified</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field name="employmentType" label="Employment type">
          <select
            id="employmentType"
            name="employmentType"
            defaultValue={v.employmentType ?? "FULL_TIME"}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="FULL_TIME">Full time</option>
            <option value="PART_TIME">Part time</option>
            <option value="CONTRACT">Contract</option>
            <option value="VOLUNTEER">Volunteer</option>
            <option value="SUBSTITUTE">Substitute</option>
          </select>
        </Field>
        <Field name="qualification" label="Qualification">
          <Input
            id="qualification"
            name="qualification"
            placeholder="e.g. M.Ed., B.Sc."
            defaultValue={v.qualification ?? ""}
          />
        </Field>
        <Field name="specialization" label="Specialization">
          <Input
            id="specialization"
            name="specialization"
            placeholder="e.g. Mathematics"
            defaultValue={v.specialization ?? ""}
          />
        </Field>
      </section>

      <Separator />

      <section className="grid gap-4 sm:grid-cols-2">
        {campuses.length > 0 ? (
          <Field name="campusId" label="Campus">
            <select
              id="campusId"
              name="campusId"
              defaultValue={v.campusId ?? ""}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">No campus</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {departments.length > 0 ? (
          <Field name="departmentId" label="Department">
            <select
              id="departmentId"
              name="departmentId"
              defaultValue={v.departmentId ?? ""}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field name="joinDate" label="Join date">
          <Input id="joinDate" name="joinDate" type="date" defaultValue={v.joinDate ?? ""} />
        </Field>
        <Field name="exitDate" label="Exit date">
          <Input id="exitDate" name="exitDate" type="date" defaultValue={v.exitDate ?? ""} />
        </Field>
      </section>

      <Separator />

      <section className="grid gap-4 sm:grid-cols-2">
        <Field name="email" label="Email" error={err("email")}>
          <Input id="email" name="email" type="email" defaultValue={v.email ?? ""} />
        </Field>
        <Field name="phone" label="Phone">
          <Input id="phone" name="phone" defaultValue={v.phone ?? ""} />
        </Field>
      </section>

      <Field name="address" label="Address">
        <Textarea id="address" name="address" defaultValue={v.address ?? ""} rows={2} />
      </Field>

      {mode === "edit" ? (
        <Field name="status" label="Status">
          <select
            id="status"
            name="status"
            defaultValue={v.status ?? "ACTIVE"}
            className="h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On leave</option>
            <option value="INACTIVE">Inactive</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </Field>
      ) : null}

      <div className="flex gap-2">
        <Submit mode={mode} />
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
