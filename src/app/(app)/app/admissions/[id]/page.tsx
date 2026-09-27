import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/guards";
import { getApplicationForStaff } from "@/server/services/admission.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { DocumentActions, ReviewPanel } from "@/features/admissions/components/review-panel";

export const metadata: Metadata = { title: "Application" };

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePageActor();
  const data = await getApplicationForStaff(actor, id).catch(() => null);
  if (!data) notFound();
  const { application: app, fields } = data;

  const labelForField = new Map(fields.map((f) => [f.id, f.label]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={app.applicant.fullName}
        description={app.applicationNumber}
        breadcrumbs={[
          { label: "Admissions", href: "/app/admissions" },
          { label: "Applicants", href: "/app/admissions" },
          { label: app.applicationNumber },
        ]}
        actions={<Badge variant="neutral">{app.status.replace(/_/g, " ").toLowerCase()}</Badge>}
      />

      <ReviewPanel
        applicationId={app.id}
        status={app.status}
        score={app.score}
        decision={app.decision}
        canVerify={can(actor, "admission.verify")}
        canDecide={can(actor, "admission.decide")}
        canConvert={can(actor, "admission.convert")}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="font-medium">Applicant details</h2>
          <dl className="divide-y divide-border rounded-xl border border-border text-sm">
            <div className="flex justify-between p-3">
              <dt className="text-muted-foreground">Full name</dt>
              <dd>{app.applicant.fullName}</dd>
            </div>
            <div className="flex justify-between p-3">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{app.applicant.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between p-3">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{app.applicant.phone ?? "—"}</dd>
            </div>
            <div className="flex justify-between p-3">
              <dt className="text-muted-foreground">Period / track</dt>
              <dd>
                {app.period.name}
                {app.track ? ` · ${app.track.name}` : ""}
              </dd>
            </div>
          </dl>

          <h2 className="pt-2 font-medium">Submitted answers</h2>
          {app.values.length === 0 ? (
            <p className="text-sm text-muted-foreground">No answers submitted.</p>
          ) : (
            <dl className="divide-y divide-border rounded-xl border border-border text-sm">
              {app.values.map((v) => (
                <div key={v.id} className="flex justify-between gap-4 p-3">
                  <dt className="text-muted-foreground">{labelForField.get(v.fieldId) ?? v.fieldId}</dt>
                  <dd className="text-right">{renderValue(v.value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">Documents ({app.documents.length})</h2>
          {app.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border text-sm">
              {app.documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <a href={`/api/files/${doc.fileId}`} target="_blank" rel="noreferrer" className="font-medium hover:text-primary">
                      {doc.documentType}
                    </a>
                    <span className="block text-xs text-muted-foreground">
                      {doc.verified ? "verified" : "pending verification"}
                      {doc.notes ? ` · ${doc.notes}` : ""}
                    </span>
                  </div>
                  {can(actor, "admission.verify") && <DocumentActions documentId={doc.id} verified={doc.verified} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
