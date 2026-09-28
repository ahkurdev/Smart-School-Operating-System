"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createAssetAction, type AssetResult } from "@/features/ops/assets-actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Saving…" : "Add asset"}
    </Button>
  );
}

export function CreateAssetDialog({ campuses }: { campuses: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<AssetResult | null, FormData>(createAssetAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Asset added");
      setOpen(false);
      router.refresh();
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const sel = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden /> New asset
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New asset</DialogTitle>
          <DialogDescription>Record an item of school inventory.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assetCode">Asset code</Label>
              <Input id="assetCode" name="assetCode" required maxLength={60} aria-invalid={!!fieldErrors?.assetCode} />
              {fieldErrors?.assetCode && <p className="text-sm text-destructive">{fieldErrors.assetCode}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={200} aria-invalid={!!fieldErrors?.name} />
              {fieldErrors?.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" placeholder="e.g. Laptop, Furniture" maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="condition">Condition</Label>
              <select id="condition" name="condition" className={sel} defaultValue="GOOD">
                <option value="NEW">New</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="POOR">Poor</option>
                <option value="BROKEN">Broken</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campusId">Campus</Label>
              <select id="campusId" name="campusId" className={sel} defaultValue="">
                <option value="">—</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" maxLength={160} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="serialNumber">Serial number</Label>
              <Input id="serialNumber" name="serialNumber" maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acquisitionCost">Acquisition cost</Label>
              <Input id="acquisitionCost" name="acquisitionCost" type="number" min={0} step="0.01" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} maxLength={2000} />
          </div>
          <DialogFooter>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
