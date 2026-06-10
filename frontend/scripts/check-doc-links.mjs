// Dead-link + fence sweep for the docs handbook (content/docs/<section>/**.md).
//
// It validates every internal link a reader can actually click — prose
// `[text](/path)` links, image/asset paths, the JSON `href`s in `gmcards` /
// `gmseealso` widgets, and the `#anchor` jumps a `gmsummary` box builds.
// Resolution mirrors `resolveHref` (app/docs/_shared.tsx) and the heading-id
// scheme mirrors rehype-slug (github-slugger), so a green run means a green
// render.
//
// It ALSO validates the custom fences themselves:
//   - ```gmflow bodies must be one of the 7 registry diagram ids
//   - ```gm-try bodies must parse as JSON with {method, path} and well-formed
//     params ({name, in: "query"|"path"})
//   - ```gmseealso bodies must be a JSON array of {title, href}
//   - ```gmcards bodies must be a JSON array of cards (or {cards: [...]}),
//     each with a title
//
// Run: `npm run check:links` (from frontend/). Exits non-zero on any failure.
// Escape hatch: GM_SKIP_LINKS=1 skips the check (used to unblock a build).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.GM_SKIP_LINKS === "1") {
  console.log("⤳ GM_SKIP_LINKS=1 — docs link check skipped.");
  process.exit(0);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(here, "..");
const CONTENT = path.join(FRONTEND, "content", "docs");
const PUBLIC = path.join(FRONTEND, "public");
const APP = path.join(FRONTEND, "app");

// The five handbook sections (lib/handbook-sections.ts); routes mount at
// /docs/<section>/<slug>.
const SECTIONS = ["get-started", "vision", "bots", "index", "developers"];
const DOCS_BASE = "/docs";

// The diagram registry (components/docs/GmFlow.tsx · docs/docs-rebuild/spec.md).
const GMFLOW_IDS = new Set([
  "vision-block-lifecycle",
  "vision-sealed-commitment",
  "vision-parimutuel",
  "bot-loop",
  "index-order-lifecycle",
  "index-two-chain",
  "gm-system",
]);

// ── slug helpers ───────────────────────────────────────────────────────────

// The repo's own slugify (lib/docslib-pure.ts) — what gmsummary and DocsSearch
// use to BUILD an anchor. The real heading id rendered into the DOM comes from
// github-slugger (below); a divergence between the two is itself a dead anchor.
function repoSlugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s/g, "-");
}

// github-slugger, loaded if present (a transitive dep of rehype-slug, so it's
// there after `npm install`). It is what rehype-slug actually stamps onto every
// heading, including the `-1`/`-2` dedup suffixes. Fall back to the repo
// slugify (no dedup) when running without node_modules.
let SluggerClass = null;
try {
  ({ default: SluggerClass } = await import("github-slugger"));
} catch {
  /* fall back below */
}

/** Heading ids for one body, in document order, with real dedup counters. */
function headingIds(headings) {
  const ids = new Set();
  if (SluggerClass) {
    const s = new SluggerClass();
    for (const h of headings) ids.add(s.slug(h));
  } else {
    const seen = new Map();
    for (const h of headings) {
      const base = repoSlugify(h);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      ids.add(n === 0 ? base : `${base}-${n}`);
    }
  }
  return ids;
}

// ── fence-body validators ──────────────────────────────────────────────────

function validateGmTry(body) {
  let spec;
  try {
    spec = JSON.parse(body);
  } catch (e) {
    return `gm-try body is not valid JSON: ${e.message}`;
  }
  if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
    return "gm-try body must be a JSON object";
  }
  if (typeof spec.method !== "string" || !spec.method) return "gm-try spec is missing `method`";
  if (typeof spec.path !== "string" || !spec.path.startsWith("/")) {
    return "gm-try spec is missing a `/`-prefixed `path`";
  }
  if (spec.params !== undefined && spec.params !== null) {
    if (!Array.isArray(spec.params)) return "gm-try `params` must be an array";
    for (const p of spec.params) {
      if (typeof p !== "object" || p === null || typeof p.name !== "string" || !p.name) {
        return "gm-try param entries need a string `name`";
      }
      if (p.in !== undefined && p.in !== "query" && p.in !== "path") {
        return `gm-try param "${p.name}" has in="${p.in}" (must be query|path)`;
      }
    }
  }
  return null;
}

