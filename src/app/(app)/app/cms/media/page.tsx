import type { Metadata } from "next";
import { ImageIcon } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listMedia } from "@/server/services/cms.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MediaUploader } from "@/features/cms/components/media-uploader";
import { MediaCard } from "@/features/cms/components/media-card";

export const metadata: Metadata = { title: "Media — CMS" };

export default async function CmsMediaPage() {
  const actor = await requirePageActor();
  const assets = await listMedia(actor);
  const canManage = can(actor, "media.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media"
        description="Images and documents used across the website."
        breadcrumbs={[{ label: "CMS", href: "/app/cms/pages" }, { label: "Media" }]}
      />
      {canManage && <MediaUploader />}
      {assets.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="size-6" aria-hidden />}
          title="No media yet"
          description="Upload images or documents to reuse them across pages and posts."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <MediaCard key={asset.id} asset={asset} canDelete={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}
