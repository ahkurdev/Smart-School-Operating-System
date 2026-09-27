"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";

export type GuardianRow = {
  id: string;
  fullName: string;
  relationship: string;
  occupation: string | null;
  phone: string | null;
  email: string | null;
  studentCount: number;
  linkedStudents: { id: string; fullName: string; isPrimary: boolean }[];
};

export function GuardiansTable({ rows }: { rows: GuardianRow[] }) {
  const columns = React.useMemo<ColumnDef<GuardianRow, unknown>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "Name",
        cell: ({ row }) => (
          <Link
            href={`/app/guardians/${row.original.id}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {row.original.fullName}
          </Link>
        ),
      },
      {
        accessorKey: "relationship",
        header: "Relationship",
        cell: ({ row }) => <span className="text-sm">{row.original.relationship}</span>,
      },
      {
        id: "contact",
        header: "Contact",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.phone ?? row.original.email ?? "-"}
          </span>
        ),
      },
      {
        id: "occupation",
        header: "Occupation",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.occupation ?? "-"}</span>
        ),
      },
      {
        id: "students",
        header: "Students",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1">
            {row.original.linkedStudents.length === 0 ? (
              <span className="text-sm text-muted-foreground">None</span>
            ) : (
              row.original.linkedStudents.slice(0, 3).map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 text-sm">
                  {s.fullName}
                  {s.isPrimary ? <Badge variant="success">Primary</Badge> : null}
                </span>
              ))
            )}
            {row.original.linkedStudents.length > 3 ? (
              <span className="text-xs text-muted-foreground">
                +{row.original.linkedStudents.length - 3} more
              </span>
            ) : null}
          </div>
        ),
      },
    ],
    [],
  );

  return <DataTable columns={columns} data={rows} emptyMessage="No guardians match these filters." />;
}
