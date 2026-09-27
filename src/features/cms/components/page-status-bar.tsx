"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { setPageStatusAction, deletePageAction } from "@/features/cms/actions";

const variant: Record<string, "neutral" | "success" | "warning" | "info"> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

export function PageStatusBar({
  pageId,
  status,
  canPublish,
  canDelete,
}: {
  pageId: string;
  status: string;
  canPublish: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [scheduleAt, setScheduleAt] = useState("");
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  function change(next: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED", at?: string) {
    startTransition(async () => {
      const res = await setPageStatusAction(pageId, next, at);
      if (res.ok) {
        toast.success(`Page marked ${next.toLowerCase()}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deletePageAction(pageId);
      if (res.ok) {
        toast.success("Page deleted");
        router.push("/app/cms/pages");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
      <Badge variant={variant[status] ?? "neutral"}>{status.toLowerCase()}</Badge>
      <div className="flex-1" />
      {canPublish && status !== "PUBLISHED" && (
        <Button size="sm" disabled={pending} onClick={() => change("PUBLISHED")}>
          Publish
        </Button>
      )}
      {canPublish && status === "PUBLISHED" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => change("ARCHIVED")}>
          Archive
        </Button>
      )}
      {status !== "DRAFT" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => change("DRAFT")}>
          Move to draft
        </Button>
      )}
      {canPublish && (
        <div className="flex items-center gap-2">
          <Input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="h-8 w-52 text-sm"
            aria-label="Schedule publish time"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !scheduleAt}
            onClick={() => change("SCHEDULED", new Date(scheduleAt).toISOString())}
          >
            Schedule
          </Button>
        </div>
      )}
      {canDelete && (
        confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Delete?</span>
            <Button size="sm" variant="destructive" disabled={pending} onClick={remove}>
              Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} aria-label="Delete page">
            <Trash2 className="size-4 text-destructive" />
          </Button>
        )
      )}
    </div>
  );
}
