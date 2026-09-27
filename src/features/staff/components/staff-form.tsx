"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  createStaffAction,
  updateStaffAction,
  type StaffActionResult,
} from "@/features/staff/actions";

export type StaffFormValues = {
  id?: string;
  fullName: string;
  employeeNumber: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  status: string;
};

function Submit({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  const label = mode === "create" ? "Add staff member" : "Save changes";
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

export function StaffForm({
  mode,
  values,
  onDone,
}: {
  mode: "create" | "edit";
  values?: Partial<StaffFormValues>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const action = mode === "create" ? createStaffAction : updateStaffAction;
  const [state, formAction] = useActionState<StaffActionResult | undefined, FormData>(
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
      {values?.id ? <input type="hidden" name="staffId" value={values.id} /> : null}
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
        <Field name="position" label="Position" error={err("position")}>
          <Input
            id="position"
            name="position"
            placeholder="e.g. Librarian, Accountant"
            defaultValue={v.position ?? ""}
            required
          />
        </Field>
        <Field name="department" label="Department">
          <Input
            id="department"
            name="department"
            placeholder="e.g. Administration"
            defaultValue={v.department ?? ""}
          />
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
