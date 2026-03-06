# SEO Content Strategy — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship 7 MDX-powered learn pages targeting blue-ocean AI/bot-builder keywords and competitor comparison traffic, plus technical SEO fixes.

**Architecture:** Add `@next/mdx` + `gray-matter` pipeline to existing Next.js 15 + next-intl app. MDX files in `frontend/content/learn/`, dynamic `[slug]` route renders them with auto-generated metadata and JSON-LD schemas. Hub page at `/learn` with hero band + section bar matching `/index` visual language.

**Tech Stack:** Next.js 15, @next/mdx, gray-matter, remark-gfm, rehype-highlight, next-intl, Tailwind CSS

**Design doc:** `docs/plans/2026-02-27-seo-content-strategy-design.md`

---

## Task 1: Install MDX Dependencies

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/next.config.ts`
- Modify: `frontend/tsconfig.json`

**Step 1: Install packages**

```bash
cd frontend && pnpm add @next/mdx @mdx-js/react gray-matter remark-gfm rehype-highlight
```

If pnpm is not available, use `npm install`.

**Step 2: Update next.config.ts**

Wrap config with `withMDX`, composing with the existing `withNextIntl`:

```ts
import createNextIntlPlugin from "next-intl/plugin";
import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeHighlight],
  },
});

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  reactStrictMode: true,
  // ... keep existing webpack, headers, rewrites unchanged
};

export default withNextIntl(withMDX(nextConfig));
```

**Step 3: Update tsconfig.json**

Add `"**/*.mdx"` to the `include` array:

```json
"include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", "**/*.mdx", ".next/types/**/*.ts"]
```

**Step 4: Verify**

```bash
cd frontend && npx tsc --noEmit
```

Expected: Clean compile (no MDX files to process yet).

**Step 5: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/next.config.ts frontend/tsconfig.json
git commit -m "feat(seo): add MDX infrastructure — @next/mdx, gray-matter, remark-gfm, rehype-highlight"
```

---

## Task 2: Create MDX Library (`lib/learn/articles.ts`)

**Files:**
- Create: `frontend/lib/learn/articles.ts`
- Create: `frontend/content/learn/` (directory)

**Step 1: Create content directory**

```bash
mkdir -p frontend/content/learn
```

**Step 2: Create lib/learn/articles.ts**

This module reads MDX files from the content directory, parses frontmatter, and exposes listing + single-article functions. Pattern follows `lib/vision/sources.ts`.

Create `frontend/lib/learn/articles.ts`:

```ts
import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface ArticleFrontmatter {
  title: string;
  description: string;
  keywords: string[];
  date: string;
  author: string;
  slug: string;
  category: string;       // "AI Trading" | "Comparison" | "Technical" | "Education"
  readingTime: string;     // "8 min read"
}

export interface Article {
  frontmatter: ArticleFrontmatter;
  content: string; // raw MDX body (without frontmatter)
}

const CONTENT_DIR = path.join(process.cwd(), "content", "learn");

export function getArticleSlugs(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

export function getArticle(slug: string): Article | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  return {
    frontmatter: data as ArticleFrontmatter,
    content,
  };
}

export function getAllArticles(): Article[] {
  return getArticleSlugs()
    .map(getArticle)
    .filter((a): a is Article => a !== null)
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime());
}
```

**Step 3: Verify**

```bash
cd frontend && npx tsc --noEmit
```

Expected: Clean compile.

**Step 4: Commit**

```bash
git add frontend/lib/learn/articles.ts
git commit -m "feat(seo): add MDX article library — frontmatter parsing, slug listing"
```

---

## Task 3: Create MDX Components

**Files:**
- Create: `frontend/components/mdx/Callout.tsx`
- Create: `frontend/components/mdx/ComparisonTable.tsx`
- Create: `frontend/components/mdx/CodeBlock.tsx`
- Create: `frontend/components/mdx/index.tsx`

**Step 1: Create components/mdx/Callout.tsx**

```tsx
interface CalloutProps {
  type?: "info" | "warning" | "tip";
  children: React.ReactNode;
}

const styles = {
  info: "border-l-4 border-black bg-surface/50",
  warning: "border-l-4 border-yellow-500 bg-yellow-50",
  tip: "border-l-4 border-green-600 bg-green-50",
};

export function Callout({ type = "info", children }: CalloutProps) {
  return (
    <div className={`${styles[type]} px-5 py-4 my-6 text-[15px] text-text-secondary leading-relaxed`}>
      {children}
    </div>
  );
}
```

**Step 2: Create components/mdx/ComparisonTable.tsx**

