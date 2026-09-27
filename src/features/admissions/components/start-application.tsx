"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startApplicationAction } from "@/features/admissions/actions";

export function StartApplication({
  periodId,
  tracks,
  needsProfile,
}: {
  periodId: string;
  tracks: { id: string; name: string; requiresTest: boolean; requiresInterview: boolean }[];
  needsProfile: boolean;
}) {
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function start() {
    startTransition(async () => {
      const res = await startApplicationAction(periodId, trackId || undefined);
      if (res.ok && res.id) {
        toast.success("Application started");
        router.push(`/apply/${res.id}`);
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      {needsProfile && (
        <p className="text-sm text-amber-600">Save your profile above before starting an application.</p>
      )}
      {tracks.length > 0 && (
        <div className="space-y-2">
          <label htmlFor="track" className="text-sm font-medium">
            Choose a track
          </label>
          <select
            id="track"
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
            className="flex h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.requiresTest ? " (test)" : ""}
                {t.requiresInterview ? " (interview)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      <Button onClick={start} disabled={pending || needsProfile}>
        {pending ? "Starting…" : "Start application"}
      </Button>
    </div>
  );
}
