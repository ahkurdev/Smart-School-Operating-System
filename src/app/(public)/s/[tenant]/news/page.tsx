/* eslint-disable @next/next/no-img-element -- CMS images are served from the
   authenticated /api/files route; next/image cannot optimise an origin it does
   not control. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getTenantBySlug, listPublishedPosts } from "@/server/services/public-content.service";

type Params = { params: Promise<{ tenant: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tenant } = await params;
  const t = await getTenantBySlug(tenant);
  return { title: t ? `News — ${t.name}` : "News" };
}

export default async function TenantNewsPage({ params }: Params) {
  const { tenant } = await params;
  const school = await getTenantBySlug(tenant);
  if (!school) notFound();
  const posts = await listPublishedPosts(school.id, { limit: 50 });

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link href={`/s/${school.slug}`} className="inline-flex items-center gap-2 font-display text-lg font-semibold">
            <GraduationCap className="size-6 text-primary" aria-hidden />
            {school.name}
          </Link>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">News &amp; announcements</h1>
        {posts.length === 0 ? (
          <p className="mt-6 text-muted-foreground">No published news yet.</p>
        ) : (
          <ul className="mt-8 divide-y divide-border">
            {posts.map((post) => (
              <li key={post.slug} className="py-6">
                <Link href={`/s/${school.slug}/news/${post.slug}`} className="group flex gap-4">
                  {post.coverFileId && (
                    <img src={`/api/files/${post.coverFileId}`} alt="" className="size-24 shrink-0 rounded-lg border border-border object-cover" />
                  )}
                  <div>
                    {post.category && (
                      <span className="text-xs font-medium uppercase tracking-wide text-primary">{post.category.name}</span>
                    )}
                    <h2 className="text-xl font-medium group-hover:text-primary">{post.title}</h2>
                    {post.excerpt && <p className="mt-1 text-muted-foreground">{post.excerpt}</p>}
                    <time className="mt-1 block text-sm text-muted-foreground">
                      {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}
                    </time>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
