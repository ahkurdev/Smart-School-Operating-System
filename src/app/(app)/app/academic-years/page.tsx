import type { Metadata } from "next";
import { CalendarRange } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { listAcademicYears } from "@/server/services/academic.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AddAcademicYearDialog } from "@/features/academics/components/add-academic-year-dialog";
import { SetCurrentYearButton } from "@/features/academics/components/set-current-year-button";

export const metadata: Metadata = { title: "Academic years" };

export default async function AcademicYearsPage() {
  const actor = await requirePageActor("academic.read");
  const years = await listAcademicYears(actor);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Academic years"
        description="Define the school year and its terms. One year is marked current and drives enrollments."
        actions={can(actor, "academic.manage") ? <AddAcademicYearDialog /> : null}
      />

      {years.length === 0 ? (
        <EmptyState
          icon={<CalendarRange />}
          title="No academic years yet"
          description="Create your first academic year to start enrolling students and building timetables."
        />
      ) : (
        <div className="space-y-4">
          {years.map((y) => (
            <Card key={y.id}>
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {y.name}
                    {y.isCurrent ? <Badge variant="success">Current</Badge> : null}
                    <Badge variant="outline">{y.status}</Badge>
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(y.startDate).toLocaleDateString()} – {new Date(y.endDate).toLocaleDateString()}
                    {"  ·  "}
                    <span className="tabular">{y._count.classes}</span> classes ·{" "}
                    <span className="tabular">{y._count.enrollments}</span> enrollments
                  </p>
                </div>
                {can(actor, "academic.manage") && !y.isCurrent ? (
                  <SetCurrentYearButton yearId={y.id} />
                ) : null}
              </CardHeader>
              <CardContent>
                {y.terms.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {y.terms.map((t) => (
                      <li
                        key={t.id}
                        className="rounded-md border border-border px-2.5 py-1 text-xs"
                      >
                        <span className="font-medium">{t.name}</span>
                        <span className="ml-2 text-muted-foreground">{t.type}</span>
                        {t.isCurrent ? <span className="ml-2 text-success">• current</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No terms defined for this year.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
