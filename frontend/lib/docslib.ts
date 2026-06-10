import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  type DocMeta,
  type Doc,
  type DocGroup,
  type SearchHeading,
  type SearchDoc,
  readMinutes,
  slugify,
} from "./docslib-pure";

// The types and pure helpers live in ./docslib-pure so client components can
// import them without pulling node:fs into the browser bundle. Re-exported here
// so existing server importers of ./docslib keep their unchanged surface.
export type { DocMeta, Doc, DocGroup, DocNode, SearchHeading, SearchDoc } from "./docslib-pure";
export { nestPages, slugify } from "./docslib-pure";

export interface DocsLib {
  listDocs(): DocMeta[];
  listDocGroups(): DocGroup[];
  loadDoc(slug: string): Doc | null;
  adjacent(slug: string): { prev: DocMeta | null; next: DocMeta | null };
  searchIndex(): SearchDoc[];
}

/**
 * Build a docs library bound to one section directory under content/docs/.
 * `/docs/vision` reads content/docs/vision.
 */
export function createDocsLib(dirName: string): DocsLib {
  const DIR = path.join(process.cwd(), "content", "docs", dirName);

  // A slug is the file path under the content dir, minus the .md, in posix form.
  // Flat docs ("glossary") and nested handbook pages ("concepts/ndf") both pass.
  const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

  // Walk the content dir recursively, returning every .md as a posix relpath.
  function walk(dir: string, prefix = ""): string[] {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
      else if (entry.name.endsWith(".md")) out.push(rel);
    }
    return out;
  }

  function readMeta(file: string): DocMeta {
    const slug = file.replace(/\.md$/, "");
    const { data, content } = matter(fs.readFileSync(path.join(DIR, file), "utf8"));
    return {
      slug,
      title: data.title ?? slug,
      navTitle: typeof data.navTitle === "string" ? data.navTitle : undefined,
      description: data.description,
      heroAlign: data.heroAlign === "center" ? "center" : undefined,
      order: typeof data.order === "number" ? data.order : 99,
      group: typeof data.group === "string" ? data.group : "Docs",
      method: typeof data.method === "string" ? data.method : undefined,
      linkTo: typeof data.linkTo === "string" ? data.linkTo : undefined,
      readMinutes: readMinutes(content),
    };
  }

  function listDocs(): DocMeta[] {
    return walk(DIR)
      .map(readMeta)
      .sort((a, b) => a.order - b.order);
  }

  function listDocGroups(): DocGroup[] {
    const groups: DocGroup[] = [];
    for (const doc of listDocs()) {
      let group = groups.find((g) => g.title === doc.group);
      if (!group) {
        group = { title: doc.group, pages: [] };
        groups.push(group);
      }
      group.pages.push(doc);
    }
    return groups;
  }

  function loadDoc(slug: string): Doc | null {
    if (!SLUG_RE.test(slug)) return null;
    const file = path.join(DIR, `${slug}.md`);
    if (!fs.existsSync(file)) return null;
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    // The title renders in the article header, so drop a leading H1 from the body.
    const body = content.replace(/^\s*#\s+.*\r?\n+/, "");
    return {
      slug,
      title: data.title ?? slug,
      navTitle: typeof data.navTitle === "string" ? data.navTitle : undefined,
      description: data.description,
      heroAlign: data.heroAlign === "center" ? "center" : undefined,
      order: typeof data.order === "number" ? data.order : 99,
      group: typeof data.group === "string" ? data.group : "Docs",
      method: typeof data.method === "string" ? data.method : undefined,
      linkTo: typeof data.linkTo === "string" ? data.linkTo : undefined,
      readMinutes: readMinutes(content),
      body,
    };
  }

  function adjacent(slug: string): { prev: DocMeta | null; next: DocMeta | null } {
    const docs = listDocs();
    const i = docs.findIndex((d) => d.slug === slug);
    return {
      prev: i > 0 ? docs[i - 1] : null,
      next: i >= 0 && i < docs.length - 1 ? docs[i + 1] : null,
    };
  }

  function searchIndex(): SearchDoc[] {
    return listDocs().map((d) => {
      const { content } = matter(fs.readFileSync(path.join(DIR, `${d.slug}.md`), "utf8"));
      const headings: SearchHeading[] = [];
      for (const line of content.split("\n")) {
        const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
        if (!m) continue;
        const text = m[2].replace(/[*_`]/g, "").trim();
        if (text) headings.push({ text, id: slugify(text) });
      }
      return { slug: d.slug, title: d.title, description: d.description, headings };
    });
  }

  return { listDocs, listDocGroups, loadDoc, adjacent, searchIndex };
}
