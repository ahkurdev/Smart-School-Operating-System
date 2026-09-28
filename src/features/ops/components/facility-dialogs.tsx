"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, CalendarPlus } from "lucide-react";
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
import { createFacilityAction, requestBookingAction, type AssetResult } from "@/features/ops/assets-actions";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function CreateFacilityDialog() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<AssetResult | null, FormData>(createFacilityAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Facility added");
      setOpen(false);
      router.refresh();
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden /> New facility
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New facility</DialogTitle>
          <DialogDescription>Add a bookable space such as a hall, lab, or meeting room.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={200} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Input id="type" name="type" placeholder="Hall, Lab…" maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input id="capacity" name="capacity" type="number" min={0} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" maxLength={160} />
          </div>
          <DialogFooter>
            <Submit label="Add facility" pendingLabel="Saving…" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RequestBookingDialog({ facilities }: { facilities: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<AssetResult | null, FormData>(requestBookingAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Booking created");
      setOpen(false);
      router.refresh();
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  const sel = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

  if (facilities.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarPlus className="size-4" aria-hidden /> Book a facility
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book a facility</DialogTitle>
          <DialogDescription>Overlapping bookings for the same facility are refused.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="facilityId">Facility</Label>
            <select id="facilityId" name="facilityId" className={sel} required>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Input id="purpose" name="purpose" required maxLength={300} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startAt">Start</Label>
              <Input id="startAt" name="startAt" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endAt">End</Label>
              <Input id="endAt" name="endAt" type="datetime-local" required />
            </div>
          </div>
          <DialogFooter>
            <Submit label="Request booking" pendingLabel="Booking…" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
