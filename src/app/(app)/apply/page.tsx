import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, FileText } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listMyApplications } from "@/server/services/admission.service";
import { listOpenPeriods } from "@/server/services/admission.service";
import { requireTenantId } from "@/server/db/tenant";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Apply — Applicant portal" };

const statusVariant: Record<string, "neutral" | "success" | "warning" | "info" | "destructive"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  UNDER_REVIEW: "info",
  NEEDS_REVISION: "warning",
  VERIFIED: "info",
  ACCEPTED: "success",
  WAITLISTED: "warning",
  REJECTED: "destructive",
  RE_REGISTERED: "success",
};

/**
 * Applicant portal home (Phase 34). Lists open periods to apply to and the
 * signed-in applicant's own applications. Requires an authenticated session
 * with `admission.apply` (the applicant role grants it).
 */
export default async function ApplyPage() {
  const actor = await requirePageActor();
  const tenantId = requireTenantId(actor);
  const [periods, applications] = await Promise.all([
    listOpenPeriods(tenantId),
    listMyApplications(actor),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 font-display text-lg font-semibold">
          <GraduationCap className="size-6 text-primary" aria-hidden />
          Admissions
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Apply to this school</h1>
        <p className="text-muted-foreground">
          Complete your profile, then start an application for an open intake.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-medium">Open admissions</h2>
        {periods.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-6" aria-hidden />}
            title="No open admissions"
            description="There are no admission periods open right now. Please check back later."
          />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {periods.map((period) => (
              <li key={period.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <span className="font-medium">{period.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    Closes {new Date(period.closeAt).toLocaleDateString()}
                    {period.tracks.length ? ` · ${period.tracks.length} tracks` : ""}
                  </span>
                </div>
                <Link href={`/apply/period/${period.id}`} className="text-sm font-medium text-primary hover:underline">
                  Apply →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">My applications</h2>
        {applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have not started any applications yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {applications.map((app) => (
              <li key={app.id}>
                <Link href={`/apply/${app.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">{app.applicationNumber}</span>
                    <span className="block font-medium">
                      {app.period.name}
                      {app.track ? ` · ${app.track.name}` : ""}
                    </span>
                  </div>
                  <Badge variant={statusVariant[app.status] ?? "neutral"}>{app.status.replace(/_/g, " ").toLowerCase()}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
