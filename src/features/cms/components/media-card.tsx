/* eslint-disable @next/next/no-img-element -- CMS images are served from the
   authenticated /api/files route; next/image cannot optimise an origin it does
   not control. */
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MediaCard({
  asset,
  canDelete,
}: {
  asset: {
    id: string;
    title: string | null;
    alt: string | null;
    fileId: string;
    file: { fileName: string; mimeType: string | null; size: number } | null;
  };
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isImage = asset.file?.mimeType?.startsWith("image/");
  const url = `/api/files/${asset.fileId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  function remove() {
    startTransition(async () => {
      const { deleteMediaAction } = await import("@/features/cms/actions");
      const res = await deleteMediaAction(asset.id);
      if (res.ok) {
        toast.success("Removed from library");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex aspect-video items-center justify-center bg-muted">
        {isImage ? (
          <img src={url} alt={asset.alt ?? ""} className="size-full object-cover" />
        ) : (
          <FileText className="size-10 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="space-y-2 p-3">
        <p className="truncate text-sm font-medium" title={asset.title ?? asset.file?.fileName}>
          {asset.title ?? asset.file?.fileName ?? "Untitled"}
        </p>
        <p className="text-xs text-muted-foreground">
          {asset.file ? `${(asset.file.size / 1024).toFixed(0)} KB` : ""}
        </p>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={copy} aria-label="Copy URL">
            <Copy className="size-4" />
          </Button>
          {canDelete && (
            <Button size="sm" variant="ghost" onClick={remove} disabled={pending} aria-label="Delete">
              <Trash2 className="size-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
