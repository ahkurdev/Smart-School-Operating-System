"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { returnLoanAction } from "@/features/library/actions";

export function ReturnLoanButton({ loanId, overdue }: { loanId: string; overdue: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant={overdue ? "destructive" : "outline"}
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          const res = await returnLoanAction(loanId);
          if (res.ok) {
            toast.success("Copy returned");
            router.refresh();
          } else {
            toast.error(res.error);
          }
        })
      }
    >
      <Undo2 className="size-4" aria-hidden /> {pending ? "Returning…" : "Return"}
    </Button>
  );
}
