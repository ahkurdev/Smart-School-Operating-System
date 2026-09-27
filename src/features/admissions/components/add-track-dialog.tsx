"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTrackAction } from "@/features/admissions/actions";

export function AddTrackDialog({ periodId }: { periodId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", code: "", quota: "", requiresTest: false, requiresInterview: false });

  function save() {
    startTransition(async () => {
      const res = await createTrackAction(periodId, {
        name: form.name,
        code: form.code,
        quota: form.quota ? Number(form.quota) : undefined,
        requiresTest: form.requiresTest,
        requiresInterview: form.requiresInterview,
      });
      if (res.ok) {
        toast.success("Track added");
        setOpen(false);
        setForm({ name: "", code: "", quota: "", requiresTest: false, requiresInterview: false });
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> Add track
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="track-name">Name</Label>
          <Input id="track-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="track-code">Code</Label>
          <Input id="track-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="REGULER" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="track-quota">Quota</Label>
          <Input id="track-quota" type="number" min={1} value={form.quota} onChange={(e) => setForm({ ...form, quota: e.target.value })} />
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 rounded border-border" checked={form.requiresTest} onChange={(e) => setForm({ ...form, requiresTest: e.target.checked })} /> Requires test
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 rounded border-border" checked={form.requiresInterview} onChange={(e) => setForm({ ...form, requiresInterview: e.target.checked })} /> Requires interview
        </label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={pending || !form.name || !form.code}>
          {pending ? "Saving…" : "Save track"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
