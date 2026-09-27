"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createSessionAction, type AttendanceActionResult } from "@/features/attendance/scan-actions";

type Option = { id: string; name: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create session"}
    </Button>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function timeNow(offsetMin: number): string {
  const d = new Date(Date.now() + offsetMin * 60_000);
  return d.toTimeString().slice(0, 5);
}

export function CreateSessionDialog({
  classrooms,
  subjects,
  academicYears,
}: {
  classrooms: Option[];
  subjects: Option[];
  academicYears: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<AttendanceActionResult | undefined, FormData>(
    createSessionAction,
    undefined,
  );
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Created");
      setOpen(false);
    }
  }, [state]);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden /> New session
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create attendance session</DialogTitle>
          <DialogDescription>Open a session to start scanning or marking attendance.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="classroomId">Class</Label>
            <select
              id="classroomId"
              name="classroomId"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              aria-invalid={!!fe.classroomId}
            >
              <option value="">Select a class</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {fe.classroomId ? <p className="text-xs text-destructive">{fe.classroomId[0]}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subjectId">Subject (optional)</Label>
              <select id="subjectId" name="subjectId" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">None</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="academicYearId">Academic year</Label>
              <select id="academicYearId" name="academicYearId" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">None</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input id="title" name="title" placeholder="Morning registration" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sessionDate">Date</Label>
              <Input id="sessionDate" name="sessionDate" type="date" defaultValue={today()} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startAt">Start</Label>
              <Input id="startAt" name="startAt" type="time" defaultValue={timeNow(0)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endAt">End</Label>
              <Input id="endAt" name="endAt" type="time" defaultValue={timeNow(60)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gracePeriodMinutes">Grace period (minutes)</Label>
            <Input id="gracePeriodMinutes" name="gracePeriodMinutes" type="number" defaultValue={10} min={0} max={60} />
          </div>
          {state && !state.ok ? <p className="text-sm text-destructive">{state.message}</p> : null}
          <div className="flex justify-end">
            <Submit />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
