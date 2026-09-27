"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
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
import { createRoleAction, type RoleActionResult } from "@/features/roles/actions";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import type { PermissionGroup } from "@/features/roles/components/role-card";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Creating..." : "Create role"}
    </Button>
  );
}

export function CreateRoleDialog({ groups }: { groups: PermissionGroup[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<RoleActionResult | undefined, FormData>(
    createRoleAction,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Role created");
      setOpen(false);
    }
  }, [state]);

  const fieldError = (name: string) =>
    state && !state.ok ? state.fieldErrors?.[name]?.[0] : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden /> New role
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a role</DialogTitle>
          <DialogDescription>
            Define a custom role and choose what it may do in this school.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4" noValidate>
          {state && !state.ok ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cr-name">Name</Label>
              <Input id="cr-name" name="name" required />
              {fieldError("name") ? (
                <p className="text-sm text-destructive">{fieldError("name")}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr-key">Key</Label>
              <Input id="cr-key" name="key" placeholder="e.g. lab_assistant" required className="font-mono" />
              {fieldError("key") ? (
                <p className="text-sm text-destructive">{fieldError("key")}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cr-desc">Description</Label>
            <Input id="cr-desc" name="description" />
          </div>

          <div className="grid max-h-72 gap-4 overflow-y-auto sm:grid-cols-2">
            {groups.map((g) => (
              <fieldset key={g.subject} className="rounded-md border border-border p-3">
                <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {g.subject}
                </legend>
                <div className="space-y-1.5 pt-1">
                  {g.permissions.map((p: Permission) => (
                    <label key={p} className="flex items-start gap-2 text-sm">
                      <Checkbox name="permissions" value={p} />
                      <span className="min-w-0">
                        <span className="font-mono text-xs">{p}</span>
                        <span className="block text-xs text-muted-foreground">{PERMISSIONS[p]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
