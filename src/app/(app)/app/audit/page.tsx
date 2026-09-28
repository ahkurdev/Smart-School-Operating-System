import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listAuditLog, auditResources } from "@/server/services/audit.service";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = { title: "Audit log" };

type SearchParams = Promise<{ resource?: string; action?: string; page?: string }>;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePageActor("audit.read");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [result, resources] = await Promise.all([
    listAuditLog(actor, { resource: sp.resource, action: sp.action, page, pageSize: 25 }),
    auditResources(actor),
  ]);

  const qs = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { resource: sp.resource, action: sp.action, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return `/app/audit${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Immutable record of meaningful changes. Sensitive values are redacted."
        breadcrumbs={[{ label: "Audit log" }]}
      />

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-4">
        <div className="space-y-2">
          <Label htmlFor="f-resource">Resource</Label>
          <select id="f-resource" name="resource" defaultValue={sp.resource ?? ""} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
            <option value="">All</option>
            {resources.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="f-action">Action contains</Label>
          <Input id="f-action" name="action" defaultValue={sp.action ?? ""} placeholder="e.g. update" />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {sp.resource || sp.action ? (
          <Button asChild variant="ghost">
            <Link href="/app/audit">Clear</Link>
          </Button>
        ) : null}
      </form>

      {result.rows.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-6" aria-hidden />} title="No audit events" description="Actions your team takes will be recorded here." />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {result.total.toLocaleString()} event{result.total === 1 ? "" : "s"} · page {result.page} of {result.pageCount}
          </p>
          <ul className="divide-y divide-border rounded-xl border border-border text-sm">
            {result.rows.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                <Badge variant="neutral">{e.action}</Badge>
                <span className="font-medium">{e.resource}</span>
                {e.resourceId ? <span className="font-mono text-xs text-muted-foreground">{e.resourceId.slice(0, 10)}…</span> : null}
                <span className="text-muted-foreground">{e.actor?.fullName ?? e.actor?.email ?? e.actorType}</span>
                <span className="ms-auto text-xs text-muted-foreground">{e.createdAt.toLocaleString()}</span>
              </li>
            ))}
          </ul>
          {result.pageCount > 1 ? (
            <nav className="flex items-center justify-between" aria-label="Audit pagination">
              {result.page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={qs({ page: String(result.page - 1) })}>Previous</Link>
                </Button>
              ) : (
                <span />
              )}
              {result.page < result.pageCount ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={qs({ page: String(result.page + 1) })}>Next</Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </div>
      )}
    </div>
  );
}