function validateGmSeeAlso(body) {
  let spec;
  try {
    spec = JSON.parse(body);
  } catch (e) {
    return `gmseealso body is not valid JSON: ${e.message}`;
  }
  if (!Array.isArray(spec)) return "gmseealso body must be a JSON array";
  for (const item of spec) {
    if (typeof item !== "object" || item === null) return "gmseealso entries must be objects";
    if (typeof item.title !== "string" || !item.title) return "gmseealso entry is missing `title`";
    if (typeof item.href !== "string" || !item.href) return "gmseealso entry is missing `href`";
  }
  return null;
}

function validateGmCards(body) {
  let spec;
  try {
    spec = JSON.parse(body);
  } catch (e) {
    return `gmcards body is not valid JSON: ${e.message}`;
  }
  const cards = Array.isArray(spec) ? spec : spec?.cards;
  if (!Array.isArray(cards)) return "gmcards body must be a JSON array (or {cards: [...]})";
  for (const card of cards) {
    if (typeof card !== "object" || card === null) return "gmcards entries must be objects";
    if (typeof card.title !== "string" || !card.title) return "gmcards entry is missing `title`";
  }
  return null;
}

// ── parse one markdown file ────────────────────────────────────────────────

/**
 * Pull the link + fence surface out of a markdown file.
 * Returns { linkTo, headings, links, fenceErrors }.
 */
function parseDoc(raw) {
  let body = raw;
  let linkTo = null;

  // Strip + read frontmatter (only `linkTo` matters for link checking).
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (fm) {
    const m = /^linkTo:\s*["']?([^"'\r\n]+)["']?\s*$/m.exec(fm[1]);
    if (m) linkTo = m[1].trim();
    body = raw.slice(fm[0].length);
  }

  // loadDoc() drops a leading H1 — the title renders in the header, outside the
  // markdown, so it never becomes an anchor. Mirror that before scanning.
  body = body.replace(/^\s*#\s+.*\r?\n+/, "");

  const headings = [];
  const links = [];
  const fenceErrors = [];
  let fence = null; // null, or the fence language string when inside a fence.
  let fenceBody = [];

  const closeFence = (lang, lines) => {
    const text = lines.join("\n").trim();
    if (lang === "gmflow") {
      if (!GMFLOW_IDS.has(text)) {
        fenceErrors.push(`unknown gmflow diagram id "${text}" (registry: ${[...GMFLOW_IDS].join(", ")})`);
      }
    } else if (lang === "gm-try") {
      const err = validateGmTry(text);
      if (err) fenceErrors.push(err);
    } else if (lang === "gmseealso") {
      const err = validateGmSeeAlso(text);
      if (err) fenceErrors.push(err);
    } else if (lang === "gmcards") {
      const err = validateGmCards(text);
      if (err) fenceErrors.push(err);
    }
  };

  for (const line of body.split("\n")) {
    const fenceTok = /^\s*```(\S*)/.exec(line);
    if (fenceTok) {
      if (fence === null) {
        fence = fenceTok[1] || "";
        fenceBody = [];
      } else {
        closeFence(fence, fenceBody);
        fence = null;
      }
      continue;
    }

    if (fence === null) {
      // Prose: collect markdown links and image/asset paths.
      for (const m of line.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        links.push({ target: m[1], kind: "link" });
      }
      // Headings only count outside fences.
      const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (h) headings.push(h[2].replace(/[*_`]/g, "").trim());
      continue;
    }

    fenceBody.push(line);

    // Inside a gm* widget fence: pull JSON href targets (gmcards, gmseealso).
    if (fence.startsWith("gm")) {
      for (const m of line.matchAll(/"href"\s*:\s*"([^"]+)"/g)) {
        links.push({ target: m[1], kind: "widget" });
      }
    }
    // gmsummary lines link down to a `##` via slugify(title-before-::).
    if (fence === "gmsummary") {
      const i = line.indexOf("::");
      const title = (i >= 0 ? line.slice(0, i) : line).trim();
      if (title) links.push({ target: `#${repoSlugify(title)}`, kind: "summary" });
    }
  }
  if (fence !== null) fenceErrors.push(`unclosed \`\`\`${fence} fence`);

  return { linkTo, headings, links, fenceErrors };
}

// ── build the world ────────────────────────────────────────────────────────

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith("_") || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

// urlPath (/docs/<section>/<slug>) -> { file, anchors:Set, parsed }
const pages = new Map();
for (const section of SECTIONS) {
  for (const file of walk(path.join(CONTENT, section))) {
    const rel = path.relative(CONTENT, file).replace(/\\/g, "/").replace(/\.md$/, "");
    const urlPath = `${DOCS_BASE}/${rel}`;
    const parsed = parseDoc(fs.readFileSync(file, "utf8"));
    pages.set(urlPath, { file, anchors: headingIds(parsed.headings), parsed });
  }
}

