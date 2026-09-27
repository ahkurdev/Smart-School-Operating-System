import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { getTeacher } from "@/server/services/teacher.service";
import { listCampuses } from "@/server/services/tenant.service";
import { listDepartments } from "@/server/services/academic.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EditTeacherDialog } from "@/features/teachers/components/edit-teacher-dialog";
import type { TeacherFormValues } from "@/features/teachers/components/teacher-form";

export const metadata: Metadata = { title: "Teacher" };

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ruled">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value || "-"}</p>
    </div>
  );
}

function toDateInput(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const actor = await requirePageActor("teacher.read");
  const tenantId = requireTenantId(actor);
  const { teacherId } = await params;

  let teacher: Awaited<ReturnType<typeof getTeacher>>;
  try {
    teacher = await getTeacher(actor, teacherId);
  } catch {
    notFound();
  }
  const [campuses, departments] = await Promise.all([
    listCampuses(tenantId),
    listDepartments(actor).catch(() => []),
  ]);

  const formValues: TeacherFormValues = {
    id: teacher.id,
    fullName: teacher.fullName,
    employeeNumber: teacher.employeeNumber,
    gender: teacher.gender ?? "",
    qualification: teacher.qualification ?? "",
    specialization: teacher.specialization ?? "",
    employmentType: teacher.employmentType,
    joinDate: toDateInput(teacher.joinDate),
    exitDate: toDateInput(teacher.exitDate),
    email: teacher.email ?? "",
    phone: teacher.phone ?? "",
    address: teacher.address ?? "",
    campusId: teacher.campus?.id ?? "",
    departmentId: teacher.department?.id ?? "",
    status: teacher.status,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title={teacher.fullName}
        description={`${teacher.employeeNumber}${teacher.department ? ` · ${teacher.department.name}` : ""}`}
        breadcrumbs={[{ label: "Teachers", href: "/app/teachers" }, { label: teacher.fullName }]}
        actions={
          can(actor, "teacher.update") ? (
            <EditTeacherDialog
              values={formValues}
              campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
              departments={departments.map((d) => ({ id: d.id, name: d.name }))}
              canArchive={can(actor, "teacher.delete")}
            />
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Identity, employment, and contact details.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Detail label="Employee number" value={<span className="tabular">{teacher.employeeNumber}</span>} />
            <Detail label="Status" value={<Badge variant="outline">{teacher.status}</Badge>} />
            <Detail label="Employment type" value={teacher.employmentType.replace(/_/g, " ")} />
            <Detail label="Qualification" value={teacher.qualification} />
            <Detail label="Specialization" value={teacher.specialization} />
            <Detail label="Department" value={teacher.department?.name ?? "-"} />
            <Detail
              label="Join date"
              value={teacher.joinDate ? new Date(teacher.joinDate).toLocaleDateString() : "-"}
            />
            <Detail
              label="Exit date"
              value={teacher.exitDate ? new Date(teacher.exitDate).toLocaleDateString() : "-"}
            />
            <Detail label="Campus" value={teacher.campus?.name ?? "-"} />
            <Detail label="Email" value={teacher.email} />
            <Detail label="Phone" value={teacher.phone} />
            <Detail
              label="Login account"
              value={teacher.userId ? <Badge variant="success">Linked</Badge> : "None"}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subject assignments</CardTitle>
          <CardDescription>Subjects and classes this teacher is assigned to.</CardDescription>
        </CardHeader>
        <CardContent>
          {teacher.assignments.length > 0 ? (
            <ul className="divide-y divide-border text-sm">
              {teacher.assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-medium">
                    {a.subject.name}{" "}
                    <span className="text-xs text-muted-foreground">({a.subject.code})</span>
                  </span>
                  <span className="text-muted-foreground">{a.classroom.name}</span>
                  {a.isPrimary ? <Badge variant="info">Primary</Badge> : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No assignments yet"
              description="Assign this teacher to subjects and classes from the timetable or class screens."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Homeroom classes</CardTitle>
          <CardDescription>Classes where this teacher is the homeroom teacher.</CardDescription>
        </CardHeader>
        <CardContent>
          {teacher.homeroomClasses.length > 0 ? (
            <ul className="divide-y divide-border text-sm">
              {teacher.homeroomClasses.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="tabular text-muted-foreground">{c.code}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Not a homeroom teacher"
              description="This teacher is not currently attached to a class as homeroom teacher."
            />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        <Link href="/app/teachers" className="underline-offset-4 hover:underline">
          Back to teachers
        </Link>
      </p>
    </div>
  );
}
