"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEntryAction } from "@/features/timetable/actions";

export function AddEntryForm({
  academicYearId,
  classes,
  subjects,
  teachers,
  rooms,
}: {
  academicYearId: string;
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [f, setF] = useState({
    classroomId: classes[0]?.id ?? "",
    subjectId: subjects[0]?.id ?? "",
    teacherId: "",
    roomId: "",
    dayOfWeek: 1,
    startTime: "07:00",
    endTime: "07:45",
  });

  function submit() {
    startTransition(async () => {
      const res = await createEntryAction({
        academicYearId,
        classroomId: f.classroomId,
        subjectId: f.subjectId,
        teacherId: f.teacherId || undefined,
        roomId: f.roomId || undefined,
        dayOfWeek: f.dayOfWeek,
        startTime: f.startTime,
        endTime: f.endTime,
      });
      if (res.ok) {
        toast.success("Slot added");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const sel = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Class</Label>
          <select className={sel} value={f.classroomId} onChange={(e) => setF({ ...f, classroomId: e.target.value })}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Subject</Label>
          <select className={sel} value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value })}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Teacher</Label>
          <select className={sel} value={f.teacherId} onChange={(e) => setF({ ...f, teacherId: e.target.value })}>
            <option value="">Unassigned</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Room</Label>
          <select className={sel} value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}>
            <option value="">Unassigned</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Day</Label>
          <select className={sel} value={f.dayOfWeek} onChange={(e) => setF({ ...f, dayOfWeek: Number(e.target.value) })}>
            {[["1", "Monday"], ["2", "Tuesday"], ["3", "Wednesday"], ["4", "Thursday"], ["5", "Friday"], ["6", "Saturday"]].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Start</Label>
          <Input type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End</Label>
          <Input type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} />
        </div>
        <div className="flex items-end">
          <Button onClick={submit} disabled={pending || !f.classroomId || !f.subjectId}>
            <Plus className="size-4" aria-hidden /> {pending ? "Adding…" : "Add slot"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Conflicts are checked automatically: a teacher, room or class cannot be double-booked.
      </p>
    </div>
  );
}

export function DeleteEntryButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { deleteEntryAction } = await import("@/features/timetable/actions");
          const res = await deleteEntryAction(id);
          if (res.ok) {
            toast.success("Slot removed");
            router.refresh();
          } else toast.error(res.error);
        })
      }
      className="text-xs text-destructive hover:underline disabled:opacity-50"
      aria-label="Remove slot"
    >
      remove
    </button>
  );
}
