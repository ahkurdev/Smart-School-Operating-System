import type { Metadata } from "next";
import Link from "next/link";
import { School } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { listClasses, listAcademicYears, listGradeLevels } from "@/server/services/academic.service";
import { listCampuses } from "@/server/services/tenant.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AddClassDialog } from "@/features/academics/components/class-form";
import { AddGradeLevelDialog } from "@/features/academics/components/add-grade-level-dialog";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; q?: string }>;
}) {
  const actor = await requirePageActor("class.read");
  const tenantId = requireTenantId(actor);
  const sp = await searchParams;

  const [classes, years, gradeLevels, campuses] = await Promise.all([
    listClasses(actor, { academicYearId: sp.year, search: sp.q }),
    listAcademicYears(actor).catch(() => []),
    listGradeLevels(actor),
    listCampuses(tenantId),
  ]);

  const yearOptions = years.map((y) => ({ id: y.id, name: y.name }));
  const gradeOptions = gradeLevels.map((g) => ({ id: g.id, name: g.name }));
  const campusOptions = campuses.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Classes"
        description="Class sections, their grade level, homeroom teacher, and enrollment."
        actions={
          can(actor, "class.manage") ? (
            <div className="flex gap-2">
              <AddGradeLevelDialog />
              <AddClassDialog academicYears={yearOptions} gradeLevels={gradeOptions} campuses={campusOptions} />
            </div>
          ) : null
        }
      />

      {gradeLevels.length === 0 ? (
        <EmptyState
          icon={<School />}
          title="No grade levels yet"
          description="Add grade levels (e.g. Grade 10) before creating classes."
        />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<School />}
          title="No classes yet"
          description="Create your first class for the current academic year."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Link key={c.id} href={`/app/classes/${c.id}`} className="block focus-visible:rounded-md">
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{c.name}</p>
                    <Badge variant="outline">{c.code}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.gradeLevel?.name ?? "No grade"} · {c.academicYear?.name ?? "No year"}
                    {c.stream ? ` · ${c.stream}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Homeroom: {c.homeroomTeacher?.fullName ?? "Unassigned"}
                  </p>
                  <p className="text-xs">
                    <span className="tabular font-medium">{c._count.enrollments}</span>
                    <span className="text-muted-foreground"> / {c.capacity} students</span>
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
