"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { recordPaymentAction, type OpsResult } from "@/features/ops/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Recording…" : "Record payment"}
    </Button>
  );
}

export function RecordPaymentDialog({ invoiceId, outstanding }: { invoiceId: string; outstanding: number }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<OpsResult | null, FormData>(recordPaymentAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Payment recorded");
      setOpen(false);
      router.refresh();
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  const sel = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Record payment</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>Outstanding balance: {outstanding.toLocaleString()}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" name="amount" type="number" min={0} step="0.01" max={outstanding} required defaultValue={outstanding} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="method">Method</Label>
            <select id="method" name="method" className={sel} defaultValue="BANK_TRANSFER">
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CARD">Card</option>
              <option value="EWALLET">E-wallet</option>
              <option value="GATEWAY">Payment gateway</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference">Reference</Label>
            <Input id="reference" name="reference" placeholder="Transfer / receipt no." maxLength={120} />
          </div>
          <DialogFooter>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