```tsx
interface ComparisonTableProps {
  headers: string[];
  rows: string[][];
}

export function ComparisonTable({ headers, rows }: ComparisonTableProps) {
  return (
    <div className="border border-border-light overflow-x-auto my-6">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="bg-surface">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-3 font-bold text-black">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-t border-border-light ${i % 2 === 1 ? "bg-surface/40" : ""}`}>
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-3 ${j === 0 ? "font-medium text-black" : "text-text-secondary"}`}>
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
```

**Step 3: Create components/mdx/CodeBlock.tsx**

```tsx
interface CodeBlockProps {
  children: React.ReactNode;
  title?: string;
}

export function CodeBlock({ children, title }: CodeBlockProps) {
  return (
    <div className="my-6 border border-border-light overflow-hidden">
      {title && (
        <div className="bg-black text-white text-[12px] font-mono px-4 py-2 border-b border-border-light">
          {title}
        </div>
      )}
      <div className="bg-surface/30 overflow-x-auto">{children}</div>
    </div>
  );
}
```

**Step 4: Create components/mdx/index.tsx — MDX component map**

This is the component map passed to MDX rendering. It maps HTML elements to styled versions and exports custom components.

```tsx
import { Callout } from "./Callout";
import { ComparisonTable } from "./ComparisonTable";
import { CodeBlock } from "./CodeBlock";
import Link from "next/link";

export const mdxComponents = {
  // Custom components available in MDX
  Callout,
  ComparisonTable,
  CodeBlock,
  // Override default HTML elements with styled versions
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-[32px] md:text-[40px] font-black tracking-[-0.02em] text-black leading-[1.1] mb-4" {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-[22px] font-black tracking-[-0.01em] mt-12 mb-4 text-black" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-[17px] font-bold mt-6 mb-2 text-black" {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-[15px] text-text-secondary leading-relaxed mb-4" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc ml-6 space-y-2 text-[15px] text-text-secondary leading-relaxed mb-4" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal ml-6 space-y-3 text-[15px] text-text-secondary leading-relaxed mb-4" {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const { href, ...rest } = props;
    if (href?.startsWith("/")) {
      return <Link href={href} className="text-black font-bold underline hover:no-underline" {...rest} />;
    }
    return <a href={href} className="text-black font-bold underline hover:no-underline" target="_blank" rel="noopener noreferrer" {...rest} />;
  },
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="border border-border-light overflow-x-auto my-6">
      <table className="w-full text-[14px]" {...props} />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-surface" {...props} />
  ),
  th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th className="text-left px-4 py-3 font-bold text-black" {...props} />
  ),
  td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="px-4 py-3 text-text-secondary border-t border-border-light" {...props} />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code className="bg-surface px-1.5 py-0.5 text-[13px] font-mono text-black" {...props} />
  ),
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="bg-surface/30 border border-border-light p-4 overflow-x-auto my-6 text-[13px] font-mono" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="border-l-4 border-black pl-4 my-6 text-[15px] text-text-secondary italic" {...props} />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-bold text-black" {...props} />
  ),
};
```

**Step 5: Verify**

```bash
cd frontend && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add frontend/components/mdx/
git commit -m "feat(seo): add MDX components — Callout, ComparisonTable, CodeBlock, styled HTML overrides"
```

---

## Task 4: Create Dynamic `learn/[slug]/page.tsx` Route

**Files:**
- Create: `frontend/app/[locale]/learn/[slug]/page.tsx`

This is the core MDX renderer. It reads the `.mdx` file, parses frontmatter for metadata + JSON-LD, and renders the body with custom components.

**Step 1: Create the route**

Create `frontend/app/[locale]/learn/[slug]/page.tsx`:

