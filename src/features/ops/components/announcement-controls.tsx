"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publishAnnouncementAction, archiveAnnouncementAction, acknowledgeAnnouncementAction } from "@/features/ops/actions";

export function AnnouncementControls({ id, status, canManage }: { id: string; status: string; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(msg);
        router.refresh();
      } else toast.error(res.error ?? "Something went wrong");
    });
  }

  if (!canManage) return null;
  return (
    <div className="flex gap-1">
      {status === "DRAFT" && (
        <Button size="sm" disabled={pending} onClick={() => run(() => publishAnnouncementAction(id), "Published")}>
          Publish
        </Button>
      )}
      {status === "PUBLISHED" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => archiveAnnouncementAction(id), "Archived")}>
          Archive
        </Button>
      )}
    </div>
  );
}

export function AcknowledgeButton({ id, acknowledged }: { id: string; acknowledged: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (acknowledged) return <span className="text-xs text-muted-foreground">Acknowledged</span>;
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await acknowledgeAnnouncementAction(id);
          if (res.ok) {
            toast.success("Marked as read");
            router.refresh();
          } else toast.error(res.error);
        })
      }
    >
      Mark as read
    </Button>
  );
}
