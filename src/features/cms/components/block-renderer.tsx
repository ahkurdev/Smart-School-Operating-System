/* eslint-disable @next/next/no-img-element -- CMS images are served from the
   authenticated /api/files route; next/image cannot optimise an origin it does
   not control. */
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { BlockType } from "@/server/services/cms.service";

/**
 * Block renderer for the public website (Phases 24-30).
 *
 * Bounded: only the shapes `cms.service.validateBlock` accepts are rendered.
 * `CUSTOM_HTML`/`EMBED` are the escape hatch for advanced tenants and are
 * injected inside a sandboxed `iframe` (srcDoc) so tenant HTML cannot reach the
 * host page's origin, cookies or session — never `dangerouslySetInnerHTML`.
 */

type Block = { id: string; type: BlockType; data: unknown };

function s(data: unknown, key: string, fallback = ""): string {
  if (typeof data !== "object" || data === null) return fallback;
  const v = (data as Record<string, unknown>)[key];
  return typeof v === "string" ? v : fallback;
}

/** Coerce a block's stored JSON into a plain object for rendering. */
function obj(data: unknown): Record<string, unknown> {
  return typeof data === "object" && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
}

/** Sandboxed frame for tenant-provided raw HTML. */
function SandboxedHtml({ html, title }: { html: string; title: string }) {
  return (
    <iframe
      title={title}
      srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;margin:0;padding:8px;color:#111}</style></head><body>${html}</body></html>`}
      sandbox="allow-same-origin allow-popups"
      className="h-72 w-full rounded-lg border border-border"
      referrerPolicy="no-referrer"
    />
  );
}

function BlockView({ block }: { block: Block }) {
  const d = obj(block.data);
  switch (block.type) {
    case "HEADING": {
      const level = typeof d.level === "number" ? d.level : 2;
      const Tag = (`h${level}` as "h1" | "h2" | "h3" | "h4");
      const size = level === 1 ? "text-4xl sm:text-5xl" : level === 2 ? "text-3xl" : "text-2xl";
      return <Tag className={cn("font-semibold tracking-tight text-balance", size)}>{s(d, "text")}</Tag>;
    }
    case "PARAGRAPH":
      return <p className="text-lg leading-relaxed text-muted-foreground">{s(d, "text")}</p>;
    case "RICH_TEXT":
      // Author-written prose only; rendered as preformatted text to stay safe.
      return <div className="prose-like whitespace-pre-line text-base leading-relaxed">{s(d, "html")}</div>;
    case "IMAGE":
      return (
        <figure className="space-y-2">
          <img
            src={`/api/files/${s(d, "fileId")}`}
            alt={s(d, "alt", "")}
            className="w-full rounded-xl border border-border object-cover"
          />
          {s(d, "caption") && <figcaption className="text-sm text-muted-foreground">{s(d, "caption")}</figcaption>}
        </figure>
      );
    case "GALLERY": {
      const ids = Array.isArray(d.fileIds) ? (d.fileIds as string[]) : [];
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ids.map((id) => (
            <img key={id} src={`/api/files/${id}`} alt="" className="aspect-square w-full rounded-lg border border-border object-cover" />
          ))}
        </div>
      );
    }
    case "VIDEO": {
      const url = s(d, "url");
      const embed = url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com");
      return embed ? (
        <iframe
          title="Embedded video"
          src={url}
          className="aspect-video w-full rounded-xl border border-border"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="no-referrer"
          sandbox="allow-same-origin allow-scripts allow-popups"
        />
      ) : (
        <video src={url} controls className="w-full rounded-xl border border-border" />
      );
    }
    case "BUTTON":
      return (
        <Button asChild>
          <Link href={s(d, "href", "#")}>{s(d, "label", "Learn more")}</Link>
        </Button>
      );
    case "CTA":
      return (
        <div className="rounded-2xl border border-border bg-muted/40 p-8 text-center">
          <h3 className="text-2xl font-semibold">{s(d, "title")}</h3>
          {s(d, "body") && <p className="mt-2 text-muted-foreground">{s(d, "body")}</p>}
          <Button asChild className="mt-4">
            <Link href={s(d, "href", "#")}>{s(d, "label", "Get started")}</Link>
          </Button>
        </div>
      );
    case "STATISTICS": {
      const items = Array.isArray(d.items) ? (d.items as { value?: string; label?: string }[]) : [];
      return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl font-bold tabular-nums">{it.value}</div>
              <div className="text-sm text-muted-foreground">{it.label}</div>
            </div>
          ))}
        </div>
      );
    }
    case "FAQ": {
      const items = Array.isArray(d.items) ? (d.items as { q?: string; a?: string }[]) : [];
      return (
        <div className="divide-y divide-border rounded-xl border border-border">
          {items.map((it, i) => (
            <details key={i} className="group p-4">
              <summary className="cursor-pointer list-none font-medium">{it.q}</summary>
              <p className="mt-2 text-muted-foreground">{it.a}</p>
            </details>
          ))}
        </div>
      );
    }
    case "TABLE": {
      const rows = Array.isArray(d.rows) ? (d.rows as string[][]) : [];
      return (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className={cn("px-4 py-2", i === 0 && "font-medium")}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "DOWNLOAD":
      return (
        <a
          href={`/api/files/${s(d, "fileId")}`}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {s(d, "label", "Download")}
        </a>
      );
    case "MAP": {
      const lat = typeof d.lat === "number" ? d.lat : 0;
      const lng = typeof d.lng === "number" ? d.lng : 0;
      return (
        <iframe
          title="Map"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&marker=${lat},${lng}`}
          className="aspect-video w-full rounded-xl border border-border"
          referrerPolicy="no-referrer"
        />
      );
    }
    case "EMBED":
    case "CUSTOM_HTML":
      return <SandboxedHtml html={s(d, "html")} title={`Block ${block.id}`} />;
    case "STAFF_LISTING":
    case "ANNOUNCEMENT_LIST":
    case "EVENT_LIST":
      return <Badge variant="neutral">{block.type.replace("_", " ").toLowerCase()} (dynamic)</Badge>;
    default:
      return null;
  }
}

export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  if (blocks.length === 0) {
    return <p className="text-muted-foreground">This page has no content yet.</p>;
  }
  return (
    <div className="space-y-8">
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} />
      ))}
    </div>
  );
}
