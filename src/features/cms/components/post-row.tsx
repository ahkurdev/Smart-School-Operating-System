"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { deletePostAction, setPostStatusAction, updatePostAction } from "@/features/cms/actions";

const variant: Record<string, "neutral" | "success" | "warning" | "info"> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

export function PostRow({
  post,
  canPublish,
  canDelete,
}: {
  post: {
    id: string;
    title: string;
    slug: string;
    type: string;
    status: string;
    publishedAt: Date | null;
    category: { name: string } | null;
  };
  canPublish: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: post.title, slug: post.slug, excerpt: "", content: "" });
  const router = useRouter();

  function save() {
    startTransition(async () => {
      const res = await updatePostAction(post.id, {
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt || undefined,
        content: form.content || undefined,
      });
      if (res.ok) {
        toast.success("Post saved");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function setStatus(status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    startTransition(async () => {
      const res = await setPostStatusAction(post.id, status);
      if (res.ok) {
        toast.success(`Post ${status.toLowerCase()}`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deletePostAction(post.id);
      if (res.ok) {
        toast.success("Post deleted");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{post.title}</span>
          <Badge variant="outline">{post.type.toLowerCase()}</Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          /{post.slug}
          {post.category ? ` · ${post.category.name}` : ""}
          {post.publishedAt ? ` · ${new Date(post.publishedAt).toLocaleDateString()}` : ""}
        </span>
        {open && (
          <div className="mt-3 space-y-2">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Title" />
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} aria-label="Slug" />
            <Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="Excerpt" aria-label="Excerpt" />
            <Textarea rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Content" aria-label="Content" />
            <Button size="sm" onClick={save} disabled={pending}>
              Save
            </Button>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={variant[post.status] ?? "neutral"}>{post.status.toLowerCase()}</Badge>
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Edit"}
        </Button>
        {canPublish && post.status !== "PUBLISHED" && (
          <Button size="sm" variant="outline" onClick={() => setStatus("PUBLISHED")} disabled={pending}>
            Publish
          </Button>
        )}
        {canPublish && post.status === "PUBLISHED" && (
          <Button size="sm" variant="outline" onClick={() => setStatus("ARCHIVED")} disabled={pending}>
            Archive
          </Button>
        )}
        {canDelete && (
          <Button size="sm" variant="ghost" onClick={remove} disabled={pending}>
            Delete
          </Button>
        )}
      </div>
    </li>
  );
}
