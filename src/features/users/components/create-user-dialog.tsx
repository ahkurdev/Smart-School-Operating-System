"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createUserAction, type UserActionResult } from "@/features/users/actions";

export type RoleOption = { key: string; name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Creating..." : "Create user"}
    </Button>
  );
}

export function CreateUserDialog({ roles }: { roles: RoleOption[] }) {
  const [open, setOpen] = useState(false);
  const [generate, setGenerate] = useState(false);
  const [state, action] = useActionState<UserActionResult | undefined, FormData>(
    createUserAction,
    undefined,
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "User created");
      if (!state.temporaryPassword) setOpen(false);
    }
  }, [state]);

  const fieldError = (name: string) =>
    state && !state.ok ? state.fieldErrors?.[name]?.[0] : undefined;

  function copyTemp() {
    if (state?.ok && state.temporaryPassword) {
      void navigator.clipboard.writeText(state.temporaryPassword).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setCopied(false);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden /> Add user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a user</DialogTitle>
          <DialogDescription>
            Creates a user account and adds them to this school with the roles you
            choose.
          </DialogDescription>
        </DialogHeader>

        {state?.ok && state.temporaryPassword ? (
          <div className="rounded-md border border-success/30 bg-success/10 p-3">
            <p className="text-sm font-medium">User created</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Share this temporary password securely. It is shown only once.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded bg-surface-sunken px-2 py-1 font-mono text-sm">
                {state.temporaryPassword}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copyTemp}>
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button className="mt-3 w-full" variant="outline" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form action={action} className="space-y-4" noValidate>
            {state && !state.ok ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="cu-name">Full name</Label>
              <Input id="cu-name" name="fullName" required aria-invalid={Boolean(fieldError("fullName"))} />
              {fieldError("fullName") ? (
                <p className="text-sm text-destructive">{fieldError("fullName")}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cu-email">Email</Label>
                <Input id="cu-email" name="email" type="email" aria-invalid={Boolean(fieldError("email"))} />
                {fieldError("email") ? (
                  <p className="text-sm text-destructive">{fieldError("email")}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cu-username">Username (optional)</Label>
                <Input id="cu-username" name="username" autoCapitalize="none" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cu-title">Title (optional)</Label>
              <Input id="cu-title" name="title" placeholder="e.g. Homeroom Teacher" />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Roles</legend>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {roles.map((r) => (
                  <label key={r.key} className="flex items-center gap-2 text-sm">
                    <Checkbox name="roleKeys" value={r.key} />
                    <span>{r.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cu-generate"
                  name="generatePassword"
                  checked={generate}
                  onCheckedChange={(v) => setGenerate(v === true)}
                />
                <Label htmlFor="cu-generate" className="font-normal">
                  Generate a temporary password
                </Label>
              </div>
              {!generate ? (
                <div className="space-y-2">
                  <Label htmlFor="cu-password">Password</Label>
                  <Input id="cu-password" name="password" type="password" autoComplete="new-password" minLength={10} />
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton />
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
