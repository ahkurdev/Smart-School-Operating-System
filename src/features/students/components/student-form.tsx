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
  createStudentAction,
  updateStudentAction,
  type StudentActionResult,
} from "@/features/students/actions";

export type StudentFormValues = {
  id?: string;
  fullName: string;
  preferredName: string;
  studentNumber: string;
  nationalId: string;
  gender: string;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  religion: string;
  address: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  email: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalNotes: string;
  specialEdNotes: string;
  campusId: string;
  status: string;
};

export type CampusOption = { id: string; name: string };

function Submit({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  const label = mode === "create" ? "Add student" : "Save changes";
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

export function StudentForm({
  mode,
  values,
  campuses,
  canSeeSensitive,
  onDone,
}: {
  mode: "create" | "edit";
  values?: Partial<StudentFormValues>;
  campuses: CampusOption[];
  canSeeSensitive: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const action = mode === "create" ? createStudentAction : updateStudentAction;
  const [state, formAction] = useActionState<StudentActionResult | undefined, FormData>(
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
      {values?.id ? <input type="hidden" name="studentId" value={values.id} /> : null}
      {state && !state.ok ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field name="fullName" label="Full name" error={err("fullName")}>
          <Input id="fullName" name="fullName" defaultValue={v.fullName ?? ""} required />
        </Field>
        <Field name="preferredName" label="Preferred name">
          <Input id="preferredName" name="preferredName" defaultValue={v.preferredName ?? ""} />
        </Field>
        <Field
          name="studentNumber"
          label="Student number"
          hint="Leave blank to generate automatically."
          error={err("studentNumber")}
        >
          <Input id="studentNumber" name="studentNumber" defaultValue={v.studentNumber ?? ""} className="tabular" />
        </Field>
        <Field name="nationalId" label="National ID (optional)">
          <Input id="nationalId" name="nationalId" defaultValue={v.nationalId ?? ""} className="tabular" />
        </Field>
      </section>

      <Separator />

      <section className="grid gap-4 sm:grid-cols-2">
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
        <Field name="birthDate" label="Date of birth">
          <Input id="birthDate" name="birthDate" type="date" defaultValue={v.birthDate ?? ""} />
        </Field>
        <Field name="birthPlace" label="Place of birth">
          <Input id="birthPlace" name="birthPlace" defaultValue={v.birthPlace ?? ""} />
        </Field>
        <Field name="nationality" label="Nationality">
          <Input id="nationality" name="nationality" defaultValue={v.nationality ?? ""} />
        </Field>
        <Field name="religion" label="Religion (optional)">
          <Input id="religion" name="religion" defaultValue={v.religion ?? ""} />
        </Field>
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
      </section>

      <Separator />

      <section className="grid gap-4 sm:grid-cols-2">
        <Field name="email" label="Email" error={err("email")}>
          <Input id="email" name="email" type="email" defaultValue={v.email ?? ""} />
        </Field>
        <Field name="phone" label="Phone">
          <Input id="phone" name="phone" defaultValue={v.phone ?? ""} />
        </Field>
        <Field name="emergencyContactName" label="Emergency contact name">
          <Input id="emergencyContactName" name="emergencyContactName" defaultValue={v.emergencyContactName ?? ""} />
        </Field>
        <Field name="emergencyContactPhone" label="Emergency contact phone">
          <Input id="emergencyContactPhone" name="emergencyContactPhone" defaultValue={v.emergencyContactPhone ?? ""} />
        </Field>
      </section>

      <Separator />

      <section className="grid gap-4 sm:grid-cols-2">
        <Field name="address" label="Address">
          <Textarea id="address" name="address" defaultValue={v.address ?? ""} rows={2} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field name="city" label="City">
            <Input id="city" name="city" defaultValue={v.city ?? ""} />
          </Field>
          <Field name="region" label="Region / State">
            <Input id="region" name="region" defaultValue={v.region ?? ""} />
          </Field>
          <Field name="country" label="Country">
            <Input id="country" name="country" defaultValue={v.country ?? ""} />
          </Field>
          <Field name="postalCode" label="Postal code">
            <Input id="postalCode" name="postalCode" defaultValue={v.postalCode ?? ""} className="tabular" />
          </Field>
        </div>
      </section>

      {canSeeSensitive ? (
        <>
          <Separator />
          <section className="space-y-4">
            <p className="text-sm font-medium">Restricted notes</p>
            <p className="text-xs text-muted-foreground">
              Visible only to staff with the sensitive-records permission.
            </p>
            <Field name="medicalNotes" label="Medical notes">
              <Textarea id="medicalNotes" name="medicalNotes" defaultValue={v.medicalNotes ?? ""} rows={2} />
            </Field>
            <Field name="specialEdNotes" label="Learning support notes">
              <Textarea id="specialEdNotes" name="specialEdNotes" defaultValue={v.specialEdNotes ?? ""} rows={2} />
            </Field>
          </section>
        </>
      ) : null}

      {mode === "edit" ? (
        <Field name="status" label="Status">
          <select
            id="status"
            name="status"
            defaultValue={v.status ?? "ACTIVE"}
            className="h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="GRADUATED">Graduated</option>
            <option value="TRANSFERRED">Transferred</option>
            <option value="WITHDRAWN">Withdrawn</option>
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
