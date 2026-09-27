"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { updatePageAction } from "@/features/cms/actions";

export function PageSettingsForm({
  page,
  canEdit,
}: {
  page: { id: string; title: string; slug: string; description: string; isHomepage: boolean };
  canEdit: boolean;
}) {
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [description, setDescription] = useState(page.description);
  const [isHomepage, setIsHomepage] = useState(page.isHomepage);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      const res = await updatePageAction(page.id, { title, slug, description, isHomepage });
      if (res.ok) {
        toast.success("Settings saved");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} maxLength={160} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">URL slug</Label>
        <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={!canEdit} maxLength={160} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} maxLength={400} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="isHomepage" checked={isHomepage} onCheckedChange={(v) => setIsHomepage(Boolean(v))} disabled={!canEdit} />
        <Label htmlFor="isHomepage" className="font-normal">
          Use as the school homepage
        </Label>
      </div>
      {canEdit && (
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      )}
    </form>
  );
}
