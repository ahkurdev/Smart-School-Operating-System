import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listAssignments, listMyAssignments } from "@/server/services/assignment.service";
import { listAcademicYears, listClasses, listSubjects } from "@/server/services/academic.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateAssignmentDialog } from "@/features/work/components/create-assignment-dialog";

export const metadata: Metadata = { title: "Assignments" };

const statusVariant: Record<string, "neutral" | "success" | "warning"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

export default async function AssignmentsPage() {
  const actor = await requirePageActor();
  const isTeacherView = can(actor, "assignment.manage");

  // Students see their own assigned work; staff see the manageable list.
  if (!isTeacherView) {
    const mine = await listMyAssignments(actor);
    return (
      <div className="space-y-6">
        <PageHeader title="My assignments" description="Work assigned to your class." breadcrumbs={[{ label: "Academic" }, { label: "Assignments" }]} />
        {mine.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-6" aria-hidden />} title="No assignments" description="Assigned work will appear here." />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {mine.map((a) => {
              const sub = a.submissions[0];
              return (
                <li key={a.id}>
                  <Link href={`/app/assignments/${a.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50">
                    <div className="min-w-0">
                      <span className="font-medium">{a.title}</span>
                      <span className="block text-sm text-muted-foreground">
                        {a.subject.name}
                        {a.dueAt ? ` · due ${new Date(a.dueAt).toLocaleDateString()}` : ""}
                      </span>
                    </div>
                    {sub ? (
                      <Badge variant={sub.status === "GRADED" ? "success" : "info"}>
                        {sub.status.toLowerCase()}
                        {sub.score != null ? ` · ${sub.score}/${a.maxScore}` : ""}
                      </Badge>
                    ) : (
                      <Badge variant="warning">not submitted</Badge>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  const [assignments, years, classes, subjects] = await Promise.all([
    listAssignments(actor),
    listAcademicYears(actor),
    listClasses(actor),
    listSubjects(actor, { pageSize: 100 }),
  ]);
  const current = years.find((y) => y.isCurrent) ?? years[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        description="Work assigned to classes, with submissions and grading."
        breadcrumbs={[{ label: "Academic" }, { label: "Assignments" }]}
        actions={
          current && classes.length && subjects.items.length ? (
            <CreateAssignmentDialog
              classes={classes.map((c) => ({ id: c.id, name: c.name }))}
              subjects={subjects.items.map((s) => ({ id: s.id, name: s.name }))}
            />
          ) : null
        }
      />
      {assignments.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-6" aria-hidden />} title="No assignments yet" description="Create an assignment for one of your classes." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {assignments.map((a) => (
            <li key={a.id}>
              <Link href={`/app/assignments/${a.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50">
                <div className="min-w-0">
                  <span className="font-medium">{a.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {a.classroom.name} · {a.subject.name}
                    {a.dueAt ? ` · due ${new Date(a.dueAt).toLocaleDateString()}` : ""} · {a._count.submissions} submissions
                  </span>
                </div>
                <Badge variant={statusVariant[a.status] ?? "neutral"}>{a.status.toLowerCase()}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
