import type { Metadata } from "next";
import { Package } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { listAssets } from "@/server/services/asset.service";
import { listCampuses } from "@/server/services/tenant.service";
import { requireTenantId } from "@/server/db/tenant";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateAssetDialog } from "@/features/ops/components/create-asset-dialog";

export const metadata: Metadata = { title: "Assets" };

const conditionVariant: Record<string, "success" | "info" | "warning" | "destructive" | "neutral"> = {
  NEW: "success",
  GOOD: "success",
  FAIR: "info",
  POOR: "warning",
  BROKEN: "destructive",
  DISPOSED: "neutral",
};

export default async function AssetsPage() {
  const actor = await requirePageActor("asset.read");
  const tenantId = requireTenantId(actor);
  const canManage = can(actor, "asset.manage");
  const [assets, campuses] = await Promise.all([listAssets(actor), canManage ? listCampuses(tenantId) : Promise.resolve([])]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description="Inventory, condition, and maintenance history."
        breadcrumbs={[{ label: "Assets" }]}
        actions={canManage ? <CreateAssetDialog campuses={campuses.map((c) => ({ id: c.id, name: c.name }))} /> : null}
      />

      {assets.length === 0 ? (
        <EmptyState
          icon={<Package className="size-6" aria-hidden />}
          title="No assets recorded"
          description={canManage ? "Add the first asset to begin tracking inventory." : "No assets have been recorded yet."}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">School assets</caption>
            <thead className="border-b border-border bg-surface-sunken text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Code</th>
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 font-medium">Category</th>
                <th scope="col" className="px-4 py-3 font-medium">Location</th>
                <th scope="col" className="px-4 py-3 font-medium">Condition</th>
                <th scope="col" className="px-4 py-3 font-medium">Maintenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {assets.map((a) => (
                <tr key={a.id}>
                  <td className="tabular px-4 py-3">{a.assetCode}</td>
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.location || a.campus?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={conditionVariant[a.condition] ?? "neutral"}>{a.condition.toLowerCase()}</Badge>
                  </td>
                  <td className="tabular px-4 py-3 text-muted-foreground">{a._count.maintenanceRecords}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
