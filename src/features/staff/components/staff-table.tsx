"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Archive } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StaffForm, type StaffFormValues } from "@/features/staff/components/staff-form";
import { archiveStaffAction } from "@/features/staff/actions";

export type StaffRow = {
  id: string;
  employeeNumber: string;
  fullName: string;
  position: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  hasAccount: boolean;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") return <Badge variant="success">Active</Badge>;
  if (status === "ON_LEAVE") return <Badge variant="warning">On leave</Badge>;
  if (status === "TERMINATED") return <Badge variant="neutral">Terminated</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

function RowActions({
  row,
  canManage,
}: {
  row: StaffRow;
  canManage: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const values: StaffFormValues = {
    id: row.id,
    fullName: row.fullName,
    employeeNumber: row.employeeNumber,
    position: row.position,
    department: row.department ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    status: row.status,
  };

  function archive() {
    startTransition(async () => {
      const res = await archiveStaffAction(row.id);
      if (res.ok) toast.success(res.message ?? "Archived");
      else toast.error(res.message);
    });
  }

  if (!canManage) return null;

  return (
    <div className="flex gap-1.5">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" aria-label={`Edit ${row.fullName}`}>
            <Pencil className="size-4" aria-hidden />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit staff member</DialogTitle>
          </DialogHeader>
          <StaffForm mode="edit" values={values} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <Button size="sm" variant="ghost" onClick={archive} disabled={pending}>
        <Archive className="size-4" aria-hidden /> Archive
      </Button>
    </div>
  );
}

export function StaffTable({ rows, canManage }: { rows: StaffRow[]; canManage: boolean }) {
  const columns = React.useMemo<ColumnDef<StaffRow, unknown>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "Name",
        cell: ({ row }) => <span className="font-medium">{row.original.fullName}</span>,
      },
      {
        accessorKey: "employeeNumber",
        header: "Employee no.",
        cell: ({ row }) => <span className="tabular text-sm">{row.original.employeeNumber}</span>,
      },
      {
        accessorKey: "position",
        header: "Position",
        cell: ({ row }) => <span className="text-sm">{row.original.position}</span>,
      },
      {
        id: "department",
        header: "Department",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.department ?? "-"}</span>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.email ?? row.original.phone ?? "-"}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => <RowActions row={row.original} canManage={canManage} />,
      },
    ],
    [canManage],
  );

  return <DataTable columns={columns} data={rows} emptyMessage="No staff match these filters." />;
}