// Top-level URL segments that exist as app routes. Route groups `(x)` are
// transparent; `[locale]` is too (the locale rewrite maps /foo → /en/foo).
// Lets a link like /explorer or /room pass without a docs file.
const appSegments = new Set();
function collectAppSegments(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const transparent =
      (e.name.startsWith("(") && e.name.endsWith(")")) || e.name === "[locale]";
    if (transparent) collectAppSegments(path.join(dir, e.name));
    else if (!e.name.startsWith("[") && !e.name.startsWith("_") && e.name !== "api") {
      appSegments.add(e.name);
    }
  }
}
collectAppSegments(APP);

// ── validate one link ──────────────────────────────────────────────────────

const EXT_RE = /\.(png|jpe?g|gif|svg|webp|mp4|webm|pdf|txt|json|ico)$/i;

/** Returns an error string, or null when the link is good / out of scope. */
function checkLink(target, fromUrl) {
  if (!target) return null;
  // resolveHref (app/docs/_shared.tsx): absolute, anchor, external pass
  // through; bare relative joins the section base path (/docs/<section>).
  let resolved;
  if (/^https?:\/\//.test(target) || target.startsWith("mailto:") || target.startsWith("tel:")) {
    return null; // external — not network-checked here.
  }
  if (target.startsWith("#") || target.startsWith("/")) {
    resolved = target;
  } else {
    const base = fromUrl.split("/").slice(0, 3).join("/"); // /docs/<section>
    resolved = `${base}/${target.replace(/\.md$/, "")}`;
  }

  // Same-page anchor.
  if (resolved.startsWith("#")) {
    const id = decodeURIComponent(resolved.slice(1));
    if (!id) return null;
    const page = pages.get(fromUrl);
    return page.anchors.has(id) ? null : `missing anchor #${id} on this page`;
  }

  const [pathPart, anchor] = resolved.split("#");

  // Asset (image / pdf / file) → must exist under public/.
  if (EXT_RE.test(pathPart)) {
    const onDisk = path.join(PUBLIC, decodeURIComponent(pathPart));
    return fs.existsSync(onDisk) ? null : `missing asset ${pathPart}`;
  }

  // The app root and the docs root both resolve.
  if (pathPart === "/" || pathPart === DOCS_BASE) return null;

  // Docs link → must resolve to a real page (and anchor, if any).
  if (pathPart.startsWith(`${DOCS_BASE}/`)) {
    const seg = pathPart.slice(DOCS_BASE.length + 1).split("/")[0];
    if (!SECTIONS.includes(seg)) return `unknown docs section in ${pathPart}`;
    // A bare section root (/docs/vision) renders the section's first page.
    if (pathPart === `${DOCS_BASE}/${seg}`) return null;
    const page = pages.get(pathPart);
    if (!page) return `no page at ${pathPart}`;
    if (anchor) {
      const id = decodeURIComponent(anchor);
      if (!page.anchors.has(id)) return `missing anchor #${id} at ${pathPart}`;
    }
    return null;
  }

  // Other internal route (e.g. /explorer, /room) → top segment must be a real
  // app route. Sub-paths under it are out of scope (not docs-owned).
  const seg = pathPart.split("/")[1] ?? "";
  if (appSegments.has(seg)) return null;

  return `unknown route ${pathPart}`;
}

// ── run ────────────────────────────────────────────────────────────────────

let broken = 0;
let checked = 0;
let fences = 0;
const report = [];

for (const [urlPath, page] of pages) {
  const fails = [];
  const all = [...page.parsed.links];
  if (page.parsed.linkTo) all.push({ target: page.parsed.linkTo, kind: "sidebar linkTo" });
  for (const { target, kind } of all) {
    checked++;
    const err = checkLink(target, urlPath);
    if (err) fails.push(`    [${kind}] ${target} → ${err}`);
  }
  for (const err of page.parsed.fenceErrors) {
    fences++;
    fails.push(`    [fence] ${err}`);
  }
  if (fails.length) {
    broken += fails.length;
    report.push(`\n  ${path.relative(FRONTEND, page.file)}\n${fails.join("\n")}`);
  }
}

const slugMode = SluggerClass ? "github-slugger" : "fallback slugify";
if (broken) {
  console.error(report.join("\n"));
  console.error(
    `\n✗ ${broken} problem${broken === 1 ? "" : "s"} across ${pages.size} pages ` +
      `(${checked} links checked, ${fences} fence error${fences === 1 ? "" : "s"}, anchors via ${slugMode}).`
  );
  process.exit(1);
}
console.log(
  `✓ ${checked} internal links and all gm* fences across ${pages.size} docs pages resolve ` +
    `(anchors via ${slugMode}).`
);
