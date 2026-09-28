import type { Metadata } from "next";
import { Bot, ShieldCheck } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { availableToolNames } from "@/server/ai/assistant.service";
import { isAiConfigured } from "@/server/ai/provider";
import { resolveAiContext } from "@/server/ai/context";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AssistantChat } from "@/features/ops/components/assistant-chat";

export const metadata: Metadata = { title: "AI Assistant" };

export default async function AssistantPage() {
  const actor = await requirePageActor("ai.use");
  const context = await resolveAiContext(actor);
  const tools = availableToolNames(actor, context);
  const configured = isAiConfigured();

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Assistant"
        description="A permission-aware assistant. It can only see data through the tools your role is allowed to use."
        breadcrumbs={[{ label: "AI Assistant" }]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-4" aria-hidden /> {context} assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!configured ? (
            <EmptyState
              icon={<ShieldCheck className="size-6" aria-hidden />}
              title="Assistant not configured"
              description="Set AI_PROVIDER=mock for a local demo, or provide AI_API_KEY to enable the assistant."
            />
          ) : (
            <AssistantChat context={context} tools={tools} />
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Every question and every tool the assistant uses is written to the audit trail. The assistant never changes data - it only reads and drafts.
      </p>
    </div>
  );
}
