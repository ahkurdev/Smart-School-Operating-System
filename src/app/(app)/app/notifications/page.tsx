import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listMyNotifications } from "@/server/services/notification.service";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NotificationActions, NotificationItemActions } from "@/features/ops/components/notification-actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const actor = await requirePageActor();
  const notifications = await listMyNotifications(actor, { limit: 50 });
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Your in-app messages and alerts."
        breadcrumbs={[{ label: "Notifications" }]}
        actions={<NotificationActions hasUnread={hasUnread} />}
      />

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" aria-hidden />} title="You're all caught up" description="New notifications will appear here." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {notifications.map((n) => {
            const unread = !n.readAt;
            const inner = (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`truncate ${unread ? "font-semibold" : "font-medium"}`}>{n.title}</span>
                  {unread ? <Badge variant="success">new</Badge> : null}
                </div>
                {n.body ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">{n.createdAt.toLocaleString()}</p>
              </div>
            );
            return (
              <li key={n.id} className="flex items-start gap-3 p-4">
                {n.link ? (
                  <Link href={n.link} className="flex min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
                <NotificationItemActions id={n.id} unread={unread} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
