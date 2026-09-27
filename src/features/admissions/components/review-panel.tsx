"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  verifyDocumentAction,
  setApplicationStatusAction,
  scoreApplicationAction,
  decideAction,
  convertAction,
} from "@/features/admissions/actions";

export function DocumentActions({ documentId, verified }: { documentId: string; verified: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function set(v: boolean) {
    startTransition(async () => {
      const res = await verifyDocumentAction(documentId, v);
      if (res.ok) {
        toast.success(v ? "Document verified" : "Document rejected");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="ghost" onClick={() => set(true)} disabled={pending || verified} aria-label="Verify">
        <Check className="size-4 text-emerald-600" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => set(false)} disabled={pending || !verified} aria-label="Reject">
        <X className="size-4 text-destructive" />
      </Button>
    </div>
  );
}

export function ReviewPanel({
  applicationId,
  status,
  score,
  decision,
  canVerify,
  canDecide,
  canConvert,
}: {
  applicationId: string;
  status: string;
  score: number | null;
  decision: string | null;
  canVerify: boolean;
  canDecide: boolean;
  canConvert: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [scoreInput, setScoreInput] = useState(score?.toString() ?? "");
  const [notes, setNotes] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const router = useRouter();

  function setStatus(next: string) {
    startTransition(async () => {
      const res = await setApplicationStatusAction(applicationId, next);
      if (res.ok) {
        toast.success("Status updated");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function saveScore() {
    startTransition(async () => {
      const res = await scoreApplicationAction(applicationId, Number(scoreInput));
      if (res.ok) {
        toast.success("Score saved");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function decide(next: "ACCEPTED" | "WAITLISTED" | "REJECTED") {
    startTransition(async () => {
      const res = await decideAction(applicationId, next, notes);
      if (res.ok) {
        toast.success(`Decision: ${next.toLowerCase()}`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function convert() {
    startTransition(async () => {
      const res = await convertAction(applicationId, studentNumber);
      if (res.ok) {
        toast.success("Applicant enrolled as a student");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const decided = Boolean(decision);

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      {canVerify && !decided && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Review:</span>
          <Button size="sm" variant="outline" onClick={() => setStatus("UNDER_REVIEW")} disabled={pending}>
            Under review
          </Button>
          <Button size="sm" variant="outline" onClick={() => setStatus("NEEDS_REVISION")} disabled={pending}>
            Needs revision
          </Button>
          <Button size="sm" variant="outline" onClick={() => setStatus("VERIFIED")} disabled={pending}>
            Mark verified
          </Button>
        </div>
      )}

      {canDecide && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="score" className="text-xs">
              Score (0-100)
            </Label>
            <div className="flex gap-2">
              <Input id="score" type="number" min={0} max={100} value={scoreInput} onChange={(e) => setScoreInput(e.target.value)} className="w-28" />
              <Button size="sm" variant="outline" onClick={saveScore} disabled={pending || scoreInput === ""}>
                Save score
              </Button>
            </div>
          </div>
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor="notes" className="text-xs">
              Decision notes
            </Label>
            <Textarea id="notes" rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      )}

      {canDecide && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => decide("ACCEPTED")} disabled={pending}>
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide("WAITLISTED")} disabled={pending}>
            Waitlist
          </Button>
          <Button size="sm" variant="destructive" onClick={() => decide("REJECTED")} disabled={pending}>
            Reject
          </Button>
        </div>
      )}

      {canConvert && decision === "ACCEPTED" && (
        <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <div className="space-y-1">
            <Label htmlFor="studentNumber" className="text-xs">
              Student number
            </Label>
            <Input id="studentNumber" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} className="w-44" />
          </div>
          <Button size="sm" onClick={convert} disabled={pending || !studentNumber}>
            {pending ? "Enrolling…" : "Enrol as student"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Current status: {status.replace(/_/g, " ").toLowerCase()}
          </span>
        </div>
      )}
    </div>
  );
}
