"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deleteRoleAction,
  updateRolePermissionsAction,
  type RoleActionResult,
} from "@/features/roles/actions";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

export type RoleView = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: Permission[];
};

export type PermissionGroup = { subject: string; permissions: Permission[] };

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

export function RoleCard({
  role,
  groups,
  canManage,
}: {
  role: RoleView;
  groups: PermissionGroup[];
  canManage: boolean;
}) {
  const [state, action] = useActionState<RoleActionResult | undefined, FormData>(
    updateRolePermissionsAction,
    undefined,
  );
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Saved");
    else if (state && !state.ok) toast.error(state.message);
  }, [state]);

  // Roles with "*" (all) show every permission checked and cannot be trimmed here.
  const grantsAll = role.permissions.length >= Object.keys(PERMISSIONS).length;

  const onDelete = () => {
    startTransition(async () => {
      const res = await deleteRoleAction(role.id);
      if (res.ok) toast.success(res.message ?? "Deleted");
      else toast.error(res.message);
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{role.name}</CardTitle>
              {role.isSystem ? <Badge variant="neutral">Built-in</Badge> : null}
            </div>
            <CardDescription>
              {role.description ?? "No description."} · {role.userCount}{" "}
              {role.userCount === 1 ? "user" : "users"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {canManage ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
              >
                <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                Permissions
              </Button>
            ) : null}
            {canManage && !role.isSystem ? (
              <Button variant="ghost" size="sm" type="button" onClick={onDelete} disabled={pending}>
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {open ? (
        <CardContent>
          <form action={action} className="space-y-4">
            <input type="hidden" name="roleId" value={role.id} />
            {state && !state.ok ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {groups.map((g) => (
                <fieldset key={g.subject} className="rounded-md border border-border p-3">
                  <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {g.subject}
                  </legend>
                  <div className="space-y-1.5 pt-1">
                    {g.permissions.map((p) => (
                      <label key={p} className="flex items-start gap-2 text-sm">
                        <Checkbox
                          name="permissions"
                          value={p}
                          defaultChecked={grantsAll || role.permissions.includes(p)}
                        />
                        <span className="min-w-0">
                          <span className="font-mono text-xs">{p}</span>
                          <span className="block text-xs text-muted-foreground">
                            {PERMISSIONS[p]}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <SaveButton label="Save permissions" />
          </form>
        </CardContent>
      ) : null}
    </Card>
  );
}
