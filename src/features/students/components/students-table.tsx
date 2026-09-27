"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";

export type StudentRow = {
  id: string;
  studentNumber: string;
  fullName: string;
  gender: string | null;
  status: string;
  currentClass: string | null;
  academicYear: string | null;
  campus: { id: string; name: string } | null;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") return <Badge variant="success">Active</Badge>;
  if (status === "GRADUATED") return <Badge variant="info">Graduated</Badge>;
  if (status === "TRANSFERRED") return <Badge variant="warning">Transferred</Badge>;
  if (status === "WITHDRAWN") return <Badge variant="neutral">Withdrawn</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

export function StudentsTable({ rows }: { rows: StudentRow[] }) {
  const columns = React.useMemo<ColumnDef<StudentRow, unknown>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "Name",
        cell: ({ row }) => (
          <Link
            href={`/app/students/${row.original.id}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {row.original.fullName}
          </Link>
        ),
      },
      {
        accessorKey: "studentNumber",
        header: "Student no.",
        cell: ({ row }) => <span className="tabular text-sm">{row.original.studentNumber}</span>,
      },
      {
        id: "class",
        header: "Class",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.currentClass ?? <span className="text-muted-foreground">Not enrolled</span>}
          </span>
        ),
      },
      {
        id: "campus",
        header: "Campus",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.campus?.name ?? "-"}
          </span>
        ),
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

  return <DataTable columns={columns} data={rows} emptyMessage="No students match these filters." />;
}
