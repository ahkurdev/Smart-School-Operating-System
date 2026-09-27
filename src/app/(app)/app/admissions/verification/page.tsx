import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listApplications } from "@/server/services/admission.service";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Verification" };

const statusVariant: Record<string, "neutral" | "success" | "warning" | "info" | "destructive"> = {
  SUBMITTED: "info",
  UNDER_REVIEW: "info",
  NEEDS_REVISION: "warning",
  VERIFIED: "success",
};

export default async function VerificationPage() {
  const actor = await requirePageActor();
  // The queue is everything that needs a human: submitted or under review.
  const submitted = await listApplications(actor, { status: "SUBMITTED" });
  const review = await listApplications(actor, { status: "UNDER_REVIEW" });
  const queue = [...submitted, ...review];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verification"
        description="Applications awaiting document verification and review."
        breadcrumbs={[{ label: "Admissions", href: "/app/admissions" }, { label: "Verification" }]}
      />
      {queue.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="size-6" aria-hidden />}
          title="Nothing to verify"
          description="Submitted applications will queue here for review."
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {queue.map((app) => (
            <li key={app.id}>
              <Link href={`/app/admissions/${app.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50">
                <div>
                  <span className="font-medium">{app.applicant.fullName}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {app.applicationNumber} · {app.period.name}
                  </span>
                </div>
                <Badge variant={statusVariant[app.status] ?? "neutral"}>{app.status.replace(/_/g, " ").toLowerCase()}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
