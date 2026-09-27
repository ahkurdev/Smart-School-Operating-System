"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setPeriodStatusAction, rankPeriodAction } from "@/features/admissions/actions";

const variant: Record<string, "neutral" | "success" | "warning"> = {
  DRAFT: "neutral",
  OPEN: "success",
  CLOSED: "warning",
  ARCHIVED: "neutral",
};

export function PeriodControls({
  periodId,
  status,
  canManage,
  canDecide,
}: {
  periodId: string;
  status: string;
  canManage: boolean;
  canDecide: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function setStatus(next: "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED") {
    startTransition(async () => {
      const res = await setPeriodStatusAction(periodId, next);
      if (res.ok) {
        toast.success(`Period ${next.toLowerCase()}`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function rank() {
    startTransition(async () => {
      const res = await rankPeriodAction(periodId);
      if (res.ok) {
        toast.success("Applications ranked by score");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
      <Badge variant={variant[status] ?? "neutral"}>{status.toLowerCase()}</Badge>
      <div className="flex-1" />
      {canManage && status === "DRAFT" && (
        <Button size="sm" disabled={pending} onClick={() => setStatus("OPEN")}>
          Open applications
        </Button>
      )}
      {canManage && status === "OPEN" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus("CLOSED")}>
          Close applications
        </Button>
      )}
      {canDecide && (
        <Button size="sm" variant="outline" disabled={pending} onClick={rank}>
          Rank by score
        </Button>
      )}
      {canManage && status !== "ARCHIVED" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setStatus("ARCHIVED")}>
          Archive
        </Button>
      )}
    </div>
  );
}
