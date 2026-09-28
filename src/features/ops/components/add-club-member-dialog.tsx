"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
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
import { addMemberAction, type ActivityResult } from "@/features/ops/activity-actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Adding…" : "Add member"}
    </Button>
  );
}

export function AddClubMemberDialog({ clubId, students }: { clubId: string; students: { id: string; name: string; studentNumber: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActivityResult | null, FormData>(addMemberAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Member added");
      setOpen(false);
      router.refresh();
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  const sel = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";
  if (students.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" aria-hidden /> Add member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
          <DialogDescription>Enroll a student into this activity.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="clubId" value={clubId} />
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="studentId">Student</Label>
            <select id="studentId" name="studentId" className={sel} required>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.studentNumber})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input id="role" name="role" placeholder="Member, Captain…" maxLength={80} />
          </div>
          <DialogFooter>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
