import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/guards";
import { getPeriod, getDefaultForm, listApplications } from "@/server/services/admission.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeriodControls } from "@/features/admissions/components/period-controls";
import { AddTrackDialog } from "@/features/admissions/components/add-track-dialog";
import { FormBuilder } from "@/features/admissions/components/form-builder";

export const metadata: Metadata = { title: "Admission period" };

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

export default async function PeriodDetailPage({ params }: { params: Promise<{ periodId: string }> }) {
  const { periodId } = await params;
  const actor = await requirePageActor();
  const period = await getPeriod(actor, periodId).catch(() => null);
  if (!period) notFound();

  const [form, applications] = await Promise.all([
    getDefaultForm(actor, periodId),
    listApplications(actor, { periodId }),
  ]);

  const editorFields = (form?.fields ?? []).map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    placeholder: f.placeholder ?? "",
    helpText: f.helpText ?? "",
    options: Array.isArray(f.options) ? (f.options as string[]) : [],
    section: f.section ?? "",
  }));

  const statusCounts = period.applications.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title={period.name}
        description={`${new Date(period.openAt).toLocaleDateString()} → ${new Date(period.closeAt).toLocaleDateString()}`}
        breadcrumbs={[
          { label: "Admissions", href: "/app/admissions" },
          { label: "Periods", href: "/app/admissions/periods" },
          { label: period.name },
        ]}
      />

      <PeriodControls
        periodId={period.id}
        status={period.status}
        canManage={can(actor, "admission.manage")}
        canDecide={can(actor, "admission.decide")}
      />

      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
          <TabsTrigger value="tracks">Tracks ({period.tracks.length})</TabsTrigger>
          <TabsTrigger value="form">Form ({editorFields.length} fields)</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="pt-6">
          {applications.length === 0 ? (
            <p className="text-muted-foreground">No applications for this period yet.</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <Badge key={status} variant={statusVariant[status] ?? "neutral"}>
                    {status.replace(/_/g, " ").toLowerCase()} · {count}
                  </Badge>
                ))}
              </div>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Number</th>
                      <th className="px-4 py-3 font-medium">Applicant</th>
                      <th className="px-4 py-3 font-medium">Track</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Score</th>
                      <th className="px-4 py-3 font-medium">Rank</th>
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
                        <td className="px-4 py-3 text-muted-foreground">{app.track?.name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant[app.status] ?? "neutral"}>{app.status.replace(/_/g, " ").toLowerCase()}</Badge>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{app.score ?? "—"}</td>
                        <td className="px-4 py-3 tabular-nums">{app.rank ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="tracks" className="space-y-4 pt-6">
          {period.tracks.length > 0 && (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {period.tracks.map((track) => (
                <li key={track.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <span className="font-medium">{track.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      Code {track.code}
                      {track.quota ? ` · quota ${track.quota}` : ""}
                      {track.requiresTest ? " · test" : ""}
                      {track.requiresInterview ? " · interview" : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {can(actor, "admission.manage") && <AddTrackDialog periodId={period.id} />}
        </TabsContent>

        <TabsContent value="form" className="pt-6">
          {can(actor, "admission.manage") ? (
            <FormBuilder periodId={period.id} initialFields={editorFields} />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {editorFields.map((f) => (
                <li key={f.key} className="flex items-center justify-between p-3 text-sm">
                  <span>
                    {f.label} <span className="font-mono text-xs text-muted-foreground">({f.key})</span>
                  </span>
                  <span className="text-muted-foreground">
                    {f.type.toLowerCase()}
                    {f.required ? " · required" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
