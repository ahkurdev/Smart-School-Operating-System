import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Home } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listPages } from "@/server/services/cms.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreatePageDialog } from "@/features/cms/components/create-page-dialog";

export const metadata: Metadata = { title: "Pages — CMS" };

const statusVariant: Record<string, "neutral" | "success" | "warning" | "info"> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

export default async function CmsPagesPage() {
  const actor = await requirePageActor();
  const pages = await listPages(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pages"
        description="Public website pages, built from content blocks."
        breadcrumbs={[{ label: "CMS", href: "/app/cms/pages" }, { label: "Pages" }]}
        actions={can(actor, "cms.create") ? <CreatePageDialog /> : null}
      />

      {pages.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" aria-hidden />}
          title="No pages yet"
          description="Create your first page to start building the school website."
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {pages.map((page) => (
            <li key={page.id}>
              <Link href={`/app/cms/pages/${page.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {page.isHomepage && <Home className="size-4 text-primary" aria-hidden />}
                    <span className="truncate font-medium">{page.title}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    /{page.slug} · {page._count.blocks} blocks
                  </span>
                </div>
                <Badge variant={statusVariant[page.status] ?? "neutral"}>{page.status.toLowerCase()}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
