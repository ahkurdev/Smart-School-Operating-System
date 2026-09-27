"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteEventAction, setEventStatusAction } from "@/features/cms/actions";

const variant: Record<string, "neutral" | "success" | "warning"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

export function EventRow({
  event,
  canPublish,
  canDelete,
}: {
  event: { id: string; title: string; location: string | null; startAt: Date; endAt: Date; status: string; isPublic: boolean };
  canPublish: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function setStatus(status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    startTransition(async () => {
      const res = await setEventStatusAction(event.id, status);
      if (res.ok) {
        toast.success(`Event ${status.toLowerCase()}`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteEventAction(event.id);
      if (res.ok) {
        toast.success("Event deleted");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{event.title}</span>
          {event.isPublic && <Badge variant="info">public</Badge>}
        </div>
        <span className="text-sm text-muted-foreground">
          {new Date(event.startAt).toLocaleString()} → {new Date(event.endAt).toLocaleTimeString()}
          {event.location ? ` · ${event.location}` : ""}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={variant[event.status] ?? "neutral"}>{event.status.toLowerCase()}</Badge>
        {canPublish && event.status !== "PUBLISHED" && (
          <Button size="sm" variant="outline" onClick={() => setStatus("PUBLISHED")} disabled={pending}>
            Publish
          </Button>
        )}
        {canPublish && event.status === "PUBLISHED" && (
          <Button size="sm" variant="outline" onClick={() => setStatus("ARCHIVED")} disabled={pending}>
            Archive
          </Button>
        )}
        {canDelete && (
          <Button size="sm" variant="ghost" onClick={remove} disabled={pending}>
            Delete
          </Button>
        )}
      </div>
    </li>
  );
}
