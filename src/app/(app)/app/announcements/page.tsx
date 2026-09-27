import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listAnnouncements } from "@/server/services/announcement.service";
import { prisma } from "@/server/db/client";
import { requireTenantId } from "@/server/db/tenant";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateAnnouncementDialog } from "@/features/ops/components/create-announcement-dialog";
import { AnnouncementControls, AcknowledgeButton } from "@/features/ops/components/announcement-controls";

export const metadata: Metadata = { title: "Announcements" };

const priorityVariant: Record<string, "neutral" | "info" | "warning" | "destructive"> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "warning",
  URGENT: "destructive",
};
const statusVariant: Record<string, "neutral" | "success" | "warning"> = { DRAFT: "neutral", PUBLISHED: "success", ARCHIVED: "warning" };

export default async function AnnouncementsPage() {
  const actor = await requirePageActor();
  const canManage = can(actor, "announcement.manage");
  const tenantId = requireTenantId(actor);

  const [announcements, acked] = await Promise.all([
    listAnnouncements(actor, { includeDrafts: canManage }),
    prisma.announcementAcknowledgment.findMany({ where: { tenantId, userId: actor.userId }, select: { announcementId: true } }),
  ]);
  const ackedSet = new Set(acked.map((a) => a.announcementId));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description={canManage ? "Draft, publish and track school-wide messages." : "Messages from the school."}
        breadcrumbs={[{ label: "Communication" }, { label: "Announcements" }]}
        actions={canManage ? <CreateAnnouncementDialog /> : null}
      />
      {announcements.length === 0 ? (
        <EmptyState icon={<Megaphone className="size-6" aria-hidden />} title="No announcements" description={canManage ? "Create a message to get started." : "School messages will appear here."} />
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <li key={a.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium">{a.title}</h2>
                    <Badge variant={priorityVariant[a.priority] ?? "neutral"}>{a.priority.toLowerCase()}</Badge>
                    <Badge variant={statusVariant[a.status] ?? "neutral"}>{a.status.toLowerCase()}</Badge>
                    <span className="text-xs text-muted-foreground">{a.audience.toLowerCase()}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    {a.publishAt && <span>Published {new Date(a.publishAt).toLocaleDateString()}</span>}
                    {canManage && a.requiresAcknowledgment && <span>{a._count.acknowledgments} acknowledged</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <AnnouncementControls id={a.id} status={a.status} canManage={canManage} />
                  {!canManage && a.status === "PUBLISHED" && a.requiresAcknowledgment && (
                    <AcknowledgeButton id={a.id} acknowledged={ackedSet.has(a.id)} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
