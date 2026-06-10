import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
// @ts-expect-error - highlightjs-solidity ships no type declarations
import { solidity } from "highlightjs-solidity";
import {
  handbookLib,
  handbookAdjacent,
  sectionTitle,
  sectionPath,
  type HandbookSection,
  type HandbookEntry,
} from "@/lib/handbook";
import { GmFlow } from "@/components/docs/GmFlow";
import { GmTry } from "@/components/docs/GmTry";
import { GmCards } from "@/components/docs/cards";
import { SeeAlso } from "@/components/docs/SeeAlso";
import { ArticleSummary } from "@/components/docs/ArticleSummary";
import { Callout } from "@/components/docs/Callout";
import GmShotPlaceholder from "@/components/docs/GmShotPlaceholder";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsSearch } from "@/components/docs/DocsSearch";
import { DocsAskPanel } from "@/components/docs/DocsAskPanel";
import { TocRail } from "@/components/docs/TocRail";
import { ReadingRail } from "@/components/docs/ReadingRail";
import { HandbookTabs } from "@/components/handbook/HandbookTabs";
import { HandbookSectionMenu } from "@/components/handbook/HandbookSectionMenu";
import { HandbookMobileBar } from "@/components/handbook/HandbookMobileBar";
import "./docs.css";

/** Resolve a slug catch-all into a posix slug; empty means the section root. */
export function resolveSlug(section: HandbookSection, slugParts?: string[]): string {
  const slug = (slugParts ?? []).join("/");
  if (slug) return slug;
  // Section root renders the first page in document order.
  const first = handbookLib(section).listDocs()[0];
  return first ? first.slug : "";
}

