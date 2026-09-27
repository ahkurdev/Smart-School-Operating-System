import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { getPage } from "@/server/services/cms.service";
import { BlockRenderer } from "@/features/cms/components/block-renderer";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Preview — CMS" };

/**
 * Draft preview (Phase 26). Renders any status for staff with `cms.read`, so an
 * author can see unpublished work. This route is inside the authenticated app
 * shell and never reachable by the public.
 */
export default async function CmsPreviewPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const actor = await requirePageActor();
  const page = await getPage(actor, pageId).catch(() => null);
  if (!page) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 p-3">
        <Link href={`/app/cms/pages/${page.id}`} className="inline-flex items-center gap-1.5 text-sm hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Back to editor
        </Link>
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="size-4" aria-hidden /> Preview — not visible to the public
          <Badge variant={page.status === "PUBLISHED" ? "success" : "neutral"}>{page.status.toLowerCase()}</Badge>
        </span>
      </div>

      <article className="mx-auto max-w-3xl rounded-xl border border-border bg-background p-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-balance">{page.title}</h1>
        {page.description && <p className="mt-3 text-lg text-muted-foreground">{page.description}</p>}
        <div className="mt-10">
          <BlockRenderer blocks={page.blocks} />
        </div>
      </article>
    </div>
  );
}
