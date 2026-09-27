"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { linkStudentAction, type GuardianActionResult } from "@/features/guardians/actions";

export type StudentOption = { id: string; fullName: string; studentNumber: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Linking..." : "Link student"}
    </Button>
  );
}

export function LinkStudentDialog({
  guardianId,
  students,
}: {
  guardianId: string;
  students: StudentOption[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState<GuardianActionResult | undefined, FormData>(
    linkStudentAction,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Linked");
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Link2 className="size-4" aria-hidden /> Link student
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link a student</DialogTitle>
          <DialogDescription>
            Connect this guardian to a student and set their rights.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="guardianId" value={guardianId} />
          {state && !state.ok ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="studentId">Student</Label>
            <select
              id="studentId"
              name="studentId"
              required
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Choose a student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} · {s.studentNumber}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="relationship">Relationship on this link</Label>
            <Input
              id="relationship"
              name="relationship"
              placeholder="Defaults to the guardian's relationship"
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Rights</legend>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="isPrimary" /> Primary guardian for this student
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="canPickup" defaultChecked /> Can pick up the student
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="hasPortalAccess" defaultChecked /> Has portal access
            </label>
          </fieldset>

          <Submit />
        </form>
      </DialogContent>
    </Dialog>
  );
}
