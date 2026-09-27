"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Play, Square, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openSessionAction, closeSessionAction, cancelSessionAction } from "@/features/attendance/scan-actions";

export function SessionControls({ sessionId, status }: { sessionId: string; status: string }) {
  const [pending, start] = useTransition();

  function run(fn: (id: string) => Promise<{ ok: boolean; message?: string }>, label: string) {
    start(async () => {
      const res = await fn(sessionId);
      if (res.ok) toast.success(res.message ?? label);
      else toast.error(res.message ?? "Failed");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "SCHEDULED" ? (
        <Button size="sm" onClick={() => run(openSessionAction, "Opened")} disabled={pending}>
          <Play className="size-4" aria-hidden /> Open session
        </Button>
      ) : null}
      {status === "OPEN" ? (
        <Button size="sm" variant="outline" onClick={() => run(closeSessionAction, "Closed")} disabled={pending}>
          <Square className="size-4" aria-hidden /> Close session
        </Button>
      ) : null}
      {status !== "CLOSED" && status !== "CANCELLED" ? (
        <Button size="sm" variant="ghost" onClick={() => run(cancelSessionAction, "Cancelled")} disabled={pending}>
          <Ban className="size-4" aria-hidden /> Cancel
        </Button>
      ) : null}
    </div>
  );
}
