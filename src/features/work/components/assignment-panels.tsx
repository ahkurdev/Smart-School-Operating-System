"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { setAssignmentStatusAction, submitAssignmentAction, gradeSubmissionAction } from "@/features/work/actions";

export function AssignmentStatusControls({ id, status, canManage }: { id: string; status: string; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function set(next: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    startTransition(async () => {
      const res = await setAssignmentStatusAction(id, next);
      if (res.ok) {
        toast.success(`Assignment ${next.toLowerCase()}`);
        router.refresh();
      } else toast.error(res.error);
    });
  }
  if (!canManage) return null;
  return (
    <div className="flex gap-2">
      {status === "DRAFT" && (
        <Button size="sm" onClick={() => set("PUBLISHED")} disabled={pending}>
          Publish
        </Button>
      )}
      {status === "PUBLISHED" && (
        <Button size="sm" variant="outline" onClick={() => set("ARCHIVED")} disabled={pending}>
          Archive
        </Button>
      )}
      {status !== "DRAFT" && (
        <Button size="sm" variant="ghost" onClick={() => set("DRAFT")} disabled={pending}>
          Back to draft
        </Button>
      )}
    </div>
  );
}

export function SubmitPanel({ assignmentId, existing }: { assignmentId: string; existing: { status: string; score: number | null } | null }) {
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const res = await submitAssignmentAction(assignmentId, content);
      if (res.ok) {
        toast.success("Submitted");
        setContent("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <h2 className="font-medium">Your submission</h2>
      {existing && (
        <p className="text-sm text-muted-foreground">
          Status: <Badge variant={existing.status === "GRADED" ? "success" : "info"}>{existing.status.toLowerCase()}</Badge>
          {existing.score != null ? ` · scored ${existing.score}` : ""}
        </p>
      )}
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Write your answer or a note for your teacher…" />
      <Button onClick={submit} disabled={pending || content.trim().length === 0}>
        {pending ? "Submitting…" : existing ? "Resubmit" : "Submit work"}
      </Button>
    </div>
  );
}

export function GradePanel({
  submissionId,
  studentName,
  score,
  maxScore,
  feedback,
}: {
  submissionId: string;
  studentName: string;
  score: number | null;
  maxScore: number;
  feedback: string | null;
}) {
  const [value, setValue] = useState(score?.toString() ?? "");
  const [note, setNote] = useState(feedback ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      const res = await gradeSubmissionAction(submissionId, Number(value), note);
      if (res.ok) {
        toast.success("Grade saved");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-sm font-medium">{studentName}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={0}
          max={maxScore}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24"
          aria-label={`Score for ${studentName}`}
        />
        <span className="text-sm text-muted-foreground">/ {maxScore}</span>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Feedback" className="min-w-48 flex-1" />
        <Button size="sm" onClick={save} disabled={pending || value === ""}>
          Save
        </Button>
      </div>
    </div>
  );
}
