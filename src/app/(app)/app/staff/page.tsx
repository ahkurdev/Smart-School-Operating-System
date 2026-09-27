import type { Metadata } from "next";
import { Briefcase } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { listStaff, type StaffStatusFilter } from "@/server/services/staff.service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/shared/pagination";
import { StaffTable, type StaffRow } from "@/features/staff/components/staff-table";
import { AddStaffDialog } from "@/features/staff/components/add-staff-dialog";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const actor = await requirePageActor("staff.read");
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const result = await listStaff(actor, {
    search: sp.q,
    status: (sp.status as StaffStatusFilter) || undefined,
    page,
    pageSize: 20,
  });

  const rows: StaffRow[] = result.items.map((s) => ({
    id: s.id,
    employeeNumber: s.employeeNumber,
    fullName: s.fullName,
    position: s.position,
    department: s.department,
    email: s.email,
    phone: s.phone,
    status: s.status,
    hasAccount: s.hasAccount,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Staff"
        description="Non-teaching staff: administration, finance, library, and support."
        actions={can(actor, "staff.manage") ? <AddStaffDialog /> : null}
      />

      <form className="flex flex-wrap items-end gap-2" action="/app/staff" method="get">
        <div className="max-w-xs flex-1">
          <label htmlFor="q" className="sr-only">
            Search staff
          </label>
          <Input
            id="q"
            name="q"
            placeholder="Search by name, number, or position"
            defaultValue={sp.q ?? ""}
          />
        </div>
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={sp.status ?? ""}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_LEAVE">On leave</option>
          <option value="INACTIVE">Inactive</option>
          <option value="TERMINATED">Terminated</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Briefcase />}
          title="No staff found"
          description={
            sp.q || sp.status
              ? "No staff match these filters. Try clearing the search."
              : "Add your first staff member to start building the staff directory."
          }
        />
      ) : (
        <>
          <StaffTable rows={rows} canManage={can(actor, "staff.manage")} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            basePath="/app/staff"
            params={{ q: sp.q, status: sp.status }}
            noun="staff member"
          />
        </>
      )}
    </div>
  );
}
