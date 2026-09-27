"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { saveProfileAction, type AdmissionResult } from "@/features/admissions/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Saving…" : "Save profile"}
    </Button>
  );
}

export function ApplicantProfileForm({
  initial,
}: {
  initial: { fullName: string; email: string; phone: string; birthDate: string; gender: string; previousSchool: string };
}) {
  const [state, action] = useActionState<AdmissionResult | null, FormData>(saveProfileAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Profile saved");
      router.refresh();
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4 rounded-xl border border-border p-4">
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" defaultValue={initial.fullName} required maxLength={160} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={initial.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={initial.phone} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birthDate">Date of birth</Label>
          <Input id="birthDate" name="birthDate" type="date" defaultValue={initial.birthDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Input id="gender" name="gender" defaultValue={initial.gender} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="previousSchool">Previous school</Label>
          <Input id="previousSchool" name="previousSchool" defaultValue={initial.previousSchool} />
        </div>
      </div>
      <Submit />
    </form>
  );
}
