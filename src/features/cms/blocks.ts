import type { BlockType } from "@/server/services/cms.service";

/**
 * Block catalogue for the editor (Phase 25).
 *
 * A closed, curated set — the editor offers only these kinds and each maps to a
 * `CmsBlockType` the renderer knows how to draw. `defaults()` seeds sensible,
 * valid data so a freshly added block always passes server-side validation.
 */

export type BlockKind = string;

export type EditorBlock = {
  /** Client-only React key; never persisted. */
  key: string;
  type: BlockType;
  data: Record<string, unknown>;
};

export const BLOCK_LIBRARY: { kind: BlockKind; label: string; type: BlockType }[] = [
  { kind: "heading", label: "Heading", type: "HEADING" },
  { kind: "paragraph", label: "Paragraph", type: "PARAGRAPH" },
  { kind: "rich-text", label: "Rich text", type: "RICH_TEXT" },
  { kind: "image", label: "Image", type: "IMAGE" },
  { kind: "gallery", label: "Gallery", type: "GALLERY" },
  { kind: "video", label: "Video", type: "VIDEO" },
  { kind: "button", label: "Button", type: "BUTTON" },
  { kind: "cta", label: "Call to action", type: "CTA" },
  { kind: "statistics", label: "Statistics", type: "STATISTICS" },
  { kind: "faq", label: "FAQ", type: "FAQ" },
  { kind: "table", label: "Table", type: "TABLE" },
  { kind: "download", label: "Download", type: "DOWNLOAD" },
  { kind: "map", label: "Map", type: "MAP" },
  { kind: "embed", label: "Embed (sandboxed HTML)", type: "EMBED" },
  { kind: "staff-listing", label: "Staff listing (dynamic)", type: "STAFF_LISTING" },
  { kind: "announcement-list", label: "Announcement list (dynamic)", type: "ANNOUNCEMENT_LIST" },
  { kind: "event-list", label: "Event list (dynamic)", type: "EVENT_LIST" },
];

/** Seed data that always satisfies `validateBlock` for the given type. */
export function defaultData(type: BlockType): Record<string, unknown> {
  switch (type) {
    case "HEADING":
      return { text: "New heading", level: 2 };
    case "PARAGRAPH":
      return { text: "" };
    case "RICH_TEXT":
      return { html: "" };
    case "IMAGE":
      return { fileId: "", alt: "" };
    case "GALLERY":
      return { fileIds: [] };
    case "VIDEO":
      return { url: "" };
    case "BUTTON":
      return { label: "Learn more", href: "#" };
    case "CTA":
      return { title: "", body: "", label: "Get started", href: "#" };
    case "STATISTICS":
      return { items: [{ value: "0", label: "Metric" }] };
    case "FAQ":
      return { items: [{ q: "Question", a: "Answer" }] };
    case "TABLE":
      return { rows: [["Header", "Header"], ["Cell", "Cell"]] };
    case "DOWNLOAD":
      return { fileId: "", label: "Download" };
    case "MAP":
      return { lat: 0, lng: 0 };
    case "EMBED":
    case "CUSTOM_HTML":
      return { html: "" };
    default:
      return {};
  }
}
