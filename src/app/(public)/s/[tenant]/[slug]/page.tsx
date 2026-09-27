import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { BlockRenderer } from "@/features/cms/components/block-renderer";
import { getPublishedPage, getTenantBySlug } from "@/server/services/public-content.service";

type Params = { params: Promise<{ tenant: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tenant, slug } = await params;
  const school = await getTenantBySlug(tenant);
  if (!school) return { title: "School" };
  const page = await getPublishedPage(school.id, slug);
  if (!page) return { title: `${school.name}` };
  return {
    title: page.seoTitle ?? `${page.title} — ${school.name}`,
    description: page.seoDescription ?? page.description ?? undefined,
  };
}

export default async function TenantCmsPage({ params }: Params) {
  const { tenant, slug } = await params;
  const school = await getTenantBySlug(tenant);
  if (!school) notFound();
  const page = await getPublishedPage(school.id, slug);
  if (!page) notFound();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href={`/s/${school.slug}`} className="inline-flex items-center gap-2 font-display text-lg font-semibold">
            <GraduationCap className="size-6 text-primary" aria-hidden />
            {school.name}
          </Link>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-balance">{page.title}</h1>
        {page.description && <p className="mt-3 text-lg text-muted-foreground">{page.description}</p>}
        <div className="mt-10">
          <BlockRenderer blocks={page.blocks} />
        </div>
      </main>
    </div>
  );
}
