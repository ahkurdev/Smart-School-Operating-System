"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ClipboardEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { manualMarkAction } from "@/features/attendance/scan-actions";

const STATUSES = ["PRESENT", "LATE", "EXCUSED", "SICK", "ABSENT", "LEAVE"] as const;

export type RosterStudent = {
  id: string;
  fullName: string;
  studentNumber: string;
  record: { status: string; method: string; scanTime: Date | string; overrideReason: string | null } | null;
};

/**
 * Manual attendance entry / override. Used when a device fails or for
 * accessibility. An existing record requires a reason, which the server enforces
 * and audits alongside the previous value.
 */
export function ManualMarkDialog({ session, students }: { session: string; students: RosterStudent[] }) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("PRESENT");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const selected = students.find((s) => s.id === studentId);
  const isOverride = !!selected?.record;

  function submit() {
    const fd = new FormData();
    fd.set("sessionId", session);
    fd.set("studentId", studentId);
    fd.set("status", status);
    fd.set("reason", reason);
    start(async () => {
      const res = await manualMarkAction(undefined, fd);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setOpen(false);
        setStudentId("");
        setReason("");
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ClipboardEdit className="size-4" aria-hidden /> Manual entry
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manual attendance</DialogTitle>
          <DialogDescription>
            Record or override attendance by hand. Overrides are audited with the previous value and your reason.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-2">
            <label htmlFor="m-student" className="text-sm font-medium">
              Student
            </label>
            <select
              id="m-student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Select a student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.studentNumber})
                  {s.record ? ` — currently ${s.record.status}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="m-status" className="text-sm font-medium">
              Status
            </label>
            <select
              id="m-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {isOverride ? (
            <div className="space-y-2">
              <label htmlFor="m-reason" className="text-sm font-medium">
                Override reason <span className="text-destructive">*</span>
              </label>
              <textarea
                id="m-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                required
                aria-required="true"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Why is this being changed?"
              />
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            {selected?.record ? (
              <Badge variant="outline">Current: {selected.record.status}</Badge>
            ) : (
              <span />
            )}
            <Button onClick={submit} disabled={!studentId || pending || (isOverride && !reason.trim())}>
              {pending ? "Saving…" : isOverride ? "Override" : "Record"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
