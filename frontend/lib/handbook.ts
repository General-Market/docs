import { createDocsLib, type DocsLib, type DocMeta } from "./docslib";
import {
  HANDBOOK_SECTIONS,
  sectionPath,
  type HandbookSection,
} from "./handbook-sections";

export type { DocMeta, Doc, DocGroup, DocNode, SearchHeading, SearchDoc } from "./docslib";
export { nestPages } from "./docslib";
// Re-export the client-safe constants so server code has one import site.
export {
  HANDBOOK_SECTIONS,
  DOCS_BASE,
  sectionTitle,
  sectionPath,
  type HandbookSection,
} from "./handbook-sections";

const libs: Record<HandbookSection, DocsLib> = {
  "get-started": createDocsLib("get-started"),
  vision: createDocsLib("vision"),
  bots: createDocsLib("bots"),
  index: createDocsLib("index"),
  developers: createDocsLib("developers"),
};

export function isHandbookSection(value: string): value is HandbookSection {
  return value in libs;
}

export function handbookLib(section: HandbookSection): DocsLib {
  return libs[section];
}

/** One page in the global reading order, tagged with the section it lives in. */
export interface HandbookEntry {
  section: HandbookSection;
  doc: DocMeta;
  /** The resolved href, e.g. /docs/vision/payouts. */
  href: string;
}

/**
 * The whole handbook in one flat reading order — every section's pages, in
 * section order, each section's pages in document order. This is what lets the
 * prev/next pager flow across section boundaries, the way Morpho's docs do.
 */
export function handbookOrder(): HandbookEntry[] {
  const out: HandbookEntry[] = [];
  for (const { slug } of HANDBOOK_SECTIONS) {
    for (const doc of libs[slug].listDocs()) {
      out.push({ section: slug, doc, href: `${sectionPath(slug)}/${doc.slug}` });
    }
  }
  return out;
}

/** Prev/next across the entire handbook, not just within one section. */
export function handbookAdjacent(
  section: HandbookSection,
  slug: string,
): { prev: HandbookEntry | null; next: HandbookEntry | null } {
  const order = handbookOrder();
  const i = order.findIndex((e) => e.section === section && e.doc.slug === slug);
  return {
    prev: i > 0 ? order[i - 1] : null,
    next: i >= 0 && i < order.length - 1 ? order[i + 1] : null,
  };
}

/** One doc flattened to plain text — the retrieval corpus for the docs AI. */
export interface CorpusDoc {
  /** Section-qualified slug, e.g. "vision/payouts". */
  slug: string;
  title: string;
  description?: string;
  href: string;
  plainText: string;
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every handbook page as searchable plain text, for the Ask-AI retrieval. */
export function docsCorpus(): CorpusDoc[] {
  const out: CorpusDoc[] = [];
  for (const entry of handbookOrder()) {
    const doc = libs[entry.section].loadDoc(entry.doc.slug);
    if (!doc) continue;
    out.push({
      slug: `${entry.section}/${entry.doc.slug}`,
      title: doc.title,
      description: doc.description,
      href: entry.href,
      plainText: stripMarkdown(doc.body),
    });
  }
  return out;
}
