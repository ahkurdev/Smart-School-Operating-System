import type { Metadata } from "next";
import { KeyRound, Webhook as WebhookIcon, Send } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listApiKeys, listWebhooks, listDeliveries } from "@/server/services/integration.service";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateApiKeyDialog, CreateWebhookDialog } from "@/features/ops/components/integration-dialogs";

export const metadata: Metadata = { title: "Integrations" };

const deliveryVariant: Record<string, "success" | "warning" | "destructive" | "neutral"> = {
  SUCCESS: "success",
  PENDING: "neutral",
  RETRYING: "warning",
  FAILED: "destructive",
};

export default async function IntegrationsPage() {
  const actor = await requirePageActor("apikey.manage");
  const [keys, hooks, deliveries] = await Promise.all([listApiKeys(actor), listWebhooks(actor), listDeliveries(actor)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="API keys and webhooks for external systems."
        breadcrumbs={[{ label: "Integrations" }]}
        actions={
          <div className="flex gap-2">
            <CreateWebhookDialog />
            <CreateApiKeyDialog />
          </div>
        }
      />

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">API keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="mt-4">
          {keys.length === 0 ? (
            <EmptyState icon={<KeyRound className="size-6" aria-hidden />} title="No API keys" description="Create a key to let an integration read school data." />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {keys.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <span className="font-medium">{k.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {k.prefix}… · {k.scopes.join(", ") || "no scopes"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {k.revokedAt ? <Badge variant="destructive">revoked</Badge> : <Badge variant="success">active</Badge>}
                    <span className="text-xs text-muted-foreground">{k.lastUsedAt ? `last used ${k.lastUsedAt.toLocaleDateString()}` : "never used"}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4">
          {hooks.length === 0 ? (
            <EmptyState icon={<WebhookIcon className="size-6" aria-hidden />} title="No webhooks" description="Add an endpoint to receive signed event payloads." />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {hooks.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <span className="font-medium">{h.url}</span>
                    <span className="block text-sm text-muted-foreground">{h.events.join(", ")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={h.isActive ? "success" : "neutral"}>{h.isActive ? "active" : "paused"}</Badge>
                    <span className="text-xs text-muted-foreground">{h._count.deliveries} deliveries</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="deliveries" className="mt-4">
          {deliveries.length === 0 ? (
            <EmptyState icon={<Send className="size-6" aria-hidden />} title="No deliveries" description="Webhook deliveries will appear here with their outcome." />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Recent deliveries</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border text-sm">
                  {deliveries.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-4 py-3">
                      <span>{d.event}</span>
                      <div className="flex items-center gap-3">
                        {d.responseCode ? <span className="tabular text-muted-foreground">HTTP {d.responseCode}</span> : null}
                        <Badge variant={deliveryVariant[d.status] ?? "neutral"}>{d.status.toLowerCase()}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
