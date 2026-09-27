"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setReportCardStatusAction } from "@/features/ops/actions";

export function ReportCardControls({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function set(next: "DRAFT" | "REVIEW" | "PUBLISHED") {
    startTransition(async () => {
      const res = await setReportCardStatusAction(id, next);
      if (res.ok) {
        toast.success(`Report card ${next.toLowerCase()}`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex gap-1">
      {status === "DRAFT" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => set("REVIEW")}>
          Review
        </Button>
      )}
      {status !== "PUBLISHED" && (
        <Button size="sm" disabled={pending} onClick={() => set("PUBLISHED")}>
          Publish
        </Button>
      )}
      {status === "PUBLISHED" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("DRAFT")}>
          Unpublish
        </Button>
      )}
    </div>
  );
}
