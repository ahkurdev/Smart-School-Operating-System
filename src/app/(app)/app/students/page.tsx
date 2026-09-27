import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { listStudents, type StudentStatusFilter } from "@/server/services/student.service";
import { listCampuses } from "@/server/services/tenant.service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/shared/pagination";
import { StudentsTable, type StudentRow } from "@/features/students/components/students-table";
import { AddStudentDialog } from "@/features/students/components/add-student-dialog";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; campusId?: string }>;
}) {
  const actor = await requirePageActor("student.read");
  const tenantId = requireTenantId(actor);
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const [result, campuses] = await Promise.all([
    listStudents(actor, {
      search: sp.q,
      status: (sp.status as StudentStatusFilter) || undefined,
      campusId: sp.campusId,
      page,
      pageSize: 20,
    }),
    listCampuses(tenantId),
  ]);

  const rows: StudentRow[] = result.items.map((s) => ({
    id: s.id,
    studentNumber: s.studentNumber,
    fullName: s.fullName,
    gender: s.gender,
    status: s.status,
    currentClass: s.currentClass,
    academicYear: s.academicYear,
    campus: s.campus,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Students"
        description="Student records in this school, their enrollment, and status."
        actions={
          can(actor, "student.create") ? (
            <AddStudentDialog
              campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
              canSeeSensitive={can(actor, "student.read_sensitive")}
            />
          ) : null
        }
      />

      <form className="flex flex-wrap items-end gap-2" action="/app/students" method="get">
        <div className="max-w-xs flex-1">
          <label htmlFor="q" className="sr-only">
            Search students
          </label>
          <Input id="q" name="q" placeholder="Search by name or number" defaultValue={sp.q ?? ""} />
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
          <option value="INACTIVE">Inactive</option>
          <option value="GRADUATED">Graduated</option>
          <option value="TRANSFERRED">Transferred</option>
          <option value="WITHDRAWN">Withdrawn</option>
        </select>
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
          icon={<Users />}
          title="No students found"
          description={
            sp.q || sp.status || sp.campusId
              ? "No students match these filters. Try clearing the search."
              : "Add your first student, or import a CSV of students."
          }
        />
      ) : (
        <>
          <StudentsTable rows={rows} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            basePath="/app/students"
            params={{ q: sp.q, status: sp.status, campusId: sp.campusId }}
            noun="student"
          />
        </>
      )}
    </div>
  );
}
