import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listReportCards, getMyReportCards } from "@/server/services/reportcard.service";
import { listAcademicYears } from "@/server/services/academic.service";
import { listStudents } from "@/server/services/student.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { GenerateReportCardDialog } from "@/features/ops/components/generate-report-card-dialog";
import { ReportCardControls } from "@/features/ops/components/report-card-controls";

export const metadata: Metadata = { title: "Report cards" };

const statusVariant: Record<string, "neutral" | "info" | "success"> = { DRAFT: "neutral", REVIEW: "info", PUBLISHED: "success" };

export default async function ReportCardsPage() {
  const actor = await requirePageActor();

  // Students/parents see their own published cards.
  if (!can(actor, "grade.publish")) {
    const mine = await getMyReportCards(actor);
    return (
      <div className="space-y-6">
        <PageHeader title="Report cards" description="Published term reports." breadcrumbs={[{ label: "Academic" }, { label: "Report cards" }]} />
        {mine.length === 0 ? (
          <EmptyState icon={<FileText className="size-6" aria-hidden />} title="No report cards yet" description="Term reports appear here once the school publishes them." />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {mine.map((c) => (
              <li key={c.id}>
                <Link href={`/app/report-cards/${c.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50">
                  <div className="min-w-0">
                    <span className="font-medium">{c.student.fullName}</span>
                    <span className="block text-sm text-muted-foreground">
                      {c.term?.name ?? "Whole year"}
                    </span>
                  </div>
                  <Badge variant="success">published</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const [cards, years, students] = await Promise.all([
    listReportCards(actor),
    listAcademicYears(actor),
    listStudents(actor, { pageSize: 100 }),
  ]);
  const current = years.find((y) => y.isCurrent) ?? years[0];
  const terms = current?.terms ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report cards"
        description="Generate, review and publish term reports for students."
        breadcrumbs={[{ label: "Academic" }, { label: "Report cards" }]}
        actions={
          current && students.items.length ? (
            <GenerateReportCardDialog
              students={students.items.map((s) => ({ id: s.id, name: s.fullName, studentNumber: s.studentNumber }))}
              academicYearId={current.id}
              terms={terms.map((t) => ({ id: t.id, name: t.name }))}
            />
          ) : null
        }
      />
      {cards.length === 0 ? (
        <EmptyState icon={<FileText className="size-6" aria-hidden />} title="No report cards" description="Generate a report card from the student's published grades." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {cards.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <Link href={`/app/report-cards/${c.id}`} className="font-medium hover:text-primary">
                  {c.student.fullName}
                </Link>
                <span className="block text-sm text-muted-foreground">
                  {c.student.studentNumber} · {c.term?.name ?? "Whole year"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant[c.status] ?? "neutral"}>{c.status.toLowerCase()}</Badge>
                <ReportCardControls id={c.id} status={c.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
