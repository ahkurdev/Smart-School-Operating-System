"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";

export type TeacherRow = {
  id: string;
  employeeNumber: string;
  fullName: string;
  status: string;
  employmentType: string;
  specialization: string | null;
  department: { id: string; name: string } | null;
  campus: { id: string; name: string } | null;
  assignmentCount: number;
  homeroomCount: number;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") return <Badge variant="success">Active</Badge>;
  if (status === "ON_LEAVE") return <Badge variant="warning">On leave</Badge>;
  if (status === "TERMINATED") return <Badge variant="neutral">Terminated</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

function EmploymentBadge({ type }: { type: string }) {
  const label = type.replace(/_/g, " ").toLowerCase();
  if (type === "FULL_TIME") return <span className="text-sm text-muted-foreground">Full time</span>;
  if (type === "PART_TIME") return <span className="text-sm text-muted-foreground">Part time</span>;
  return <Badge variant="outline">{label}</Badge>;
}

export function TeachersTable({ rows }: { rows: TeacherRow[] }) {
  const columns = React.useMemo<ColumnDef<TeacherRow, unknown>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "Name",
        cell: ({ row }) => (
          <Link
            href={`/app/teachers/${row.original.id}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {row.original.fullName}
          </Link>
        ),
      },
      {
        accessorKey: "employeeNumber",
        header: "Employee no.",
        cell: ({ row }) => <span className="tabular text-sm">{row.original.employeeNumber}</span>,
      },
      {
        id: "department",
        header: "Department",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.department?.name ?? (
              <span className="text-muted-foreground">Unassigned</span>
            )}
          </span>
        ),
      },
      {
        id: "load",
        header: "Teaching load",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.assignmentCount} subject{row.original.assignmentCount === 1 ? "" : "s"}
            {row.original.homeroomCount > 0
              ? ` · ${row.original.homeroomCount} homeroom`
              : ""}
          </span>
        ),
      },
      {
        id: "employmentType",
        header: "Employment",
        enableSorting: false,
        cell: ({ row }) => <EmploymentBadge type={row.original.employmentType} />,
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [],
  );

  return <DataTable columns={columns} data={rows} emptyMessage="No teachers match these filters." />;
}
