/* eslint-disable @next/next/no-img-element -- CMS images are served from the
   authenticated /api/files route; next/image cannot optimise an origin it does
   not control. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedPost, getTenantBySlug } from "@/server/services/public-content.service";

type Params = { params: Promise<{ tenant: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tenant, slug } = await params;
  const school = await getTenantBySlug(tenant);
  if (!school) return { title: "News" };
  const post = await getPublishedPost(school.id, slug);
  if (!post) return { title: school.name };
  return { title: post.seoTitle ?? `${post.title} — ${school.name}`, description: post.seoDescription ?? post.excerpt ?? undefined };
}

export default async function NewsArticlePage({ params }: Params) {
  const { tenant, slug } = await params;
  const school = await getTenantBySlug(tenant);
  if (!school) notFound();
  const post = await getPublishedPost(school.id, slug);
  if (!post) notFound();

  return (
    <article className="min-h-dvh bg-background">
      <main id="main-content" className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <Link href={`/s/${school.slug}/news`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {school.name} news
        </Link>
        {post.category && (
          <span className="mt-6 block text-xs font-medium uppercase tracking-wide text-primary">{post.category.name}</span>
        )}
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance">{post.title}</h1>
        <time className="mt-3 block text-sm text-muted-foreground">
          {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString(undefined, { dateStyle: "long" }) : ""}
        </time>
        {post.coverFileId && (
          <img src={`/api/files/${post.coverFileId}`} alt="" className="mt-8 w-full rounded-xl border border-border object-cover" />
        )}
        {post.content && (
          <div className="mt-8 whitespace-pre-line text-lg leading-relaxed">{post.content}</div>
        )}
      </main>
    </article>
  );
}
