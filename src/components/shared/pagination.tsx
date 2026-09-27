import { Button } from "@/components/ui/button";

/**
 * URL-driven pagination for server-rendered lists. Filters are preserved via the
 * `params` map; only `page` is changed. Plain links keep it crawlable and work
 * without JS.
 */
export function Pagination({
  page,
  totalPages,
  total,
  basePath,
  params,
  noun = "item",
}: {
  page: number;
  totalPages: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
  noun?: string;
}) {
  const link = (p: number) => {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) usp.set(k, v);
    usp.set("page", String(p));
    return `${basePath}?${usp.toString()}`;
  };
  const pages = Math.max(1, totalPages);
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <p className="tabular">
        {total} {total === 1 ? noun : `${noun}s`} · page {page} of {pages}
      </p>
      <nav className="flex gap-2" aria-label="Pagination">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <a href={link(page - 1)} rel="prev">
              Previous
            </a>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild variant="outline" size="sm">
            <a href={link(page + 1)} rel="next">
              Next
            </a>
          </Button>
        ) : null}
      </nav>
    </div>
  );
}
