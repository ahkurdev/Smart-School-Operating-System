import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listAcademicYears, listClasses, listSubjects } from "@/server/services/academic.service";
import { getGradebook, getMyGrades } from "@/server/services/gradebook.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { GradebookGrid } from "@/features/work/components/gradebook-grid";
import { GradebookClassPicker } from "@/features/work/components/gradebook-class-picker";
import { CreateAssessmentDialog } from "@/features/work/components/create-assessment-dialog";

export const metadata: Metadata = { title: "Grades" };

export default async function GradesPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const { class: classId } = await searchParams;
  const actor = await requirePageActor();
  const canReadAll = can(actor, "grade.read");

  // Students (and other self-scoped roles) see their own published grades.
  if (!canReadAll) {
    const { grades, average } = await getMyGrades(actor);
    return (
      <div className="space-y-6">
        <PageHeader
          title="My grades"
          description={average != null ? `Weighted average: ${average}%` : "Published results appear here."}
          breadcrumbs={[{ label: "Academic" }, { label: "Grades" }]}
        />
        {grades.length === 0 ? (
          <EmptyState icon={<GraduationCap className="size-6" aria-hidden />} title="No published grades" description="Results are shown once your teacher publishes them." />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {grades.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <span className="font-medium">{g.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {g.subject} · {g.type.toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular text-sm">
                    {g.score ?? "—"}/{g.maxScore}
                  </span>
                  <Badge variant="info">{g.letter ?? "—"}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const [classes, years, subjects] = await Promise.all([listClasses(actor), listAcademicYears(actor), listSubjects(actor, { pageSize: 100 })]);
  const current = years.find((y) => y.isCurrent) ?? years[0];
  const selected = classId && classes.some((c) => c.id === classId) ? classId : undefined;
  const book = selected ? await getGradebook(actor, { classroomId: selected }) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gradebook"
        description="Enter scores per assessment, then submit, approve and publish."
        breadcrumbs={[{ label: "Academic" }, { label: "Grades" }]}
        actions={
          current && can(actor, "grade.write") && classes.length && subjects.items.length ? (
            <CreateAssessmentDialog
              classes={classes.map((c) => ({ id: c.id, name: c.name }))}
              subjects={subjects.items.map((s) => ({ id: s.id, name: s.name }))}
              academicYearId={current.id}
              defaultClassroomId={selected}
            />
          ) : null
        }
      />

      <GradebookClassPicker classes={classes.map((c) => ({ id: c.id, name: c.name }))} value={selected} />

      {!selected ? (
        <EmptyState icon={<GraduationCap className="size-6" aria-hidden />} title="Pick a class" description="Choose a class to open its gradebook." />
      ) : !book || book.assessments.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-6" aria-hidden />}
          title="No assessments"
          description="Add an assessment column to start recording scores."
        />
      ) : (
        <GradebookGrid assessments={book.assessments} rows={book.rows} canWrite={can(actor, "grade.write")} />
      )}
    </div>
  );
}
