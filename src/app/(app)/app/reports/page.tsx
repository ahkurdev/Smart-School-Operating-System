import type { Metadata } from "next";
import { FileSpreadsheet } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { reportingSummary, teacherWorkload, libraryUsage, enrollmentByGrade } from "@/server/services/reporting.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButtons } from "@/features/ops/components/export-buttons";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const actor = await requirePageActor("reporting.read");
  const canExportStudents = can(actor, "student.export");
  const canExportAttendance = can(actor, "attendance.export");

  const [summary, workload, library, enrollment] = await Promise.all([
    reportingSummary(actor),
    teacherWorkload(actor),
    libraryUsage(actor),
    enrollmentByGrade(actor),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Run and export standard school reports."
        breadcrumbs={[{ label: "Reports" }]}
        actions={<ExportButtons canExportStudents={canExportStudents} canExportAttendance={canExportAttendance} />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enrollment by grade</CardTitle>
          </CardHeader>
          <CardContent>
            {enrollment.byGrade.length === 0 ? (
              <EmptyState title="No enrollments" description="Active enrollments will be summarised here." />
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-2 font-medium">Grade</th>
                    <th scope="col" className="py-2 text-right font-medium">Students</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enrollment.byGrade.map((g) => (
                    <tr key={g.name}>
                      <td className="py-2">{g.name}</td>
                      <td className="tabular py-2 text-right">{g.count}</td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td className="py-2">Total</td>
                    <td className="tabular py-2 text-right">{enrollment.total}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teacher workload</CardTitle>
          </CardHeader>
          <CardContent>
            {workload.length === 0 ? (
              <EmptyState title="No assignments" description="Teacher-class assignments will be summarised here." />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {workload.slice(0, 15).map((t) => (
                  <li key={t.name} className="flex items-center justify-between gap-4 py-2">
                    <span>{t.name}</span>
                    <span className="tabular text-muted-foreground">{t.classes} classes</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance summary (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-center">
            <Metric label="Rate" value={`${summary.attendance.rate}%`} />
            <Metric label="Absent" value={summary.attendance.absent} />
            <Metric label="Late" value={summary.attendance.late} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Library usage</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-center">
            <Metric label="Total loans" value={library.totalLoans} />
            <Metric label="Active" value={library.activeLoans} />
            <Metric label="Overdue" value={library.overdue} />
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileSpreadsheet className="size-4" aria-hidden /> Exports respect your permissions and are recorded in the audit trail.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="tabular text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
