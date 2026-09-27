import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { getMyApplication } from "@/server/services/admission.service";
import { prisma } from "@/server/db/client";
import { requireTenantId } from "@/server/db/tenant";
import { Badge } from "@/components/ui/badge";
import { ApplicationForm, type PublicField } from "@/features/admissions/components/application-form";

export const metadata: Metadata = { title: "My application" };

export default async function MyApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePageActor();
  const tenantId = requireTenantId(actor);
  const app = await getMyApplication(actor, id).catch(() => null);
  if (!app) notFound();

  const form = await prisma.applicationForm.findFirst({
    where: { tenantId, periodId: app.periodId },
    orderBy: { isDefault: "desc" },
    include: { fields: { orderBy: { sequence: "asc" } } },
  });

  const fields: PublicField[] = (form?.fields ?? []).map((f) => ({
    id: f.id,
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    placeholder: f.placeholder,
    helpText: f.helpText,
    options: Array.isArray(f.options) ? (f.options as string[]) : [],
    section: f.section,
  }));

  const valuesByKey: Record<string, unknown> = {};
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  for (const v of app.values) {
    const field = fieldById.get(v.fieldId);
    if (field) valuesByKey[field.key] = v.value;
  }

  const canEdit = app.status === "DRAFT" || app.status === "NEEDS_REVISION";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/apply" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Back to admissions
      </Link>

      <header className="flex items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs text-muted-foreground">{app.applicationNumber}</span>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {app.period.name}
            {app.track ? ` · ${app.track.name}` : ""}
          </h1>
        </div>
        <Badge variant={app.status === "ACCEPTED" || app.status === "RE_REGISTERED" ? "success" : app.status === "REJECTED" ? "destructive" : "neutral"}>
          {app.status.replace(/_/g, " ").toLowerCase()}
        </Badge>
      </header>

      {!canEdit && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          This application has been submitted and can no longer be edited. Contact the school if changes are needed.
        </p>
      )}

      {fields.length === 0 ? (
        <p className="text-muted-foreground">This period has no application form fields configured yet.</p>
      ) : (
        <ApplicationForm
          applicationId={app.id}
          fields={fields}
          initialValues={valuesByKey}
          documents={app.documents.map((d) => ({ id: d.id, documentType: d.documentType, fileId: d.fileId }))}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
