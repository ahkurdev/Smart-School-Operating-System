"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markReadAction, markAllReadAction, purgeNotificationAction } from "@/features/ops/notification-actions";

export function NotificationActions({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending || !hasUnread}
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          const res = await markAllReadAction();
          if (res.ok) {
            toast.success("All marked read");
            router.refresh();
          } else toast.error(res.error);
        })
      }
    >
      <Check className="size-4" aria-hidden /> Mark all read
    </Button>
  );
}

export function NotificationItemActions({ id, unread }: { id: string; unread: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    setPending(true);
    const res = await fn();
    setPending(false);
    if (res.ok) {
      toast.success(okMsg);
      router.refresh();
    } else toast.error(res.error ?? "Something went wrong");
  }

  return (
    <div className="flex items-center gap-1">
      {unread ? (
        <Button variant="ghost" size="icon" aria-label="Mark as read" disabled={pending} onClick={() => run(() => markReadAction(id), "Marked read")}>
          <Check className="size-4" aria-hidden />
        </Button>
      ) : null}
      <Button variant="ghost" size="icon" aria-label="Delete notification" disabled={pending} onClick={() => run(() => purgeNotificationAction(id), "Deleted")}>
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
