/* eslint-disable @next/next/no-img-element -- CMS images are served from the
   authenticated /api/files route; next/image cannot optimise an origin it does
   not control. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { BlockRenderer } from "@/features/cms/components/block-renderer";
import { getHomepage, getTenantBySlug, listPublishedPages, listPublishedPosts } from "@/server/services/public-content.service";

/**
 * Public homepage of a school site (Phase 24/28).
 *
 * The tenant is resolved from the URL segment, not from the session, so this
 * works for anonymous visitors. Only published content is ever queried.
 */

type Params = { params: Promise<{ tenant: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tenant } = await params;
  const t = await getTenantBySlug(tenant);
  return { title: t ? `${t.name} — Home` : "School" };
}

export default async function TenantHomePage({ params }: Params) {
  const { tenant } = await params;
  const school = await getTenantBySlug(tenant);
  if (!school) notFound();

  const [home, pages, posts] = await Promise.all([
    getHomepage(school.id),
    listPublishedPages(school.id),
    listPublishedPosts(school.id, { limit: 3 }),
  ]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href={`/s/${school.slug}`} className="inline-flex items-center gap-2 font-display text-lg font-semibold">
            <GraduationCap className="size-6 text-primary" aria-hidden />
            {school.name}
          </Link>
          <nav className="hidden items-center gap-6 sm:flex" aria-label="Primary">
            {pages.slice(0, 5).map((p) => (
              <Link key={p.slug} href={`/s/${school.slug}/${p.slug}`} className="text-sm text-muted-foreground hover:text-foreground">
                {p.title}
              </Link>
            ))}
            <Link href={`/s/${school.slug}/news`} className="text-sm text-muted-foreground hover:text-foreground">
              News
            </Link>
            <Link href="/apply" className="text-sm font-medium text-primary hover:underline">
              Apply
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {home ? (
          <BlockRenderer blocks={home.blocks} />
        ) : (
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl font-semibold tracking-tight">{school.name}</h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Welcome. This school site has no published homepage content yet.
            </p>
          </div>
        )}

        {posts.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-semibold tracking-tight">Latest news</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {posts.map((post) => (
                <Link key={post.slug} href={`/s/${school.slug}/news/${post.slug}`} className="group">
                  {post.coverFileId && (
                    <img
                      src={`/api/files/${post.coverFileId}`}
                      alt=""
                      className="mb-3 aspect-video w-full rounded-lg border border-border object-cover"
                    />
                  )}
                  <h3 className="font-medium group-hover:text-primary">{post.title}</h3>
                  {post.excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{school.name}</p>
          <p>Powered by Smart School OS</p>
        </div>
      </footer>
    </div>
  );
}
