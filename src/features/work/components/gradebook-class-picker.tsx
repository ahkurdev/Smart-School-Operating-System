"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/** A URL-driven dropdown for the gradebook's class picker (server-rendered data). */
export function GradebookClassPicker({ classes, value }: { classes: { id: string; name: string }[]; value?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function change(id: string) {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("class", id);
    else next.delete("class");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Class</span>
      <select
        value={value ?? ""}
        onChange={(e) => change(e.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
      >
        <option value="">Select a class…</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
