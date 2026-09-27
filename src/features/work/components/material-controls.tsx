"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setMaterialStatusAction, deleteMaterialAction } from "@/features/work/actions";

export function MaterialControls({ id, status, canManage }: { id: string; status: string; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (!canManage) return null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(msg);
        router.refresh();
      } else toast.error(res.error ?? "Something went wrong");
    });
  }

  return (
    <div className="flex shrink-0 gap-1">
      {status === "DRAFT" ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setMaterialStatusAction(id, "PUBLISHED"), "Published")}>
          Publish
        </Button>
      ) : (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setMaterialStatusAction(id, "DRAFT"), "Moved to draft")}>
          Unpublish
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteMaterialAction(id), "Deleted")}>
        Delete
      </Button>
    </div>
  );
}
