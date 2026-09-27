"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setCurrentYearAction } from "@/features/academics/actions";

export function SetCurrentYearButton({ yearId }: { yearId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setCurrentYearAction(yearId);
          if (res.ok) toast.success(res.message ?? "Updated");
          else toast.error(res.message);
        })
      }
    >
      <CheckCircle2 className="size-4" aria-hidden />
      {pending ? "Setting…" : "Set as current"}
    </Button>
  );
}
