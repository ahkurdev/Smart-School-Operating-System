"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { saveBlocksAction } from "@/features/cms/actions";
import { BLOCK_LIBRARY, defaultData, type BlockKind, type EditorBlock } from "@/features/cms/blocks";

/** Native select styled like the design-system input (simpler + a11y for menus). */
function NativeSelect({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Block editor (Phases 25-26).
 *
 * Edits a page's block tree in memory and saves the whole list atomically. The
 * block catalogue (`BLOCK_LIBRARY`) is a closed set — authors compose from known
 * block types, they never inject arbitrary markup except via the explicitly
 * sandboxed CUSTOM_HTML block.
 */
export function PageEditor({ pageId, initialBlocks }: { pageId: string; initialBlocks: EditorBlock[] }) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(initialBlocks);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function addBlock(kind: BlockKind) {
    const def = BLOCK_LIBRARY.find((b) => b.kind === kind)!;
    setBlocks((prev) => [
      ...prev,
      { key: crypto.randomUUID(), type: def.type, data: defaultData(def.type) },
    ]);
  }

  function removeBlock(key: string) {
    setBlocks((prev) => prev.filter((b) => b.key !== key));
  }

  function move(key: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.key === key);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const a = copy[idx];
      const b = copy[next];
      if (!a || !b) return prev;
      copy[idx] = b;
      copy[next] = a;
      return copy;
    });
  }

  function updateField(key: string, field: string, value: unknown) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.key !== key) return b;
        // "__replace__" swaps the whole data object (used by JSON textareas).
        if (field === "__replace__") return { ...b, data: value as Record<string, unknown> };
        return { ...b, data: { ...b.data, [field]: value } };
      }),
    );
  }

  function save() {
    startTransition(async () => {
      const res = await saveBlocksAction(
        pageId,
        blocks.map((b) => ({ type: b.type, data: b.data })),
      );
      if (res.ok) {
        toast.success("Page saved");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NativeSelect
            aria-label="Add a block"
            className="w-56"
            value=""
            onChange={(e) => {
              if (e.target.value) addBlock(e.target.value as BlockKind);
            }}
          >
            <option value="">Add block…</option>
            {BLOCK_LIBRARY.map((b) => (
              <option key={b.kind} value={b.kind}>
                {b.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button onClick={save} disabled={pending} aria-busy={pending}>
          <Save className="size-4" aria-hidden /> {pending ? "Saving…" : "Save page"}
        </Button>
      </div>

      {blocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No blocks yet. Add one from the menu above.
        </p>
      ) : (
        <ol className="space-y-4">
          {blocks.map((block, i) => (
            <li key={block.key}>
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {BLOCK_LIBRARY.find((b) => b.type === block.type)?.label ?? block.type}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => move(block.key, -1)} disabled={i === 0} aria-label="Move up">
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => move(block.key, 1)} disabled={i === blocks.length - 1} aria-label="Move down">
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeBlock(block.key)} aria-label="Remove block">
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <BlockFields block={block} onChange={updateField} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function BlockFields({
  block,
  onChange,
}: {
  block: EditorBlock;
  onChange: (key: string, field: string, value: unknown) => void;
}) {
  const d = block.data;
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const num = (k: string) => (typeof d[k] === "number" ? (d[k] as number) : 0);

  switch (block.type) {
    case "HEADING":
      return (
        <>
          <Field label="Text">
            <Input value={str("text")} onChange={(e) => onChange(block.key, "text", e.target.value)} />
          </Field>
          <Field label="Level">
            <NativeSelect value={String(num("level") || 2)} onChange={(e) => onChange(block.key, "level", Number(e.target.value))}>
              {[1, 2, 3, 4].map((l) => (
                <option key={l} value={l}>
                  H{l}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </>
      );
    case "PARAGRAPH":
      return (
        <Field label="Text">
          <Textarea value={str("text")} rows={4} onChange={(e) => onChange(block.key, "text", e.target.value)} />
        </Field>
      );
    case "RICH_TEXT":
      return (
        <Field label="Prose (plain text; line breaks are preserved)">
          <Textarea value={str("html")} rows={8} onChange={(e) => onChange(block.key, "html", e.target.value)} />
        </Field>
      );
    case "IMAGE":
      return (
        <>
          <Field label="File ID">
            <Input value={str("fileId")} onChange={(e) => onChange(block.key, "fileId", e.target.value)} placeholder="Paste a media file id" />
          </Field>
          <Field label="Alt text (accessibility)">
            <Input value={str("alt")} onChange={(e) => onChange(block.key, "alt", e.target.value)} />
          </Field>
        </>
      );
    case "BUTTON":
      return (
        <>
          <Field label="Label">
            <Input value={str("label")} onChange={(e) => onChange(block.key, "label", e.target.value)} />
          </Field>
          <Field label="Link">
            <Input value={str("href")} onChange={(e) => onChange(block.key, "href", e.target.value)} placeholder="/apply" />
          </Field>
        </>
      );
    case "CTA":
      return (
        <>
          <Field label="Title">
            <Input value={str("title")} onChange={(e) => onChange(block.key, "title", e.target.value)} />
          </Field>
          <Field label="Body">
            <Textarea value={str("body")} rows={2} onChange={(e) => onChange(block.key, "body", e.target.value)} />
          </Field>
          <Field label="Link">
            <Input value={str("href")} onChange={(e) => onChange(block.key, "href", e.target.value)} />
          </Field>
        </>
      );
    case "VIDEO":
      return (
        <Field label="Video URL">
          <Input value={str("url")} onChange={(e) => onChange(block.key, "url", e.target.value)} placeholder="https://" />
        </Field>
      );
    case "MAP":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Latitude">
            <Input type="number" value={num("lat")} onChange={(e) => onChange(block.key, "lat", Number(e.target.value))} />
          </Field>
          <Field label="Longitude">
            <Input type="number" value={num("lng")} onChange={(e) => onChange(block.key, "lng", Number(e.target.value))} />
          </Field>
        </div>
      );
    case "GALLERY":
    case "STATISTICS":
    case "FAQ":
    case "TABLE":
      return (
        <Field label="Structured data (JSON)">
          <Textarea
            value={JSON.stringify(d, null, 2)}
            rows={6}
            className="font-mono text-xs"
            onChange={(e) => {
              try {
                onChange(block.key, "__replace__", JSON.parse(e.target.value));
              } catch {
                /* keep the raw text until it parses */
              }
            }}
          />
          <p className="text-xs text-muted-foreground">Edit the JSON directly. Advanced fields are validated on save.</p>
        </Field>
      );
    case "EMBED":
    case "CUSTOM_HTML":
      return (
        <Field label="HTML (rendered in a sandboxed frame)">
          <Textarea value={str("html")} rows={6} className="font-mono text-xs" onChange={(e) => onChange(block.key, "html", e.target.value)} />
        </Field>
      );
    default:
      return <p className="text-sm text-muted-foreground">This block is configured automatically.</p>;
  }
}
