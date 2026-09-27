import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { getPage } from "@/server/services/cms.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { PageEditor } from "@/features/cms/components/page-editor";
import { PageStatusBar } from "@/features/cms/components/page-status-bar";
import { PageSettingsForm } from "@/features/cms/components/page-settings-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Edit page — CMS" };

export default async function EditCmsPagePage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const actor = await requirePageActor();
  const page = await getPage(actor, pageId).catch(() => null);
  if (!page) notFound();

  const canEdit = can(actor, "cms.update");
  const canPublish = can(actor, "cms.publish");
  const canDelete = can(actor, "cms.delete");

  const editorBlocks = page.blocks.map((b) => ({
    key: b.id,
    type: b.type,
    data: (b.data ?? {}) as Record<string, unknown>,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={page.title}
        description={`/${page.slug}`}
        breadcrumbs={[
          { label: "CMS", href: "/app/cms/pages" },
          { label: "Pages", href: "/app/cms/pages" },
          { label: page.title },
        ]}
        actions={
          <Link
            href={`/app/cms/pages/${page.id}/preview`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Preview <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        }
      />

      <PageStatusBar pageId={page.id} status={page.status} canPublish={canPublish} canDelete={canDelete} />

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="pt-6">
          {canEdit ? (
            <PageEditor pageId={page.id} initialBlocks={editorBlocks} />
          ) : (
            <p className="text-muted-foreground">You do not have permission to edit this page.</p>
          )}
        </TabsContent>
        <TabsContent value="settings" className="pt-6">
          <PageSettingsForm
            page={{
              id: page.id,
              title: page.title,
              slug: page.slug,
              description: page.description ?? "",
              isHomepage: page.isHomepage,
            }}
            canEdit={canEdit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
