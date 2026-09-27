import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { listPosts } from "@/server/services/cms.service";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CreatePostDialog } from "@/features/cms/components/create-post-dialog";
import { PostRow } from "@/features/cms/components/post-row";

export const metadata: Metadata = { title: "News — CMS" };

export default async function CmsPostsPage() {
  const actor = await requirePageActor();
  const posts = await listPosts(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="News"
        description="News posts, articles and announcements for the public site."
        breadcrumbs={[{ label: "CMS", href: "/app/cms/pages" }, { label: "News" }]}
        actions={can(actor, "cms.create") ? <CreatePostDialog /> : null}
      />
      {posts.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="size-6" aria-hidden />}
          title="No posts yet"
          description="Publish your first news item to appear on the school website."
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {posts.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              canPublish={can(actor, "cms.publish")}
              canDelete={can(actor, "cms.delete")}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
