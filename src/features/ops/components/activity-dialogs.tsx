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
import {
  createExtracurricularAction,
  createAchievementAction,
  createCounselingAction,
  createDisciplineAction,
  type ActivityResult,
} from "@/features/ops/activity-actions";

const SEL = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

type DialogAction = (prev: ActivityResult | null, fd: FormData) => Promise<ActivityResult>;

function ActivityDialog({
  triggerLabel,
  title,
  description,
  action,
  children,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  action: DialogAction;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActivityResult | null, FormData>(action, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Saved");
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
          <Plus className="size-4" aria-hidden /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          {children}
          <DialogFooter>
            <Submit label="Save" pendingLabel="Saving…" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateExtracurricularDialog() {
  return (
    <ActivityDialog
      triggerLabel="New activity"
      title="New extracurricular"
      description="Add a club or activity students can join."
      action={createExtracurricularAction}
    >
      <div className="space-y-2">
        <Label htmlFor="club-name">Name</Label>
        <Input id="club-name" name="name" required maxLength={200} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="club-schedule">Schedule</Label>
          <Input id="club-schedule" name="schedule" placeholder="e.g. Saturdays 09:00" maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="club-location">Location</Label>
          <Input id="club-location" name="location" maxLength={160} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="club-capacity">Capacity</Label>
        <Input id="club-capacity" name="capacity" type="number" min={0} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="club-description">Description</Label>
        <Textarea id="club-description" name="description" rows={2} maxLength={2000} />
      </div>
    </ActivityDialog>
  );
}

export function CreateAchievementDialog({ students }: { students: { id: string; name: string; studentNumber: string }[] }) {
  return (
    <ActivityDialog
      triggerLabel="Record achievement"
      title="Record an achievement"
      description="Log a competition result or award."
      action={createAchievementAction}
    >
      <div className="space-y-2">
        <Label htmlFor="ach-title">Title</Label>
        <Input id="ach-title" name="title" required maxLength={300} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ach-student">Student</Label>
        <select id="ach-student" name="studentId" className={SEL} defaultValue="">
          <option value="">— (school-level)</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.studentNumber})
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ach-competition">Competition</Label>
          <Input id="ach-competition" name="competition" maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ach-rank">Rank</Label>
          <Input id="ach-rank" name="rank" placeholder="1st, Finalist…" maxLength={60} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ach-level">Level</Label>
          <select id="ach-level" name="level" className={SEL} defaultValue="SCHOOL">
            <option value="SCHOOL">School</option>
            <option value="DISTRICT">District</option>
            <option value="REGIONAL">Regional</option>
            <option value="NATIONAL">National</option>
            <option value="INTERNATIONAL">International</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ach-date">Date</Label>
          <Input id="ach-date" name="achievedAt" type="date" required />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="publishToCms" className="size-4 rounded border-input" />
        Publish to the public website
      </label>
    </ActivityDialog>
  );
}

export function CreateCounselingDialog({ students }: { students: { id: string; name: string; studentNumber: string }[] }) {
  return (
    <ActivityDialog
      triggerLabel="New record"
      title="New counseling record"
      description="Confidential by default; only counsellors and authorized staff see it."
      action={createCounselingAction}
    >
      <div className="space-y-2">
        <Label htmlFor="c-student">Student</Label>
        <select id="c-student" name="studentId" className={SEL} required>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.studentNumber})
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="c-type">Type</Label>
          <select id="c-type" name="type" className={SEL} defaultValue="SESSION">
            <option value="APPOINTMENT">Appointment</option>
            <option value="SESSION">Session</option>
            <option value="REFERRAL">Referral</option>
            <option value="FOLLOW_UP">Follow-up</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-date">Date</Label>
          <Input id="c-date" name="occurredAt" type="date" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-summary">Summary</Label>
        <Textarea id="c-summary" name="summary" rows={3} required maxLength={4000} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-notes">Private notes</Label>
        <Textarea id="c-notes" name="notes" rows={3} maxLength={8000} />
      </div>
    </ActivityDialog>
  );
}

export function CreateDisciplineDialog({ students }: { students: { id: string; name: string; studentNumber: string }[] }) {
  return (
    <ActivityDialog
      triggerLabel="New incident"
      title="Record a discipline incident"
      description="Documented objectively and visible only to staff with permission."
      action={createDisciplineAction}
    >
      <div className="space-y-2">
        <Label htmlFor="d-student">Student</Label>
        <select id="d-student" name="studentId" className={SEL} required>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.studentNumber})
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="d-category">Category</Label>
          <Input id="d-category" name="category" placeholder="e.g. Lateness" required maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="d-severity">Severity</Label>
          <select id="d-severity" name="severity" className={SEL} defaultValue="MINOR">
            <option value="MINOR">Minor</option>
            <option value="MODERATE">Moderate</option>
            <option value="MAJOR">Major</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="d-date">Date</Label>
          <Input id="d-date" name="occurredAt" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="d-followup">Follow-up</Label>
          <Input id="d-followup" name="followUpAt" type="date" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="d-description">Description</Label>
        <Textarea id="d-description" name="description" rows={3} required maxLength={4000} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="d-action">Action taken</Label>
        <Textarea id="d-action" name="action" rows={2} maxLength={2000} />
      </div>
    </ActivityDialog>
  );
}