```tsx
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { mdxComponents } from "@/components/mdx";
import { getArticle, getArticleSlugs } from "@/lib/learn/articles";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  const { title, description, keywords, slug: articleSlug } = article.frontmatter;
  return {
    title,
    description,
    keywords,
    alternates: { canonical: `/learn/${articleSlug}` },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: `https://www.generalmarket.io/learn/${articleSlug}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function LearnArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const { frontmatter, content } = article;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: frontmatter.title,
    description: frontmatter.description,
    image: "https://www.generalmarket.io/og-image.png",
    author: {
      "@type": "Organization",
      name: "General Market",
      url: "https://www.generalmarket.io",
    },
    publisher: {
      "@type": "Organization",
      name: "General Market",
      url: "https://www.generalmarket.io",
      logo: { "@type": "ImageObject", url: "https://www.generalmarket.io/logo.svg" },
    },
    datePublished: frontmatter.date,
    dateModified: frontmatter.date,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://www.generalmarket.io/learn/${frontmatter.slug}`,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.generalmarket.io" },
      { "@type": "ListItem", position: 2, name: "Learn", item: "https://www.generalmarket.io/learn" },
      { "@type": "ListItem", position: 3, name: frontmatter.title },
    ],
  };

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <article className="max-w-3xl mx-auto px-6 py-12 md:py-16 w-full">
        <div className="text-[13px] text-text-secondary font-medium tracking-wide mb-4">
          {frontmatter.category} &middot; {frontmatter.readingTime}
        </div>

        <MDXRemote
          source={content}
          components={mdxComponents}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
              rehypePlugins: [rehypeHighlight],
            },
          }}
        />
      </article>

      <Footer />
    </main>
  );
}
```

**Important:** This uses `next-mdx-remote/rsc` (RSC-compatible MDX rendering) instead of `@next/mdx` file-based approach. This is better for our use case because we load MDX from `content/` directory at runtime, not from the `app/` directory.

**Step 2: Install next-mdx-remote**

```bash
cd frontend && pnpm add next-mdx-remote
```

**Step 3: Verify**

```bash
cd frontend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add frontend/app/[locale]/learn/[slug]/page.tsx frontend/package.json frontend/pnpm-lock.yaml
git commit -m "feat(seo): add dynamic learn/[slug] MDX route with Article + BreadcrumbList JSON-LD"
```

---

## Task 5: Migrate `what-are-itps` to MDX

**Files:**
- Create: `frontend/content/learn/what-are-itps.mdx`
- Delete: `frontend/app/[locale]/learn/what-are-itps/page.tsx`

**Step 1: Create the MDX file**

Convert the existing 364-line TSX article to MDX. The content stays the same — just remove the React boilerplate and keep the prose + data.

Create `frontend/content/learn/what-are-itps.mdx`:

```mdx
---
title: "What Are Index Tracking Products (ITPs)?"
description: "ITPs are on-chain tokenized index products — the crypto equivalent of ETFs. One token, a basket of crypto assets, real-time NAV. Learn how they work."
keywords: ["ITP", "index tracking product", "crypto ETF", "on-chain ETF", "DeFi index fund", "tokenized index"]
date: "2026-02-27"
author: "General Market"
slug: "what-are-itps"
category: "Education"
readingTime: "8 min read"
---

# What Are Index Tracking Products (ITPs)?

The on-chain equivalent of ETFs. A single token that holds a basket of crypto assets with fixed weights.

## The 30-Second Version

You want exposure to "DeFi" but don't want to buy 10 tokens separately. An ITP lets you buy one token that holds all 10. The price floats with the basket. Like buying an S&P 500 ETF instead of 500 individual stocks.

Someone picks the assets, assigns weights, and deploys the ITP on-chain. You buy shares at the current price. When the underlying tokens go up, your share price goes up. When they go down, so does yours. One token, many assets.

## How ITPs Work

### Creation

Anyone can create an ITP. Pick assets from 100+ supported tokens, assign weights (e.g. 30% ETH, 20% BTC, 50% stablecoins), and deploy in a single transaction. Your ITP starts at $1 NAV. Each share holds a fixed quantity of each underlying asset, calculated from the weights and prices at the time of creation.

### NAV (Net Asset Value)

The price of one ITP share. Calculated as: sum of (quantity × price) for each asset in the basket. Updates every cycle, roughly every 30 seconds.

If ETH goes up 10% and your ITP is 50% ETH, your NAV goes up roughly 5%. If everything drops 20%, your NAV drops 20%. The math is transparent and verifiable on-chain at all times.

### Buying and Selling

To buy: deposit USDC and receive ITP shares at the current NAV. If the NAV is $1.24 and you deposit $124, you get 100 shares. To sell: return your shares and receive USDC at the current NAV. Settlement happens on-chain in one cycle — no waiting days for your funds.

### Rebalancing

Weights can be updated by the ITP creator. When this happens, the underlying quantities are recalculated to preserve the current NAV. Your share count stays the same — only what each share holds changes. Think of it like an ETF manager adjusting the portfolio allocation without affecting your account balance.

## ITPs vs Traditional ETFs

| Feature | ETF | ITP |
|---------|-----|-----|
| Settlement | T+1 days | ~30 seconds |
| Minimum Investment | $100+ | $1 |
| Trading Hours | Market hours | 24/7 |
| Custody | Broker | Your wallet |
| Creation | SEC filing | 1 transaction |
| Fees | 0.03 - 1% | ~0.3% |
| Transparency | Quarterly | Real-time |

