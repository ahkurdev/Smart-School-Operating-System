import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listEvents } from "@/server/services/cms.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateEventDialog } from "@/features/cms/components/create-event-dialog";
import { EventRow } from "@/features/cms/components/event-row";

export const metadata: Metadata = { title: "Events — CMS" };

export default async function CmsEventsPage() {
  const actor = await requirePageActor();
  const events = await listEvents(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description="School events, published to the site and the school calendar."
        breadcrumbs={[{ label: "CMS", href: "/app/cms/pages" }, { label: "Events" }]}
        actions={can(actor, "cms.create") ? <CreateEventDialog /> : null}
      />
      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-6" aria-hidden />}
          title="No events yet"
          description="Create an event to show it on the school website and calendar."
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              canPublish={can(actor, "cms.publish")}
              canDelete={can(actor, "cms.delete")}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
