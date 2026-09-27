"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  updateUserAction,
  setUserRolesAction,
  resetUserPasswordAction,
  type UserActionResult,
} from "@/features/users/actions";

function SaveButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function UserManagePanel({
  membershipId,
  fullName,
  preferredName,
  email,
  username,
  phone,
  title,
  roles,
  selectedRoles,
  canResetPassword,
}: {
  membershipId: string;
  fullName: string;
  preferredName: string;
  email: string;
  username: string;
  phone: string;
  title: string;
  roles: { key: string; name: string }[];
  selectedRoles: string[];
  membershipStatus: string;
  canResetPassword: boolean;
}) {
  const [state, action] = useActionState<UserActionResult | undefined, FormData>(
    updateUserAction,
    undefined,
  );
  const [roleKeys, setRoleKeys] = useState<string[]>(selectedRoles);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Saved");
    else if (state && !state.ok) toast.error(state.message);
  }, [state]);

  const fieldError = (name: string) =>
    state && !state.ok ? state.fieldErrors?.[name]?.[0] : undefined;

  function toggleRole(key: string, checked: boolean) {
    setRoleKeys((prev) => (checked ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)));
  }

  function saveRoles() {
    startTransition(async () => {
      const res = await setUserRolesAction(membershipId, roleKeys);
      if (res.ok) toast.success(res.message ?? "Roles updated");
      else toast.error(res.message);
    });
  }

  function resetPassword() {
    startTransition(async () => {
      const res = await resetUserPasswordAction(membershipId);
      if (res.ok) {
        toast.success("Password reset", {
          description: res.temporaryPassword ? `Temporary password: ${res.temporaryPassword}` : undefined,
        });
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Update the user&apos;s details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4" noValidate>
            <input type="hidden" name="membershipId" value={membershipId} />
            {state && !state.ok ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="u-name">Full name</Label>
                <Input id="u-name" name="fullName" defaultValue={fullName} required />
                {fieldError("fullName") ? (
                  <p className="text-sm text-destructive">{fieldError("fullName")}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-preferred">Preferred name</Label>
                <Input id="u-preferred" name="preferredName" defaultValue={preferredName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-email">Email</Label>
                <Input id="u-email" name="email" type="email" defaultValue={email} />
                {fieldError("email") ? (
                  <p className="text-sm text-destructive">{fieldError("email")}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-username">Username</Label>
                <Input id="u-username" name="username" defaultValue={username} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-phone">Phone</Label>
                <Input id="u-phone" name="phone" defaultValue={phone} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-title">Title</Label>
                <Input id="u-title" name="title" defaultValue={title} />
              </div>
            </div>
            <SaveButton label="Save changes" pendingLabel="Saving..." />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roles</CardTitle>
          <CardDescription>
            Roles decide what this user can see and do in this school.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <legend className="sr-only">Assign roles</legend>
            {roles.map((r) => (
              <label key={r.key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={roleKeys.includes(r.key)}
                  onCheckedChange={(v) => toggleRole(r.key, v === true)}
                />
                <span>{r.name}</span>
              </label>
            ))}
          </fieldset>
          <Button onClick={saveRoles} disabled={pending} type="button">
            {pending ? "Saving..." : "Save roles"}
          </Button>
        </CardContent>
      </Card>

      {canResetPassword ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Access</CardTitle>
            <CardDescription>
              Resetting the password signs the user out of all devices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <Button variant="outline" onClick={resetPassword} disabled={pending} type="button">
              <KeyRound className="size-4" aria-hidden /> Reset password
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
