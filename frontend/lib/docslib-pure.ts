// The isomorphic half of the docs library — types and pure helpers that carry
// no filesystem dependency, so client components can import them without
// dragging node:fs/node:path into the browser bundle. The fs-bound reader
// (createDocsLib) lives in ./docslib and re-exports everything here.

export interface DocMeta {
  slug: string;
  title: string;
  /** Short label for the sidebar and pager when the H1 title is a long headline. */
  navTitle?: string;
  description?: string;
  /** "center" centres the hero on landing pages, mirroring Morpho's get-started. */
  heroAlign?: "center";
  order: number;
  group: string;
  /** HTTP method for API-reference pages — renders a coloured pill in the nav. */
  method?: string;
  /**
   * When set, the sidebar entry is a cross-section pointer, not a page link: it
   * navigates here (e.g. a page that really lives in another tab) and carries an
   * up-right arrow to mark that it leaves the current section.
   */
  linkTo?: string;
  /** Estimated reading time in minutes, from the body word count at 200 wpm. */
  readMinutes: number;
}

export interface Doc extends DocMeta {
  body: string;
}

export interface DocGroup {
  title: string;
  pages: DocMeta[];
}

/**
 * A page in the sidebar tree. A leaf is a single page. A branch is a page that
 * also owns children — pages whose slug sits one level below its own
 * (`vision-api` owns `vision-api/batches`). The branch page stays
 * clickable as the heading of its sub-group.
 */
export interface DocNode {
  doc: DocMeta;
  children: DocNode[];
}

export interface SearchHeading {
  text: string;
  id: string;
}

export interface SearchDoc {
  slug: string;
  title: string;
  description?: string;
  headings: SearchHeading[];
}

/**
 * Fold a flat, order-sorted page list into a one-level-deep nav tree.
 *
 * A page nests under another page in the same list when its slug is exactly
 * `<parent.slug>/<segment>` — the parent owns the directory the child lives in.
 * This is inferred from the slug path alone, so it works for any section: a
 * "Contracts" index at `resources/contracts` collects the per-contract specs at
 * `resources/contracts/*` beneath it, while every other page stays flat.
 *
 * Children keep their document order. A child whose parent page does not exist
 * in the list falls back to a top-level leaf, so nothing is ever dropped.
 */
export function nestPages(pages: DocMeta[]): DocNode[] {
  const bySlug = new Map<string, DocNode>();
  for (const doc of pages) bySlug.set(doc.slug, { doc, children: [] });

  const roots: DocNode[] = [];
  for (const doc of pages) {
    const node = bySlug.get(doc.slug)!;
    const parentSlug = doc.slug.includes("/")
      ? doc.slug.slice(0, doc.slug.lastIndexOf("/"))
      : "";
    const parent = parentSlug ? bySlug.get(parentSlug) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Reading time in minutes from a markdown body, at 200 words per minute. */
export function readMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Mirror rehype-slug / github-slugger for the common ASCII heading case. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    // Each whitespace char becomes its own hyphen — github-slugger does not
    // collapse runs, so "Collateral & custody" → "collateral--custody".
    .replace(/\s/g, "-");
}