function resolveHref(href: string | undefined, basePath: string): string | null {
  if (!href) return null;
  if (/^https?:\/\//.test(href) || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("/"))
    return href;
  // Relative handbook link (e.g. "payouts" or "vision-api/batches") resolves
  // against the section.
  return `${basePath}/${href.replace(/\.md$/, "")}`;
}

type HastNode = {
  type?: string;
  value?: string;
  tagName?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
};

/** Flatten a hast subtree to its source text — used to feed the copy button the
 *  raw code, since the rendered children are highlight spans, not plain text. */
function hastText(node?: HastNode): string {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(hastText).join("");
}

/** Read the fence language off the inner <code> element's className. */
function codeLanguage(node?: HastNode): string | null {
  const code = node?.children?.find((c) => c.tagName === "code");
  const cls = code?.properties?.className;
  const list = Array.isArray(cls) ? cls : [];
  for (const c of list) {
    if (typeof c === "string" && c.startsWith("language-")) return c.slice("language-".length);
  }
  return null;
}

function markdownComponents(basePath: string): Components {
  return {
    pre({ node, children }) {
      const lang = codeLanguage(node as HastNode | undefined);
      // Custom gm* fences render their own widgets (diagrams, callouts, cards);
      // leave those bare so the existing `pre:has(...)` CSS strips the chrome.
      if (!lang || lang.startsWith("gm")) return <pre>{children}</pre>;
      return (
        <CodeBlock language={lang} raw={hastText(node as HastNode | undefined)}>
          {children}
        </CodeBlock>
      );
    },
    a({ href, children }) {
      const resolved = resolveHref(href, basePath);
      if (!resolved) return <span>{children}</span>;
      const external = /^https?:\/\//.test(resolved) || resolved.endsWith(".pdf");
      return external ? (
        <a href={resolved} target="_blank" rel="noreferrer">{children}</a>
      ) : (
        <a href={resolved}>{children}</a>
      );
    },
    img({ src, alt }) {
      if (typeof src !== "string" || !src) return null;
      // Span-based figure: react-markdown wraps a standalone image in a <p>, and
      // a <figure> there is invalid HTML. Spans are valid, so the screenshot and
      // its caption (the alt text) sit in a styled block that reads as a figure.
      return (
        <span className="docs-figure">
          <img src={src} alt={alt ?? ""} loading="lazy" />
          {alt ? <span className="docs-figcaption">{alt}</span> : null}
        </span>
      );
    },
    code({ className, children }) {
      const cn = typeof className === "string" ? className : "";
      // The plain-English layer: a short, jargon-free lead at the top of a page.
      if (cn.includes("language-gmplain")) return <Callout kind="plain" body={String(children).trim()} />;
      // A numbered micro sum-up of the whole article, Twenty-quickstart style.
      if (cn.includes("language-gmsummary")) return <ArticleSummary spec={String(children).trim()} />;
      if (cn.includes("language-gmseealso")) return <SeeAlso spec={String(children).trim()} />;
      if (cn.includes("language-gmcards")) return <GmCards spec={String(children).trim()} />;
      if (cn.includes("language-gmflow")) return <GmFlow id={String(children).trim()} />;
      if (cn.includes("language-gmnote")) return <Callout kind="note" body={String(children).trim()} />;
      if (cn.includes("language-gmtip")) return <Callout kind="tip" body={String(children).trim()} />;
      if (cn.includes("language-gmwarning")) return <Callout kind="warning" body={String(children).trim()} />;
      if (cn.includes("language-gm-try")) return <GmTry spec={String(children).trim()} />;
      if (cn.includes("language-gm-shot")) return <GmShotPlaceholder caption={String(children).trim()} />;
      return <code className={className}>{children}</code>;
    },
  };
}

/** The handbook chrome: topbar, left sidebar, right TOC, footer. */
export function HandbookShell({
  section,
  children,
}: {
  section: HandbookSection;
  children: React.ReactNode;
}) {
  const basePath = sectionPath(section);
  const lib = handbookLib(section);
  const groups = lib.listDocGroups();
  const index = lib.searchIndex();
  return (
    <div className="docs-root handbook">
      <header className="docs-topbar">
        <div className="docs-topbar-inner">
          <Link href="/docs/get-started" className="docs-brand" aria-label="General Market Docs">
            <Image src="/logo.svg" alt="" width={38} height={38} priority className="docs-brand-mark" />
            <span className="docs-brand-wordmark">General Market</span>
            <span className="docs-brand-suffix">Docs</span>
          </Link>
          <HandbookTabs />
          <HandbookSectionMenu />
          <div className="docs-topbar-actions">
            <DocsSearch index={index} basePath={basePath} />
            <Link className="docs-cta" href="/">
              Launch app
            </Link>
          </div>
        </div>
        <HandbookMobileBar groups={groups} basePath={basePath} section={section} />
      </header>
      <div className="docs-shell">
        <aside className="docs-sidebar">
          <DocsSidebar groups={groups} basePath={basePath} />
        </aside>
        <div className="docs-canvas">
          <main className="docs-main">
            <ReadingRail />
            {children}
          </main>
          <aside className="docs-toc">
            <TocRail />
          </aside>
        </div>
      </div>
      {/* Floating Ask AI — fixed-position launcher; mounted outside the topbar
          because its backdrop-filter clips fixed descendants. */}
      <DocsAskPanel />
      <footer className="docs-footer">
        <div className="docs-footer-inner">
          <div className="docs-footer-top">
            <div className="docs-footer-brand-col">
              <Link href="/docs/get-started" className="docs-footer-brand" aria-label="General Market">
                <Image src="/logo.svg" alt="" width={30} height={30} className="docs-footer-mark" />
                <span className="docs-footer-wordmark">General Market</span>
              </Link>
              <p className="docs-footer-tagline">Sealed prediction markets and on-chain DTFs</p>
            </div>
            <div className="docs-footer-links">
              <span className="docs-footer-nav-head">Quick links</span>
              <nav className="docs-footer-nav" aria-label="Quick links">
                <Link href="/docs/get-started">Docs</Link>
                <Link href="/">App</Link>
                <a href="https://github.com/General-Market" target="_blank" rel="noreferrer">GitHub</a>
              </nav>
            </div>
          </div>
          <hr className="docs-footer-rule" />
          <div className="docs-footer-bottom">
            <span className="docs-footer-legal">© 2026 General Market.</span>
            <span className="docs-footer-legal-links">
              <strong>Testnet only.</strong>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** A single handbook article: title, markdown body, prev/next pager. */
export function HandbookArticle({
  section,
  slugParts,
}: {
  section: HandbookSection;
  slugParts?: string[];
}) {
  const basePath = sectionPath(section);
  const lib = handbookLib(section);
  const slug = resolveSlug(section, slugParts);
  const doc = slug ? lib.loadDoc(slug) : null;
  if (!doc) notFound();

  // Pager flows across the whole handbook, so the end of one section continues
  // into the next - the way Morpho's docs walk through every page in order.
  const { prev, next } = handbookAdjacent(section, slug);

  // API-reference pages (a `method` in frontmatter) get a full-bleed layout:
  // the docs on the left, the request panel pinned high.
  if (doc.method) {
    return (
      <ApiReferenceArticle
        doc={doc}
        basePath={basePath}
        prev={prev}
        next={next}
      />
    );
  }

  return (
    <article className="docs-article">
      <header className="docs-article-header" data-align={doc.heroAlign}>
        <h1>{doc.title}</h1>
      </header>
      <div className="docs-prose">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSlug, [rehypeHighlight, { ignoreMissing: true, languages: { solidity } }]]}
          components={markdownComponents(basePath)}
        >
          {doc.body}
        </Markdown>
      </div>
      {(prev || next) && (
        <nav className="docs-pager" aria-label="Page navigation">
          {prev ? <Pager dir="prev" entry={prev} /> : <span />}
          {next ? <Pager dir="next" entry={next} /> : <span />}
        </nav>
      )}
      <Link className="docs-demo-cta" href="/">
        <span className="docs-demo-cta-text">
          <span className="docs-demo-cta-title">Try it on testnet</span>
          <span className="docs-demo-cta-sub">Faucet funds, real mechanics — predictions and DTFs are live</span>
        </span>
        <span className="docs-demo-cta-action" aria-hidden="true">Launch app →</span>
      </Link>
    </article>
  );
}

/** The full-bleed API endpoint page: a method header, the prose lead, and the
 *  request panel (the gm-try fence) pinned high. Porter-B replaces the GmTry
 *  stub with the live explorer; this layout already gives it its slot. */
function ApiReferenceArticle({
  doc,
  basePath,
  prev,
  next,
}: {
  doc: { body: string; title: string; navTitle?: string; method?: string };
  basePath: string;
  prev: HandbookEntry | null;
  next: HandbookEntry | null;
}) {
  // Pull the single gm-try spec out of the body; the remaining markdown is the
  // documentation lead that renders beside the request panel.
  const match = doc.body.match(/```gm-try\s*([\s\S]*?)```/);
  const spec = match ? match[1].trim() : null;
  const lead = doc.body.replace(/```gm-try\s*[\s\S]*?```/, "").trim();

  let auth = false;
  let write = false;
  let isExample = false;
  let note = "";
  if (spec) {
    try {
      const j = JSON.parse(spec) as { auth?: boolean; write?: boolean; demo?: boolean; note?: string };
      auth = !!j.auth;
      write = !!j.write;
      isExample = j.demo === false;
      note = typeof j.note === "string" ? j.note : "";
    } catch {
      /* malformed spec — badges just stay off */
    }
  }

  const method = doc.method ?? "GET";
  const path = doc.navTitle ?? doc.title;

  return (
    <article className="docs-article docs-article-api">
      <header className="docs-api-header">
        <span className={`gm-api-method m-${method.toLowerCase()}`}>{method}</span>
        <h1 className="docs-api-path">{path}</h1>
        {auth ? <span className="gm-api-badge b-auth">auth</span> : null}
        {write ? <span className="gm-api-badge b-write">write</span> : null}
        {isExample ? <span className="gm-api-badge b-example">example only</span> : null}
      </header>

      {isExample ? (
        <div className="docs-api-callout" role="note">
          <strong>The response below is an example, not a live call.</strong>{" "}
          {note || "This endpoint writes state, so it can't run from the docs."}{" "}
          The request on the left is exact — run it from your own client.
        </div>
      ) : null}

      {/* Panel first — the Try-It is the thing to click, so it sits high. The
          longer documentation reads below it. */}
      <div className="docs-api-body">
        {spec ? <GmTry spec={spec} /> : null}
        <div className="docs-prose docs-api-lead docs-api-lead-below">
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSlug, [rehypeHighlight, { ignoreMissing: true, languages: { solidity } }]]}
            components={markdownComponents(basePath)}
          >
            {lead}
          </Markdown>
        </div>
      </div>

      {(prev || next) && (
        <nav className="docs-pager" aria-label="Page navigation">
          {prev ? <Pager dir="prev" entry={prev} /> : <span />}
          {next ? <Pager dir="next" entry={next} /> : <span />}
        </nav>
      )}
    </article>
  );
}

function Pager({ dir, entry }: { dir: "prev" | "next"; entry: HandbookEntry }) {
  // A page from another section names its section, so a cross-boundary jump
  // reads as "Next · Bots" rather than an unlabelled title.
  const title = `${entry.doc.navTitle ?? entry.doc.title}`;
  return (
    <Link href={entry.href} className={`docs-pager-link ${dir}`}>
      <span className="docs-pager-meta">
        <span className="docs-pager-label">{dir === "prev" ? "Previous" : "Next"}</span>
        <span className="docs-pager-time">
          {sectionTitle(entry.section)} · {entry.doc.readMinutes} min read
        </span>
      </span>
      <span className="docs-pager-title">{title}</span>
    </Link>
  );
}
