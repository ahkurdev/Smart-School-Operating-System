import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/guards";
import { getReportCard } from "@/server/services/reportcard.service";
import type { ReportLine, AttendanceSummary } from "@/server/services/reportcard.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ReportCardControls } from "@/features/ops/components/report-card-controls";

export const metadata: Metadata = { title: "Report card" };

export default async function ReportCardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePageActor();
  const card = await getReportCard(actor, id).catch(() => null);
  if (!card) notFound();

  const lines = (card.grades as unknown as ReportLine[]) ?? [];
  const att = (card.attendanceSummary as unknown as AttendanceSummary) ?? { present: 0, absent: 0, late: 0, excused: 0, rate: null };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Report card · ${card.student.fullName}`}
        description={card.term?.name ?? "Whole year"}
        breadcrumbs={[{ label: "Academic" }, { label: "Report cards", href: "/app/report-cards" }, { label: card.student.studentNumber }]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={card.status === "PUBLISHED" ? "success" : card.status === "REVIEW" ? "info" : "neutral"}>{card.status.toLowerCase()}</Badge>
            {can(actor, "grade.publish") && <ReportCardControls id={card.id} status={card.status} />}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 font-medium">Results by subject</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published grades were available when this card was generated.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-2 font-medium">Subject</th>
                  <th className="p-2 text-right font-medium">Average</th>
                  <th className="p-2 text-right font-medium">Grade</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.subject} className="border-b border-border last:border-0">
                    <td className="p-2">{l.subject}</td>
                    <td className="p-2 text-right tabular">{l.average != null ? `${l.average}%` : "—"}</td>
                    <td className="p-2 text-right">
                      <Badge variant="info">{l.letter ?? "—"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border p-4">
            <h2 className="mb-2 font-medium">Attendance</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Present</dt>
                <dd className="tabular">{att.present}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Absent</dt>
                <dd className="tabular">{att.absent}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Late</dt>
                <dd className="tabular">{att.late}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Excused</dt>
                <dd className="tabular">{att.excused}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-medium">
                <dt>Rate</dt>
                <dd className="tabular">{att.rate != null ? `${att.rate}%` : "—"}</dd>
              </div>
            </dl>
          </div>
          {(card.teacherRemarks || card.principalRemarks) && (
            <div className="rounded-xl border border-border p-4 text-sm">
              <h2 className="mb-2 font-medium">Remarks</h2>
              {card.teacherRemarks && (
                <p className="mb-2">
                  <span className="text-muted-foreground">Teacher: </span>
                  {card.teacherRemarks}
                </p>
              )}
              {card.principalRemarks && (
                <p>
                  <span className="text-muted-foreground">Principal: </span>
                  {card.principalRemarks}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
