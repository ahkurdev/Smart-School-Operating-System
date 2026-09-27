"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, KeyRound, UserCog } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  resetUserPasswordAction,
  setUserStatusAction,
} from "@/features/users/actions";

export type UserRow = {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string | null;
  username: string | null;
  title: string | null;
  userStatus: string;
  membershipStatus: string;
  roles: { key: string; name: string }[];
  lastLoginAt: Date | null;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") return <Badge variant="success">Active</Badge>;
  if (status === "INVITED") return <Badge variant="info">Invited</Badge>;
  return <Badge variant="neutral">Inactive</Badge>;
}

export function UsersTable({ rows, canManage }: { rows: UserRow[]; canManage: boolean }) {
  const [pending, startTransition] = React.useTransition();

  const onReset = React.useCallback(
    (membershipId: string) => {
      startTransition(async () => {
        const res = await resetUserPasswordAction(membershipId);
        if (res.ok) {
          toast.success("Password reset", {
            description: res.temporaryPassword
              ? `Temporary password: ${res.temporaryPassword}`
              : undefined,
          });
        } else {
          toast.error(res.message);
        }
      });
    },
    [],
  );

  const onToggleStatus = React.useCallback(
    (membershipId: string, next: "ACTIVE" | "INACTIVE") => {
      startTransition(async () => {
        const res = await setUserStatusAction(membershipId, next);
        if (res.ok) toast.success(res.message ?? "Updated");
        else toast.error(res.message);
      });
    },
    [],
  );

  const columns = React.useMemo<ColumnDef<UserRow, unknown>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "Name",
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`/app/users/${row.original.membershipId}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {row.original.fullName}
            </Link>
            {row.original.title ? (
              <p className="truncate text-xs text-muted-foreground">{row.original.title}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.email ?? row.original.username ?? "-"}
          </span>
        ),
      },
      {
        id: "roles",
        header: "Roles",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.roles.length > 0 ? (
              row.original.roles.map((r) => (
                <Badge key={r.key} variant="outline" className="capitalize">
                  {r.name}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No role</span>
            )}
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => <StatusBadge status={row.original.membershipStatus} />,
      },
      {
        id: "lastLogin",
        header: "Last sign-in",
        accessorFn: (r) => r.lastLoginAt,
        cell: ({ row }) => (
          <span className="tabular text-xs text-muted-foreground">
            {row.original.lastLoginAt
              ? new Date(row.original.lastLoginAt).toLocaleDateString()
              : "Never"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-right">
            {canManage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Actions for ${row.original.fullName}`}>
                    <MoreHorizontal className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/app/users/${row.original.membershipId}`}>
                      <UserCog className="size-4" aria-hidden /> Manage
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={pending}
                    onSelect={() => onReset(row.original.membershipId)}
                  >
                    <KeyRound className="size-4" aria-hidden /> Reset password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {row.original.membershipStatus === "ACTIVE" ? (
                    <DropdownMenuItem
                      disabled={pending}
                      onSelect={() => onToggleStatus(row.original.membershipId, "INACTIVE")}
                    >
                      Deactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      disabled={pending}
                      onSelect={() => onToggleStatus(row.original.membershipId, "ACTIVE")}
                    >
                      Reactivate
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        ),
      },
    ],
    [canManage, onReset, onToggleStatus, pending],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No users match these filters."
    />
  );
}
