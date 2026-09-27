import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listPeriods } from "@/server/services/admission.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreatePeriodDialog } from "@/features/admissions/components/create-period-dialog";

export const metadata: Metadata = { title: "Admission periods" };

const statusVariant: Record<string, "neutral" | "success" | "warning" | "info"> = {
  DRAFT: "neutral",
  OPEN: "success",
  CLOSED: "warning",
  ARCHIVED: "neutral",
};

export default async function PeriodsPage() {
  const actor = await requirePageActor();
  const periods = await listPeriods(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admission periods"
        description="Application windows, tracks and quotas."
        breadcrumbs={[{ label: "Admissions", href: "/app/admissions" }, { label: "Periods" }]}
        actions={can(actor, "admission.manage") ? <CreatePeriodDialog /> : null}
      />
      {periods.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="size-6" aria-hidden />}
          title="No admission periods"
          description="Create a period to open applications for the next intake."
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {periods.map((period) => (
            <li key={period.id}>
              <Link href={`/app/admissions/periods/${period.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50">
                <div className="min-w-0">
                  <span className="font-medium">{period.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {new Date(period.openAt).toLocaleDateString()} → {new Date(period.closeAt).toLocaleDateString()}
                    {" · "}
                    {period._count.applications} applications · {period._count.tracks} tracks
                    {period.academicYear ? ` · ${period.academicYear.name}` : ""}
                  </span>
                </div>
                <Badge variant={statusVariant[period.status] ?? "neutral"}>{period.status.toLowerCase()}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
