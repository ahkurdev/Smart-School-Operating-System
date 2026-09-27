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
  createGuardianAction,
  updateGuardianAction,
  type GuardianActionResult,
} from "@/features/guardians/actions";

export type GuardianFormValues = {
  id?: string;
  fullName: string;
  relationship: string;
  nationalId: string;
  occupation: string;
  phone: string;
  email: string;
  address: string;
};

function Submit({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  const label = mode === "create" ? "Add guardian" : "Save changes";
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
}: {
  name: string;
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function GuardianForm({
  mode,
  values,
  onDone,
}: {
  mode: "create" | "edit";
  values?: Partial<GuardianFormValues>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const action = mode === "create" ? createGuardianAction : updateGuardianAction;
  const [state, formAction] = useActionState<GuardianActionResult | undefined, FormData>(
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
      {values?.id ? <input type="hidden" name="guardianId" value={values.id} /> : null}
      {state && !state.ok ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field name="fullName" label="Full name" error={err("fullName")}>
          <Input id="fullName" name="fullName" defaultValue={v.fullName ?? ""} required />
        </Field>
        <Field name="relationship" label="Relationship" error={err("relationship")}>
          <Input
            id="relationship"
            name="relationship"
            placeholder="e.g. Mother, Father, Uncle"
            defaultValue={v.relationship ?? ""}
            required
          />
        </Field>
        <Field name="nationalId" label="National ID (optional)">
          <Input id="nationalId" name="nationalId" defaultValue={v.nationalId ?? ""} className="tabular" />
        </Field>
        <Field name="occupation" label="Occupation">
          <Input id="occupation" name="occupation" defaultValue={v.occupation ?? ""} />
        </Field>
      </section>

      <Separator />

      <section className="grid gap-4 sm:grid-cols-2">
        <Field name="phone" label="Phone">
          <Input id="phone" name="phone" defaultValue={v.phone ?? ""} />
        </Field>
        <Field name="email" label="Email" error={err("email")}>
          <Input id="email" name="email" type="email" defaultValue={v.email ?? ""} />
        </Field>
      </section>

      <Field name="address" label="Address">
        <Textarea id="address" name="address" defaultValue={v.address ?? ""} rows={2} />
      </Field>

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
