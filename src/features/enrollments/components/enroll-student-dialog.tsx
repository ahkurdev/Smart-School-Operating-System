"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { UserPlus, Search } from "lucide-react";
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
import {
  enrollStudentAction,
  searchEnrollableStudentsAction,
} from "@/features/enrollments/actions";

type Candidate = { id: string; fullName: string; studentNumber: string };

export function EnrollStudentDialog({
  classroomId,
  academicYearId,
  className,
}: {
  classroomId: string;
  academicYearId: string;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [pending, start] = useTransition();
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCandidates([]);
      setSelected(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const res = await searchEnrollableStudentsAction(academicYearId, query);
      if (id === reqId.current) setCandidates(res);
    }, 200);
    return () => clearTimeout(t);
  }, [query, open, academicYearId]);

  function enroll() {
    if (!selected) return;
    const fd = new FormData();
    fd.set("studentId", selected.id);
    fd.set("classroomId", classroomId);
    fd.set("academicYearId", academicYearId);
    start(async () => {
      const res = await enrollStudentAction(undefined, fd);
      if (res.ok) {
        toast.success(res.message ?? "Enrolled");
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" aria-hidden /> Enroll student
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll a student</DialogTitle>
          <DialogDescription>
            Add an enrolled student to {className}. Only students without an active enrollment this year are listed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="candidate-search">Find student</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="candidate-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or number"
                className="pl-9"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-md border border-border">
            {candidates.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                {query.trim().length === 0 ? "Type to search students." : "No matching unenrolled students."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {candidates.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(c)}
                      className={
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted " +
                        (selected?.id === c.id ? "bg-muted" : "")
                      }
                      aria-pressed={selected?.id === c.id}
                    >
                      <span className="font-medium">{c.fullName}</span>
                      <span className="font-mono text-xs text-muted-foreground">{c.studentNumber}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={enroll} disabled={!selected || pending}>
              {pending ? "Enrolling…" : "Enroll student"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
