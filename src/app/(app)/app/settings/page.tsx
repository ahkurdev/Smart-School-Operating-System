import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/guards";
import { requireTenantId } from "@/server/db/tenant";
import { getTenantById } from "@/server/services/tenant.service";
import { listRetentionPolicies, supportedRetentionEntities } from "@/server/services/retention.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SchoolProfileForm, RetentionPolicyForm, ApplyRetentionButton } from "@/features/ops/components/settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requirePageActor("setting.read");
  const tenantId = requireTenantId(actor);
  const [tenant, policies] = await Promise.all([getTenantById(tenantId), listRetentionPolicies(actor)]);
  const entities = supportedRetentionEntities();

  const flags = (tenant?.featureFlags as Record<string, boolean> | null) ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="School profile, modules, and data retention."
        breadcrumbs={[{ label: "Settings" }]}
      />

      <SchoolProfileForm
        defaults={{
          name: tenant?.name ?? "",
          timezone: tenant?.timezone ?? "UTC",
          locale: tenant?.locale ?? "en-US",
          currency: tenant?.currency ?? "USD",
          gradeLabel: tenant?.gradeLabel ?? "",
          classLabel: tenant?.classLabel ?? "",
          studentIdLabel: tenant?.studentIdLabel ?? "",
        }}
        flags={flags}
      />

      <Card>
        <CardHeader>
          <CardTitle>Data retention</CardTitle>
          <CardDescription>
            Per-institution retention rules. Deleting older operational data keeps the database lean; anonymisation keeps rows for aggregates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <RetentionPolicyForm entities={entities} />

          {policies.length === 0 ? (
            <EmptyState title="No retention policies" description="Add a policy to automatically prune old data for this school." />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {policies.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <span className="font-medium capitalize">{p.entity.replace(/_/g, " ")}</span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    keep {p.retentionDays} days · {p.action}
                    <Badge variant={p.isActive ? "success" : "neutral"}>{p.isActive ? "active" : "paused"}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <ApplyRetentionButton />
        </CardContent>
      </Card>
    </div>
  );
}
