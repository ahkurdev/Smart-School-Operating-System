import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listInvoices, getMyInvoices, getFinanceSummary } from "@/server/services/finance.service";
import { listAcademicYears } from "@/server/services/academic.service";
import { listStudents } from "@/server/services/student.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateInvoiceDialog } from "@/features/ops/components/create-invoice-dialog";
import { RecordPaymentDialog } from "@/features/ops/components/record-payment-dialog";

export const metadata: Metadata = { title: "Finance" };

const statusVariant: Record<string, "neutral" | "info" | "success" | "warning" | "destructive"> = {
  UNPAID: "warning",
  PARTIAL: "info",
  PAID: "success",
  OVERDUE: "destructive",
  WAIVED: "neutral",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
};

function money(n: number, currency: string) {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default async function FinancePage() {
  const actor = await requirePageActor();
  const canManage = can(actor, "finance.manage");

  // Guardians/students see only their own invoices.
  if (!can(actor, "finance.read")) {
    const mine = await getMyInvoices(actor);
    return (
      <div className="space-y-6">
        <PageHeader title="My invoices" description="School fees and payments." breadcrumbs={[{ label: "Finance" }]} />
        {mine.length === 0 ? (
          <EmptyState icon={<Receipt className="size-6" aria-hidden />} title="No invoices" description="School invoices will appear here." />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {mine.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <span className="font-medium">{inv.invoiceNumber}</span>
                  <span className="block text-sm text-muted-foreground">
                    Due {new Date(inv.dueDate).toLocaleDateString()} · {inv.items.length} item{inv.items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular text-sm">
                    {money(inv.paidAmount, inv.currency)} / {money(inv.total, inv.currency)}
                  </span>
                  <Badge variant={statusVariant[inv.status] ?? "neutral"}>{inv.status.toLowerCase()}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const [invoices, summary, years, students] = await Promise.all([
    listInvoices(actor),
    getFinanceSummary(actor),
    listAcademicYears(actor),
    canManage ? listStudents(actor, { pageSize: 100 }) : Promise.resolve({ items: [] as { id: string; fullName: string; studentNumber: string }[] }),
  ]);
  const current = years.find((y) => y.isCurrent) ?? years[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Fees, invoices and payments."
        breadcrumbs={[{ label: "Finance" }]}
        actions={
          canManage && current && students.items.length ? (
            <CreateInvoiceDialog
              students={students.items.map((s) => ({ id: s.id, name: s.fullName, studentNumber: s.studentNumber }))}
              academicYearId={current.id}
            />
          ) : null
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular text-2xl font-semibold">{summary.invoices}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Billed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular text-2xl font-semibold">{summary.billed.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular text-2xl font-semibold text-success">{summary.collected.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular text-2xl font-semibold text-destructive">{summary.overdue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </section>

      {invoices.length === 0 ? (
        <EmptyState icon={<Receipt className="size-6" aria-hidden />} title="No invoices" description="Create an invoice to start billing." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {invoices.map((inv) => {
            const outstanding = Math.max(0, inv.total - inv.paidAmount);
            return (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <span className="font-medium">{inv.invoiceNumber}</span>
                  <span className="block text-sm text-muted-foreground">
                    {inv.student ? `${inv.student.fullName} (${inv.student.studentNumber})` : "Unassigned"} · due {new Date(inv.dueDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular text-sm">
                    {money(inv.paidAmount, inv.currency)} / {money(inv.total, inv.currency)}
                  </span>
                  <Badge variant={statusVariant[inv.status] ?? "neutral"}>{inv.status.toLowerCase()}</Badge>
                  {canManage && outstanding > 0 && inv.status !== "CANCELLED" && inv.status !== "REFUNDED" && (
                    <RecordPaymentDialog invoiceId={inv.id} outstanding={outstanding} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
