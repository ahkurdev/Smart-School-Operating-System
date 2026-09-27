"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { createAssessmentAction, type WorkResult } from "@/features/work/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Creating…" : "Create column"}
    </Button>
  );
}

export function CreateAssessmentDialog({
  classes,
  subjects,
  academicYearId,
  defaultClassroomId,
}: {
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  academicYearId: string;
  defaultClassroomId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<WorkResult | null, FormData>(createAssessmentAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Assessment created");
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
        <Button size="sm">
          <Plus className="size-4" aria-hidden /> New assessment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New assessment</DialogTitle>
          <DialogDescription>Add a graded column (quiz, exam, project…) to a class gradebook.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="academicYearId" value={academicYearId} />
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="classroomId">Class</Label>
              <select id="classroomId" name="classroomId" className={sel} defaultValue={defaultClassroomId} required>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subjectId">Subject</Label>
              <select id="subjectId" name="subjectId" className={sel} required>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select id="type" name="type" className={sel} defaultValue="EXAM">
                <option value="EXAM">Exam</option>
                <option value="QUIZ">Quiz</option>
                <option value="ASSIGNMENT">Assignment</option>
                <option value="PROJECT">Project</option>
                <option value="PARTICIPATION">Participation</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxScore">Max score</Label>
              <Input id="maxScore" name="maxScore" type="number" min={1} defaultValue={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight</Label>
              <Input id="weight" name="weight" type="number" min={0} step="0.5" defaultValue={1} />
            </div>
          </div>
          <DialogFooter>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