Not better or worse — different tradeoffs. ITPs trade speed and permissionlessness for regulatory clarity and deposit insurance. ETFs are battle-tested over decades with clear legal frameworks. ITPs are new, operate 24/7, and anyone can create one without filing paperwork. Pick what matters to you.

## ITPs vs Buying Tokens Directly

Why not just buy the 10 tokens yourself? You can. But there are practical reasons people don't:

1. **Gas.** 10 separate swaps cost 10x the gas. An ITP purchase is one transaction.
2. **Rebalancing.** If you want to maintain 20% ETH / 20% BTC, you need to manually rebalance when prices shift. An ITP handles this automatically.
3. **Tracking.** One NAV number vs tracking 10 different prices across 10 different positions.
4. **Sharing.** You can share one token link that represents a thesis. "I'm bullish on DeFi" becomes a single tradeable asset, not a spreadsheet.

The same reason people buy SPY instead of 500 individual stocks.

## How to Get Started

Three steps. No jargon required.

1. **Connect your wallet** on Index L3. MetaMask, WalletConnect, or any EVM-compatible wallet.
2. **Browse ITPs** on the [Markets page](/index). Each one shows its holdings, NAV, and AUM.
3. **Buy shares with USDC.** Enter the amount, confirm the transaction. Done.

Or create your own ITP from 100+ supported assets. Pick the tokens, set the weights, deploy in one transaction.

## Risks

ITPs are an emerging financial primitive. Here are the real risks:

- **Smart contract risk.** ITPs are governed by smart contracts. Code can have bugs. Contracts are audited but not guaranteed to be bug-free. Funds held in a contract are only as safe as the contract itself.
- **Oracle risk.** NAV depends on price feeds from external oracles. If an oracle reports an incorrect price, your NAV calculation will be wrong. This can cause you to buy too high or sell too low.
- **Liquidity risk.** Low-AUM ITPs may have wider effective spreads. If you hold a large position relative to the ITP's total AUM, exiting may take multiple cycles.
- **Regulatory risk.** Rules around tokenized index products are still evolving. What is permissible today may face restrictions tomorrow. This space does not yet have the regulatory clarity of traditional ETFs.

None of this is meant to discourage you. It's meant to make sure you go in with open eyes. Do your own research and never invest more than you can afford to lose.

## Further Reading

- [About General Market](/about) — The team and technology behind the protocol.
- [Browse Markets](/index) — Explore all available ITPs and start trading.
- [AI Prediction Markets](/learn/ai-prediction-markets) — How AI agents compete in Vision's 25,000+ prediction markets.
- [Build a Prediction Market Bot](/learn/build-prediction-market-bot) — Deploy your first trading agent in 10 minutes.
```

**Step 2: Delete old TSX file**

```bash
rm frontend/app/[locale]/learn/what-are-itps/page.tsx
rmdir frontend/app/[locale]/learn/what-are-itps
```

**Step 3: Test locally**

```bash
cd frontend && pnpm dev
# Visit http://localhost:3000/learn/what-are-itps
# Verify content renders, metadata works, JSON-LD present in view-source
```

**Step 4: Commit**

```bash
git add frontend/content/learn/what-are-itps.mdx
git rm frontend/app/[locale]/learn/what-are-itps/page.tsx
git commit -m "refactor(seo): migrate what-are-itps from TSX to MDX — same content, new pipeline"
```

---

## Task 6: Create `/learn` Hub Page

**Files:**
- Create: `frontend/app/[locale]/learn/page.tsx`
- Modify: `frontend/messages/en/seo.json`

**Step 1: Add seo.json entry**

In `frontend/messages/en/seo.json`, add inside `"pages"` object:

```json
"learn": {
  "title": "Learn — AI Prediction Markets, Bots & Trading Guides",
  "description": "Tutorials and guides for AI prediction market trading. Build bots, compare platforms, understand sealed parimutuel markets."
}
```

**Step 2: Create the hub page**

Create `frontend/app/[locale]/learn/page.tsx`:

```tsx
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Link } from "@/i18n/routing";
import { getAllArticles } from "@/lib/learn/articles";
import { HeroBand } from "@/components/ui/HeroBand";
import { SectionBar } from "@/components/ui/SectionBar";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo.pages.learn" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/learn" },
    robots: { index: true, follow: true },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: "https://www.generalmarket.io/learn",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
  };
}

