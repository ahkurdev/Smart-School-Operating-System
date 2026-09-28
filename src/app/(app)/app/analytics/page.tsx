import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { reportingSummary, academicRiskIndicators } from "@/server/services/reporting.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart, Sparkline } from "@/components/shared/charts";

export const metadata: Metadata = { title: "Analytics" };

const riskVariant: Record<string, "warning" | "destructive" | "neutral"> = {
  elevated: "destructive",
  watch: "warning",
  low: "neutral",
};

export default async function AnalyticsPage() {
  const actor = await requirePageActor("reporting.read");
  const [summary, risk] = await Promise.all([reportingSummary(actor), academicRiskIndicators(actor, { days: 30 })]);

  const attendanceBars = summary.attendance.series.slice(-14).map((s) => ({ label: s.date.slice(5), value: Math.round(s.rate) }));
  const financeBars = summary.finance.slice(-6).map((f) => ({ label: f.month.slice(2), value: f.collected }));
  const enrollmentBars = summary.enrollment.byGrade.slice(0, 12).map((g) => ({ label: g.name, value: g.count }));

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Attendance, enrollment, admissions, finance, and academic risk." breadcrumbs={[{ label: "Analytics" }]} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Students" value={summary.counts.students} />
        <Stat title="Teachers" value={summary.counts.teachers} />
        <Stat title="Attendance (30d)" value={`${summary.attendance.rate}%`} />
        <Stat title="Active loans" value={summary.library.activeLoans} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance rate (last 14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceBars.length ? (
              <BarChart data={attendanceBars} max={100} valueSuffix="%" ariaLabel="Daily attendance rate, last 14 days" />
            ) : (
              <EmptyState title="No attendance yet" description="Attendance recorded in the last 14 days will chart here." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enrollment by grade</CardTitle>
          </CardHeader>
          <CardContent>
            {enrollmentBars.length ? (
              <BarChart data={enrollmentBars} ariaLabel="Active enrollment by grade level" />
            ) : (
              <EmptyState title="No enrollments" description="Active enrollments by grade will chart here." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fees collected by month</CardTitle>
          </CardHeader>
          <CardContent>
            {financeBars.length ? (
              <BarChart data={financeBars} ariaLabel="Fees collected per month" />
            ) : (
              <EmptyState title="No finance data" description="Collected fees by month will chart here." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admissions funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.admissions.total > 0 ? (
              <ul className="space-y-2 text-sm">
                {Object.entries(summary.admissions.byStatus).map(([status, count]) => (
                  <li key={status} className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">{status.toLowerCase().replace(/_/g, " ")}</span>
                    <span className="tabular font-medium">{count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No applications" description="Applicant status counts will appear here." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-4" aria-hidden /> Academic risk indicators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            These are indicators for staff review based on attendance and grade facts for {risk.period.from} to {risk.period.to}. They are not
            predictions or diagnoses - each row names the contributing factors.
          </p>
          {risk.indicators.length === 0 ? (
            <EmptyState title="No indicators" description="No students crossed the review thresholds in this period." />
          ) : (
            <>
              <Sparkline data={risk.indicators.slice(0, 20).map((r) => ({ label: r.studentNumber, value: r.score }))} ariaLabel="Risk scores across flagged students" />
              <ul className="divide-y divide-border">
                {risk.indicators.slice(0, 25).map((r) => (
                  <li key={r.studentId} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={`/app/students/${r.studentId}`} className="font-medium hover:underline underline-offset-4">
                        {r.fullName}
                      </Link>
                      <span className="block text-sm text-muted-foreground">
                        {r.studentNumber} · {r.factors.map((f) => `${f.label}: ${f.detail}`).join("; ")}
                      </span>
                    </div>
                    <Badge variant={riskVariant[r.level] ?? "neutral"}>{r.level}</Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="tabular text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
