import type { Metadata } from "next";
import { HeartHandshake, Lock } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { listCounseling } from "@/server/services/activity.service";
import { listStudents } from "@/server/services/student.service";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateCounselingDialog } from "@/features/ops/components/activity-dialogs";

export const metadata: Metadata = { title: "Counseling" };

const statusVariant: Record<string, "warning" | "info" | "success"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  CLOSED: "success",
};

export default async function CounselingPage() {
  const actor = await requirePageActor("counseling.read");
  const canManage = can(actor, "counseling.manage");
  const records = (await listCounseling(actor)) as Array<
    Awaited<ReturnType<typeof listCounseling>>[number] & { student?: { id: string; fullName: string; studentNumber: string } }
  >;
  const students = canManage
    ? await listStudents(actor, { pageSize: 100 })
    : { items: [] as { id: string; fullName: string; studentNumber: string }[] };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Counseling"
        description="Confidential records. Access is limited to counsellors and authorized staff."
        breadcrumbs={[{ label: "Counseling" }]}
        actions={canManage ? <CreateCounselingDialog students={students.items.map((s) => ({ id: s.id, name: s.fullName, studentNumber: s.studentNumber }))} /> : null}
      />

      <p className="flex items-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-muted-foreground">
        <Lock className="size-4" aria-hidden /> Records shown here are confidential and access is logged.
      </p>

      {records.length === 0 ? (
        <EmptyState
          icon={<HeartHandshake className="size-6" aria-hidden />}
          title="No counseling records"
          description={canManage ? "Start a record for a student needing support." : "There are no counseling records to show."}
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {records.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <span className="font-medium">{r.type.toLowerCase().replace("_", " ")}</span>
                <span className="block text-sm text-muted-foreground">
                  {r.student ? `${r.student.fullName} (${r.student.studentNumber}) · ` : ""}
                  {r.occurredAt.toLocaleDateString()} · {r.summary.slice(0, 80)}
                  {r.summary.length > 80 ? "…" : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {r.confidential ? <Badge variant="outline">Confidential</Badge> : null}
                <Badge variant={statusVariant[r.status] ?? "neutral"}>{r.status.toLowerCase().replace("_", " ")}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