export default async function LearnHubPage() {
  const articles = getAllArticles();

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Learn — General Market",
    description: "Tutorials and guides for AI prediction market trading.",
    url: "https://www.generalmarket.io/learn",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: articles.length,
      itemListElement: articles.map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://www.generalmarket.io/learn/${a.frontmatter.slug}`,
        name: a.frontmatter.title,
      })),
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.generalmarket.io" },
      { "@type": "ListItem", position: 2, name: "Learn" },
    ],
  };

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <HeroBand
        eyebrow="General Market"
        title="Learn"
        subtitle="Tutorials and guides for AI prediction market trading. Build bots, compare platforms, understand sealed parimutuel markets."
      />

      <SectionBar title="Articles" value={String(articles.length)} />

      <div className="max-w-site mx-auto px-6 py-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <Link
              key={article.frontmatter.slug}
              href={`/learn/${article.frontmatter.slug}`}
              className="block border border-border-light p-6 hover:border-black transition-colors group"
            >
              <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-text-muted mb-3">
                {article.frontmatter.category}
              </div>
              <h2 className="text-[17px] font-bold text-black leading-snug mb-2 group-hover:underline">
                {article.frontmatter.title}
              </h2>
              <p className="text-[14px] text-text-secondary leading-relaxed mb-3">
                {article.frontmatter.description}
              </p>
              <div className="text-[12px] text-text-muted">
                {article.frontmatter.readingTime}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <Footer />
    </main>
  );
}
```

**Step 3: Verify**

```bash
cd frontend && pnpm dev
# Visit http://localhost:3000/learn
# Should show hero band, section bar with article count, grid of cards
# Click a card — should navigate to article
```

**Step 4: Commit**

```bash
git add frontend/app/[locale]/learn/page.tsx frontend/messages/en/seo.json
git commit -m "feat(seo): add /learn hub page with hero band, section bar, article grid"
```

---

## Task 7: Write MDX Content — ai-prediction-markets

**Files:**
- Create: `frontend/content/learn/ai-prediction-markets.mdx`

**CAN RUN IN PARALLEL WITH TASKS 8-12.**

Create `frontend/content/learn/ai-prediction-markets.mdx`.

Target keyword: "AI prediction market" (8,100/mo, difficulty 3).
Target length: ~1,500 words.

Refer to design doc Section 2, Page 2 for the full content outline. The article must:

- H1: "AI Prediction Markets: Where Agents Compete for Alpha"
- Cover: what makes a prediction market AI-native, why agents need different infrastructure, Vision's 25K+ markets across 79 data sources, the alpha argument (19 vs 1,200 traders/market), CTA to `npx generalmarket init`
- Use the keyword "AI prediction market" in H1, first paragraph, at least 2 H2s, and meta description
- Include internal links to: `/learn/build-prediction-market-bot`, `/sources`, `/` (homepage leaderboard)
- Include internal links to: `/learn/prediction-market-bots`, `/learn/sealed-prediction-markets`
- Frontmatter: category "AI Trading", readingTime "7 min read"

Refer to `frontend/public/llms-full.txt` for accurate technical details about Vision's mechanics (ticks, batches, bitmaps, sealed bets, BLS settlement, data sources).

**Commit after writing:**

```bash
git add frontend/content/learn/ai-prediction-markets.mdx
git commit -m "feat(seo): add ai-prediction-markets article — target: AI prediction market (8.1K/mo)"
```

---

## Task 8: Write MDX Content — prediction-market-bots

**Files:**
- Create: `frontend/content/learn/prediction-market-bots.mdx`

**CAN RUN IN PARALLEL WITH TASKS 7, 9-12.**

Target keyword: "prediction market bot" (5,400/mo, difficulty 3).
Target length: ~1,200 words.

Refer to design doc Section 2, Page 3 for the full content outline. The article must:

- H1: "Prediction Market Bots: How Automated Agents Are Beating Human Traders"
- Cover: the bot landscape (Polymarket arbitrage bots, PredictEngine), why most bots fail on Polymarket, what Vision does differently, bot performance on Vision leaderboard
- Include internal links to: `/learn/ai-prediction-markets`, `/learn/build-prediction-market-bot`, `/` (homepage)
- Frontmatter: category "AI Trading", readingTime "5 min read"

**Commit after writing:**

```bash
git add frontend/content/learn/prediction-market-bots.mdx
git commit -m "feat(seo): add prediction-market-bots article — target: prediction market bot (5.4K/mo)"
```

---

## Task 9: Write MDX Content — build-prediction-market-bot

**Files:**
- Create: `frontend/content/learn/build-prediction-market-bot.mdx`

**CAN RUN IN PARALLEL WITH TASKS 7-8, 10-12.**

Target keyword: "how to build prediction market bot" (2,400/mo, difficulty 2).
Secondary: "Claude Code trading bot" (1,900/mo).
Target length: ~2,000 words.

Refer to design doc Section 2, Page 4 for the full content outline. The article must:

- H1: "Build a Prediction Market Bot in 10 Minutes"
- Cover: prerequisites, `npx generalmarket init`, understanding data sources, writing a strategy, submitting bets via API, monitoring on leaderboard
- Include TypeScript code snippets throughout
- Include internal links to: `/learn/ai-prediction-markets`, `/sources`, `/learn/prediction-market-bots`
- Frontmatter: category "Tutorial", readingTime "10 min read"

Additionally add HowTo JSON-LD. In the `learn/[slug]/page.tsx`, detect if the slug is `build-prediction-market-bot` and inject a HowTo schema alongside the Article schema. Alternatively, add a `schema` field to frontmatter (e.g., `schema: ["Article", "HowTo"]`) and handle it generically in the route.

Refer to `frontend/public/llms-full.txt` for accurate API details, batch creation flow, bitmap encoding, and commit/reveal cycle.

**Commit after writing:**

```bash
git add frontend/content/learn/build-prediction-market-bot.mdx
git commit -m "feat(seo): add build-prediction-market-bot tutorial — target: how to build prediction market bot (2.4K/mo)"
```

---

## Task 10: Write MDX Content — polymarket-vs-general-market

**Files:**
- Create: `frontend/content/learn/polymarket-vs-general-market.mdx`

**CAN RUN IN PARALLEL WITH TASKS 7-9, 11-12.**

Target keyword: "polymarket alternative" (12,100/mo, difficulty 5).
Target length: ~1,500 words.

Refer to design doc Section 2, Page 5 for the full content outline and comparison table. The article must:

- H1: "Polymarket vs General Market (Vision): Which Prediction Market Is Right for You?"
- Include the full comparison table from the design doc (9 rows: Markets, Model, Front-running, Fee, KYC, Bot support, Avg traders/market, Settlement, Chain)
- "When to use Polymarket" section — be honest (high liquidity, proven track record)
- "When to use Vision" section — AI agents, exotic data, sealed bets, no KYC
- Honest acknowledgment that Polymarket has more liquidity
- Include internal links to: `/learn/ai-prediction-markets`, `/learn/kalshi-vs-general-market`, `/about`
- Frontmatter: category "Comparison", readingTime "7 min read"

Use markdown tables (remark-gfm handles them). The mdxComponents already style tables.

**Commit after writing:**

```bash
git add frontend/content/learn/polymarket-vs-general-market.mdx
git commit -m "feat(seo): add polymarket-vs-general-market comparison — target: polymarket alternative (12.1K/mo)"
```

---

## Task 11: Write MDX Content — kalshi-vs-general-market

**Files:**
- Create: `frontend/content/learn/kalshi-vs-general-market.mdx`

**CAN RUN IN PARALLEL WITH TASKS 7-10, 12.**

Target keyword: "kalshi alternative" (6,600/mo, difficulty 5).
Target length: ~1,200 words.

Refer to design doc Section 2, Page 6 for the full content outline and comparison table. The article must:

- H1: "Kalshi vs General Market (Vision): Regulated Exchange vs Decentralized Protocol"
- Include the full comparison table (8 rows: Regulation, Markets, Model, Min bet, KYC, Bot support, Settlement, Chain)
- "When to use Kalshi" / "When to use Vision" sections
- Include internal links to: `/learn/polymarket-vs-general-market`, `/learn/ai-prediction-markets`, `/about`
- Frontmatter: category "Comparison", readingTime "6 min read"

**Commit after writing:**

```bash
git add frontend/content/learn/kalshi-vs-general-market.mdx
git commit -m "feat(seo): add kalshi-vs-general-market comparison — target: kalshi alternative (6.6K/mo)"
```

---

## Task 12: Write MDX Content — sealed-prediction-markets

**Files:**
- Create: `frontend/content/learn/sealed-prediction-markets.mdx`

**CAN RUN IN PARALLEL WITH TASKS 7-11.**

Target keyword: "sealed bid prediction market" (480/mo, difficulty 1).
Secondary: "parimutuel prediction market" (1,300/mo).
Target length: ~1,000 words.

Refer to design doc Section 2, Page 7 for the full content outline. The article must:

- H1: "Sealed Prediction Markets: Why Your Bets Should Be Private"
- Cover: front-running problem, how sealed commit-reveal works, why it matters for AI agents, parimutuel model, comparison with order book
- Include internal links to: `/learn/ai-prediction-markets`, `/learn/prediction-market-bots`, `/about`
- Frontmatter: category "Technical", readingTime "5 min read"

Refer to `frontend/public/llms-full.txt` for accurate details on Vision's sealed bet mechanics, BLS settlement, and parimutuel pool distribution.

**Commit after writing:**

```bash
git add frontend/content/learn/sealed-prediction-markets.mdx
git commit -m "feat(seo): add sealed-prediction-markets article — target: sealed bid + parimutuel (1.8K/mo)"
```

---

## Task 13: Update Sitemap

**Files:**
- Modify: `frontend/app/sitemap.ts`

**Depends on:** Tasks 2 (lib/learn/articles.ts exists) and 7-12 (MDX files exist).

**Step 1: Update sitemap.ts**

Modify `frontend/app/sitemap.ts` to:
1. Import `getArticleSlugs` from `@/lib/learn/articles`
2. Import `getSourceIds` from `@/lib/vision/sources`
3. Add learn hub + all learn articles as sitemap entries
4. Add all `/source/[sourceId]` entries (currently missing)
5. Add `changeFrequency` and `priority` to all entries

```ts
import { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n/config";
import { getItpSummaries } from "@/lib/api/server-data";
import { getArticleSlugs, getArticle } from "@/lib/learn/articles";
import { getSourceIds } from "@/lib/vision/sources";

const baseUrl = "https://www.generalmarket.io";

function localeUrl(path: string, locale: string): string {
  if (locale === defaultLocale) return `${baseUrl}${path}`;
  return `${baseUrl}/${locale}${path}`;
}

function alternatesForPath(path: string) {
  return {
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, localeUrl(path, l)])),
      "x-default": localeUrl(path, defaultLocale),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let itps: { itpId: string }[] = [];
  try {
    itps = await getItpSummaries();
  } catch {
    console.warn("sitemap: failed to fetch ITP summaries");
  }

  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  const staticRoutes: { path: string; lastModified: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
    { path: "", lastModified: "2026-02-27", changeFrequency: "daily", priority: 1.0 },
    { path: "/index", lastModified: "2026-02-27", changeFrequency: "daily", priority: 0.9 },
    { path: "/sources", lastModified: "2026-02-27", changeFrequency: "daily", priority: 0.9 },
    { path: "/points", lastModified: "2026-02-27", changeFrequency: "weekly", priority: 0.5 },
    { path: "/about", lastModified: "2026-02-27", changeFrequency: "monthly", priority: 0.7 },
    { path: "/privacy", lastModified: "2026-02-15", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", lastModified: "2026-02-15", changeFrequency: "yearly", priority: 0.3 },
  ];

  for (const route of staticRoutes) {
    entries.push({
      url: localeUrl(route.path, defaultLocale),
      lastModified: new Date(route.lastModified),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: alternatesForPath(route.path),
    });
  }

  // Learn hub
  entries.push({
    url: localeUrl("/learn", defaultLocale),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
    alternates: alternatesForPath("/learn"),
  });

  // Learn articles from MDX
  for (const slug of getArticleSlugs()) {
    const article = getArticle(slug);
    const path = `/learn/${slug}`;
    entries.push({
      url: localeUrl(path, defaultLocale),
      lastModified: article ? new Date(article.frontmatter.date) : new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: alternatesForPath(path),
    });
  }

  // ITP detail pages
  for (const itp of itps) {
    const path = `/itp/${itp.itpId}`;
    entries.push({
      url: localeUrl(path, defaultLocale),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
      alternates: alternatesForPath(path),
    });
  }

  // Source detail pages (NEW — previously missing)
  for (const sourceId of getSourceIds()) {
    const path = `/source/${sourceId}`;
    entries.push({
      url: localeUrl(path, defaultLocale),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
      alternates: alternatesForPath(path),
    });
  }

  return entries;
}
```

**Step 2: Verify**

```bash
cd frontend && pnpm dev
# Visit http://localhost:3000/sitemap.xml
# Verify: /learn, /learn/ai-prediction-markets, etc. all present
# Verify: /source/* pages now included
# Verify: changeFrequency and priority attributes present
```

**Step 3: Commit**

```bash
git add frontend/app/sitemap.ts
git commit -m "feat(seo): update sitemap — add learn pages, source pages, changeFrequency + priority"
```

---

## Task 14: Update Footer + Cross-Links

**Files:**
- Modify: `frontend/components/layout/Footer.tsx`
- Modify: `frontend/content/learn/what-are-itps.mdx` (already done in Task 5 — verify Further Reading)

**Step 1: Update Footer.tsx**

In `frontend/components/layout/Footer.tsx`, replace the "What are ITPs?" link:

Find:
```tsx
<Link href="/learn/what-are-itps" className="hover:text-white transition-colors">What are ITPs?</Link>
```

Replace with:
```tsx
<Link href="/learn" className="hover:text-white transition-colors">Learn</Link>
```

**Step 2: Verify**

```bash
cd frontend && pnpm dev
# Check footer on any page — should show "Learn" linking to /learn
```

**Step 3: Commit**

```bash
git add frontend/components/layout/Footer.tsx
git commit -m "feat(seo): update footer — replace 'What are ITPs?' with 'Learn' hub link"
```

---

## Task 15: Add Dataset Schema to `/source/[sourceId]`

**Files:**
- Modify: `frontend/app/[locale]/source/[sourceId]/page.tsx`

**Step 1: Add Dataset JSON-LD**

In the source detail page component, add a Dataset schema script tag. The data comes from the source object which is already loaded. Add after existing content:

```tsx
const datasetJsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: `${source.name} — Vision Market Data`,
  description: `Real-time ${source.name} data feed powering prediction markets on General Market Vision. Category: ${source.category}.`,
  creator: {
    "@type": "Organization",
    name: "General Market",
    url: "https://www.generalmarket.io",
  },
  url: `https://www.generalmarket.io/source/${source.id}`,
  temporalCoverage: "..",
  license: "https://www.generalmarket.io/terms",
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.generalmarket.io" },
    { "@type": "ListItem", position: 2, name: "Sources", item: "https://www.generalmarket.io/sources" },
    { "@type": "ListItem", position: 3, name: source.name },
  ],
};
```

Add the `<script type="application/ld+json">` tags for both schemas in the JSX.

**Step 2: Commit**

```bash
git add frontend/app/[locale]/source/[sourceId]/page.tsx
git commit -m "feat(seo): add Dataset + BreadcrumbList JSON-LD to source detail pages"
```

---

## Task 16: Final Verification

**Depends on:** All previous tasks complete.

**Step 1: Type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: Clean compile.

**Step 2: Dev server checks**

```bash
cd frontend && pnpm dev
```

Visit each URL and verify:

- [ ] `/learn` — hub renders with all 7 article cards, correct count in section bar
- [ ] `/learn/what-are-itps` — migrated article renders correctly from MDX
- [ ] `/learn/ai-prediction-markets` — renders, correct H1, meta description matches frontmatter
- [ ] `/learn/prediction-market-bots` — renders
- [ ] `/learn/build-prediction-market-bot` — renders, code blocks have syntax highlighting
- [ ] `/learn/polymarket-vs-general-market` — renders, comparison table styled correctly
- [ ] `/learn/kalshi-vs-general-market` — renders, comparison table styled correctly
- [ ] `/learn/sealed-prediction-markets` — renders
- [ ] JSON-LD on each page (view source, search for `application/ld+json`): Article, BreadcrumbList present
- [ ] `/learn` has CollectionPage + BreadcrumbList JSON-LD
- [ ] `/sitemap.xml` — all new routes present, `/source/*` included, `changeFrequency`/`priority` attributes
- [ ] Footer shows "Learn" link (not "What are ITPs?")
- [ ] `/learn/what-are-itps` "Further Reading" links to new articles
- [ ] Internal links between articles work
- [ ] Mobile responsive — comparison tables scroll horizontally, text readable

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(seo): post-verification fixes for learn pages"
```

**Step 4: Push**

```bash
git push
```

---

## Parallelization Map

```
Task 1 (deps)
  → Task 2 (lib)
    → Task 3 (components)
      → Task 4 (route)
        → Task 5 (migrate)
          → Task 6 (hub) ─────────────────────────────────────┐
          → Task 7  (ai-prediction-markets)      ─── PARALLEL ├─→ Task 13 (sitemap)
          → Task 8  (prediction-market-bots)      ─── PARALLEL ├─→ Task 14 (footer)
          → Task 9  (build-prediction-market-bot) ─── PARALLEL ├─→ Task 15 (dataset schema)
          → Task 10 (polymarket-vs-gm)            ─── PARALLEL │     │
          → Task 11 (kalshi-vs-gm)                ─── PARALLEL │     ↓
          → Task 12 (sealed-prediction-markets)   ─── PARALLEL ┘  Task 16 (verify)
```

**Max 3 agents at a time** (per CLAUDE.md). Suggested batches:
- **Batch A:** Tasks 7 + 8 + 9 (3 agents — AI Trading articles)
- **Batch B:** Tasks 10 + 11 + 12 (3 agents — Comparison + Technical)
- **Batch C:** Tasks 13 + 14 + 15 (3 agents — wiring)
