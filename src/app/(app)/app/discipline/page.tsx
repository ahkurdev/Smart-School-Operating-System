import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { listDiscipline } from "@/server/services/activity.service";
import { listStudents } from "@/server/services/student.service";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateDisciplineDialog } from "@/features/ops/components/activity-dialogs";

export const metadata: Metadata = { title: "Discipline" };

const severityVariant: Record<string, "neutral" | "warning" | "destructive"> = {
  MINOR: "neutral",
  MODERATE: "warning",
  MAJOR: "warning",
  CRITICAL: "destructive",
};

const statusVariant: Record<string, "warning" | "info" | "success" | "neutral"> = {
  OPEN: "warning",
  RESOLVED: "success",
  APPEALED: "info",
  CLOSED: "neutral",
};

export default async function DisciplinePage() {
  const actor = await requirePageActor("discipline.read");
  const canManage = can(actor, "discipline.manage");
  const [records, students] = await Promise.all([
    listDiscipline(actor),
    canManage ? listStudents(actor, { pageSize: 100 }) : Promise.resolve({ items: [] as { id: string; fullName: string; studentNumber: string }[] }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discipline"
        description="Incident records. Presented factually, visible to authorized staff only."
        breadcrumbs={[{ label: "Discipline" }]}
        actions={canManage ? <CreateDisciplineDialog students={students.items.map((s) => ({ id: s.id, name: s.fullName, studentNumber: s.studentNumber }))} /> : null}
      />

      {records.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="size-6" aria-hidden />}
          title="No incidents recorded"
          description={canManage ? "Record an incident when one is reported." : "There are no discipline records to show."}
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {records.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <span className="font-medium">{r.category}</span>
                <span className="block text-sm text-muted-foreground">
                  {r.student ? `${r.student.fullName} (${r.student.studentNumber}) · ` : ""}
                  {r.occurredAt.toLocaleDateString()} · {r.description.slice(0, 80)}
                  {r.description.length > 80 ? "…" : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={severityVariant[r.severity] ?? "neutral"}>{r.severity.toLowerCase()}</Badge>
                <Badge variant={statusVariant[r.status] ?? "neutral"}>{r.status.toLowerCase()}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
