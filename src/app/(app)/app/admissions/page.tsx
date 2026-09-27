import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listApplications } from "@/server/services/admission.service";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Applicants" };

const statusVariant: Record<string, "neutral" | "success" | "warning" | "info" | "destructive"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  UNDER_REVIEW: "info",
  NEEDS_REVISION: "warning",
  VERIFIED: "info",
  EVALUATED: "info",
  ACCEPTED: "success",
  WAITLISTED: "warning",
  REJECTED: "destructive",
  RE_REGISTERED: "success",
  WITHDRAWN: "neutral",
};

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const actor = await requirePageActor();
  const { status, q } = await searchParams;
  const applications = await listApplications(actor, { status, search: q });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applicants"
        description="Every admission application, across all periods."
        breadcrumbs={[{ label: "Admissions", href: "/app/admissions" }, { label: "Applicants" }]}
      />
      {applications.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-6" aria-hidden />}
          title="No applications yet"
          description="Applications will appear here once applicants start applying to an open period."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Period / track</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/app/admissions/${app.id}`} className="hover:text-primary">
                      {app.applicationNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/app/admissions/${app.id}`} className="font-medium hover:text-primary">
                      {app.applicant.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {app.period.name}
                    {app.track ? ` · ${app.track.name}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[app.status] ?? "neutral"}>{app.status.replace(/_/g, " ").toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{app.score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
