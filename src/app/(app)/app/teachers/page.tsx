import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import {
  listTeachers,
  type TeacherStatusFilter,
  type TeacherEmploymentType,
} from "@/server/services/teacher.service";
import { listCampuses } from "@/server/services/tenant.service";
import { listDepartments } from "@/server/services/academic.service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/shared/pagination";
import { TeachersTable, type TeacherRow } from "@/features/teachers/components/teachers-table";
import { AddTeacherDialog } from "@/features/teachers/components/add-teacher-dialog";

export const metadata: Metadata = { title: "Teachers" };

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    status?: string;
    employmentType?: string;
    campusId?: string;
    departmentId?: string;
  }>;
}) {
  const actor = await requirePageActor("teacher.read");
  const tenantId = requireTenantId(actor);
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const [result, campuses, departments] = await Promise.all([
    listTeachers(actor, {
      search: sp.q,
      status: (sp.status as TeacherStatusFilter) || undefined,
      employmentType: (sp.employmentType as TeacherEmploymentType) || undefined,
      campusId: sp.campusId,
      departmentId: sp.departmentId,
      page,
      pageSize: 20,
    }),
    listCampuses(tenantId),
    listDepartments(actor).catch(() => []),
  ]);

  const rows: TeacherRow[] = result.items.map((t) => ({
    id: t.id,
    employeeNumber: t.employeeNumber,
    fullName: t.fullName,
    status: t.status,
    employmentType: t.employmentType,
    specialization: t.specialization,
    department: t.department,
    campus: t.campus,
    assignmentCount: t.assignmentCount,
    homeroomCount: t.homeroomCount,
  }));

  const campusOptions = campuses.map((c) => ({ id: c.id, name: c.name }));
  const departmentOptions = departments.map((d) => ({ id: d.id, name: d.name }));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Teachers"
        description="Teaching staff, their department, employment type, and teaching load."
        actions={
          can(actor, "teacher.create") ? (
            <AddTeacherDialog campuses={campusOptions} departments={departmentOptions} />
          ) : null
        }
      />

      <form className="flex flex-wrap items-end gap-2" action="/app/teachers" method="get">
        <div className="max-w-xs flex-1">
          <label htmlFor="q" className="sr-only">
            Search teachers
          </label>
          <Input
            id="q"
            name="q"
            placeholder="Search by name, number, or email"
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
        <label htmlFor="employmentType" className="sr-only">
          Employment type
        </label>
        <select
          id="employmentType"
          name="employmentType"
          defaultValue={sp.employmentType ?? ""}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">All types</option>
          <option value="FULL_TIME">Full time</option>
          <option value="PART_TIME">Part time</option>
          <option value="CONTRACT">Contract</option>
          <option value="VOLUNTEER">Volunteer</option>
          <option value="SUBSTITUTE">Substitute</option>
        </select>
        {departments.length > 0 ? (
          <>
            <label htmlFor="departmentId" className="sr-only">
              Department
            </label>
            <select
              id="departmentId"
              name="departmentId"
              defaultValue={sp.departmentId ?? ""}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
        {campuses.length > 1 ? (
          <>
            <label htmlFor="campusId" className="sr-only">
              Campus
            </label>
            <select
              id="campusId"
              name="campusId"
              defaultValue={sp.campusId ?? ""}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All campuses</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<GraduationCap />}
          title="No teachers found"
          description={
            sp.q || sp.status || sp.employmentType || sp.departmentId || sp.campusId
              ? "No teachers match these filters. Try clearing the search."
              : "Add your first teacher to start building the teaching roster."
          }
        />
      ) : (
        <>
          <TeachersTable rows={rows} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            basePath="/app/teachers"
            params={{
              q: sp.q,
              status: sp.status,
              employmentType: sp.employmentType,
              campusId: sp.campusId,
              departmentId: sp.departmentId,
            }}
            noun="teacher"
          />
        </>
      )}
    </div>
  );
}
