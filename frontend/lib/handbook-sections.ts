// Client-safe handbook constants — NO node:fs imports, so this module can be
// pulled into client components (the tab bar) without dragging the filesystem
// docs library into the browser bundle. lib/handbook.ts re-exports these.

export const HANDBOOK_SECTIONS = [
  { slug: "get-started", title: "Get Started" },
  { slug: "vision", title: "Vision" },
  { slug: "bots", title: "Bots" },
  { slug: "index", title: "Index" },
  { slug: "developers", title: "Developers" },
] as const;

export type HandbookSection = (typeof HANDBOOK_SECTIONS)[number]["slug"];

/** All handbook routes mount under this base — /docs/{section}/{slug}. */
export const DOCS_BASE = "/docs";

export function sectionTitle(section: HandbookSection): string {
  return HANDBOOK_SECTIONS.find((s) => s.slug === section)!.title;
}

export function sectionPath(section: HandbookSection): string {
  return `${DOCS_BASE}/${section}`;
}
