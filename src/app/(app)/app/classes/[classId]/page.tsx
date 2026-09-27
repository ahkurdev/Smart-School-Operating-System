import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { getClassRoster, listAcademicYears, listGradeLevels } from "@/server/services/academic.service";
import { listCampuses } from "@/server/services/tenant.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EditClassDialog } from "@/features/academics/components/edit-class-dialog";

export const metadata: Metadata = { title: "Class" };

export default async function ClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const actor = await requirePageActor("class.read");
  const tenantId = requireTenantId(actor);
  const { classId } = await params;

  let roster: Awaited<ReturnType<typeof getClassRoster>>;
  try {
    roster = await getClassRoster(actor, classId);
  } catch {
    notFound();
  }
  const { klass, students } = roster;
  const [years, gradeLevels, campuses] = await Promise.all([
    listAcademicYears(actor).catch(() => []),
    listGradeLevels(actor),
    listCampuses(tenantId),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title={klass.name}
        description={`${klass.code}${klass.stream ? ` · ${klass.stream}` : ""}`}
        breadcrumbs={[{ label: "Classes", href: "/app/classes" }, { label: klass.name }]}
        actions={
          can(actor, "class.manage") ? (
            <EditClassDialog
              values={{
                id: klass.id,
                name: klass.name,
                code: klass.code,
                academicYearId: klass.academicYear?.id ?? "",
                gradeLevelId: klass.gradeLevel?.id ?? "",
                campusId: "",
                stream: klass.stream ?? "",
                capacity: klass.capacity,
                homeroomTeacherId: "",
              }}
              academicYears={years.map((y) => ({ id: y.id, name: y.name }))}
              gradeLevels={gradeLevels.map((g) => ({ id: g.id, name: g.name }))}
              campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
            />
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Grade level</p>
            <p className="text-sm font-medium">{klass.gradeLevel?.name ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Academic year</p>
            <p className="text-sm font-medium">{klass.academicYear?.name ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Homeroom teacher</p>
            <p className="text-sm font-medium">{klass.homeroomTeacher?.fullName ?? "Unassigned"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Roster <span className="tabular text-muted-foreground">({students.length}/{klass.capacity})</span>
          </CardTitle>
          <CardDescription>Students currently enrolled in this class.</CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <EmptyState
              title="No students enrolled"
              description="Enroll students into this class to see the roster here."
            />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {students.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex items-center gap-3">
                    {s.rollNumber ? (
                      <span className="tabular w-6 text-center text-xs text-muted-foreground">{s.rollNumber}</span>
                    ) : null}
                    <Link href={`/app/students/${s.id}`} className="font-medium hover:underline">
                      {s.fullName}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular text-xs text-muted-foreground">{s.studentNumber}</span>
                    <Badge variant="outline">{s.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
