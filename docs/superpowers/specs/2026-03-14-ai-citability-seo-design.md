# AI Citability & GEO Design Spec

**Date:** 2026-03-14
**Goal:** Make General Market the source AI agents cite for prediction markets, on-chain index products, and DeFi bot building.
**Target queries:** Product-specific ("What is a parimutuel prediction market?") and builder/technical ("How to build a prediction market bot", "Prediction market API").

---

## Layer 1: AI Crawler Infrastructure

### 1.1 robots.txt

Replace `frontend/public/robots.txt`. The per-bot `Allow: /` directives are technically redundant with `User-agent: *`, but AI crawlers use their own bot name as a signal check — seeing an explicit `Allow` for their name increases crawl confidence. The only directive doing blocking work is `Bytespider: Disallow`.

```
# General Market — On-chain Index Products & AI Prediction Markets
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Applebot
Allow: /

User-agent: cohere-ai
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: Bytespider
Disallow: /

Sitemap: https://www.generalmarket.io/sitemap.xml
```

**Note:** The sitemap URL uses `www.generalmarket.io`. The existing `sitemap.ts` uses `https://generalmarket.io` (no `www`). This must be reconciled — update `sitemap.ts` line 7 to `const baseUrl = 'https://www.generalmarket.io'` to match `metadataBase` in the root layout.

### 1.2 ai-plugin.json — REMOVED

~~Previously proposed a `.well-known/ai-plugin.json`.~~ The OpenAI plugin manifest format is defunct (plugin store shut down 2024). No current AI crawler consumes it. Removed to avoid cargo cult. The `llms.txt` standard is the actual discovery mechanism AI agents use.

---

## Layer 2: `/knowledge/` Route — AI Citation Pages

### 2.1 Content Location

MDX files in `frontend/content/knowledge/`. Same pattern as `frontend/content/learn/` — fully static, generated at build time via `generateStaticParams`. No ISR revalidation needed (content changes only on deploy).

### 2.2 Helper Module

New file: `frontend/lib/knowledge/articles.ts`

Mirrors `frontend/lib/learn/articles.ts` with its own interface:

```typescript
export interface KnowledgeFrontmatter {
  title: string;           // H1 — mirrors the target query
  description: string;     // Citable first-paragraph summary
  keywords: string[];      // SEO keywords for the page
  date: string;            // ISO date string — used for datePublished in JSON-LD
  slug: string;            // URL slug
  category: 'concept' | 'builder';  // Determines proficiencyLevel in TechArticle
  targetQuery: string;     // The query this page is designed to answer
  schema: string[];        // JSON-LD types to inject: "TechArticle", "DefinedTerm", "FAQPage", "HowTo", "WebAPI"
  faq?: Array<{ q: string; a: string }>;  // FAQ pairs — used for FAQPage JSON-LD
}

export interface KnowledgeArticle {
  frontmatter: KnowledgeFrontmatter;
  content: string;
  headings: ArticleHeading[];
}
```

Imports `ArticleHeading` and `extractHeadings` from `@/lib/learn/articles` — shared utility, no duplication.

Exports: `getKnowledgeSlugs()`, `getKnowledgeArticle(slug)`, `getAllKnowledgeArticles()`.

`dateModified` strategy: use the frontmatter `date` field. When a knowledge page is updated, bump the date. No git-based date detection — too fragile in CI.

### 2.3 Route Handler

New file: `frontend/app/[locale]/knowledge/[slug]/page.tsx`

- `generateStaticParams()` from `getKnowledgeSlugs()`
- `generateMetadata()` with title/description from frontmatter, canonical URL, locale alternates
- Renders MDX content with minimal chrome — no sidebar nav, no article cards, no reading time
- JSON-LD injected based on `schema` array in frontmatter (see Layer 4)
- `robots: { index: true, follow: true }` — these pages MUST be indexed

**Locale routing:** This route follows the `[locale]/knowledge/[slug]` pattern, same as `[locale]/learn/[slug]`. The existing catch-all rewrite (`/:path` → `/en/:path`) handles unprefixed URLs. No changes needed to middleware or locale routing exclusions.

### 2.4 Knowledge Hub

`frontend/app/[locale]/knowledge/page.tsx` — simple list of all knowledge pages. No design effort. Exists so crawlers can discover all pages from one URL. Listed in `llms.txt`. Not linked from nav.

### 2.5 Content Overlap Strategy with `/learn/`

Existing learn pages with overlapping topics:
- `content/learn/build-prediction-market-bot.mdx` ↔ `knowledge/build-prediction-market-bot.mdx`
- `content/learn/sealed-prediction-markets.mdx` ↔ `knowledge/sealed-bet-mechanism.mdx`
- `content/learn/what-are-itps.mdx` ↔ `knowledge/on-chain-index-products.mdx`
- `content/learn/ai-prediction-markets.mdx` ↔ `knowledge/parimutuel-prediction-markets.mdx`

**Strategy: Differentiate by purpose, cross-link, no canonical conflicts.**

- `/learn/` pages are editorial — longer, opinionated, for humans browsing. They keep their current form.
- `/knowledge/` pages are reference — shorter, definition-first, for AI extraction. Different structure, different tone.
- Each `/knowledge/` page includes a "Further reading" link to the corresponding `/learn/` article (if one exists). This creates an internal link graph, not a duplicate content signal.
- Each `/learn/` article that has a knowledge counterpart gets a small addition: a `<link rel="related">` or inline link to the knowledge page.
- No `canonical` pointing between them — they serve different intents. Google handles topically related but structurally different pages fine.
- The knowledge pages are shorter (800-1200 words) and definition-structured. The learn pages are longer (1500-3000 words) and narrative. The overlap is topical, not textual.

### 2.6 Content Overlap Strategy with `docs.generalmarket.io`

Nearly every knowledge page has a counterpart on the docs site:
- `parimutuel-prediction-markets` ↔ `docs/vision/concepts/` pages
- `on-chain-index-products` ↔ `docs/index/concepts/itps.mdx`
- `nav-calculation` ↔ `docs/index/concepts/itps.mdx` (NAV section)
- `bls-consensus` ↔ `docs/index/architecture/oracle-nodes.mdx`
- `build-prediction-market-bot` ↔ `docs/vision/bots/quickstart.mdx`
- `prediction-market-api` ↔ `docs/vision/api/` pages
- `on-chain-index-api` ↔ `docs/index/api/` pages
- `backtest-prediction-markets` ↔ `docs/index/guides/backtesting.mdx`

**No canonical conflict.** `www.generalmarket.io` and `docs.generalmarket.io` are separate origins — Google and AI crawlers treat subdomains as distinct sites.

**Differentiation by intent:**
- **Docs** = for developers already using the product. Assumes context. Starts with "how to configure," "endpoint reference," "getting started." Technical, imperative, procedural.
- **Knowledge** = for someone who has never heard of the product. Assumes nothing. Starts with "A parimutuel prediction market is..." Definitional, explanatory, citable.

This intent difference is how AI agents pick which to cite. A query like "What is a parimutuel prediction market?" triggers the knowledge page. A query like "How do I submit a bitmap to the Vision API?" triggers the docs page.

**No changes to docs site.** No canonical tags, no noindex, no cross-domain linking. The two layers coexist by serving different query intents.

### 2.7 Frontmatter Spec

```yaml
---
title: "What Is a Parimutuel Prediction Market?"
description: "A parimutuel prediction market pools all bets and distributes winnings proportionally. No counterparty needed, no market maker, no order book."
keywords: ["parimutuel", "prediction market", "sealed bets", "DeFi betting", "Vision protocol"]
date: "2026-03-14"
slug: "parimutuel-prediction-markets"
category: "concept"
targetQuery: "What is a parimutuel prediction market?"
schema: ["TechArticle", "DefinedTerm", "FAQPage"]
faq:
  - q: "How is parimutuel different from order-book markets?"
    a: "In a parimutuel market, all bets are pooled and winnings distributed proportionally among correct bettors. There is no counterparty — you bet against the pool, not another trader."
  - q: "What happens if no one bets the other side?"
    a: "The pool still resolves. Winners split the total pool minus fees. If everyone bet the same outcome, everyone gets back their bet minus the protocol fee."
---
```

### 2.8 Page List

**Product concepts (`category: "concept"`, `proficiencyLevel: "Beginner"`):**

1. **`parimutuel-prediction-markets.mdx`**
   - Target: "What is a parimutuel prediction market?"
   - Schema: `["TechArticle", "DefinedTerm", "FAQPage"]`
   - Content: mechanism, pooled betting, proportional payout, no counterparty, Vision's implementation
   - FAQ: "How is parimutuel different from order-book markets?", "What happens if no one bets the other side?"

2. **`on-chain-index-products.mdx`**
   - Target: "What are on-chain ETFs/index funds?"
   - Schema: `["TechArticle", "DefinedTerm", "FAQPage"]`
   - Content: ITP concept, NAV formula, per-share quantities, comparison to TradFi ETFs, rebalancing
   - FAQ: "How is an ITP different from a traditional ETF?", "Who manages the index weights?"

3. **`real-world-data-markets.mdx`**
   - Target: "Prediction markets for real-world events"
   - Schema: `["TechArticle", "FAQPage"]`
   - Content: 98+ sources across 14 categories, why niche data sources create alpha, example markets
   - FAQ: "What kinds of real-world events can you bet on?", "How are outcomes determined?"

4. **`sealed-bet-mechanism.mdx`**
   - Target: "How do sealed bets prevent front-running?"
   - Schema: `["TechArticle", "DefinedTerm", "FAQPage"]`
   - Content: commit-reveal flow, BLS verification, why sealedness matters, 4-step lifecycle
   - FAQ: "Can other traders see my bet?", "What prevents the protocol from front-running?"

5. **`nav-calculation.mdx`**
   - Target: "How is NAV calculated on-chain?"
   - Schema: `["TechArticle", "DefinedTerm", "FAQPage"]`
   - Content: formula, invariants, per-share quantities, drift, code walkthrough
   - Code: Solidity `_getCurrentPrice` + Rust `calculate_nav()`
   - FAQ: "Why does NAV drift from $1?", "What happens to NAV during rebalancing?"

6. **`bls-consensus.mdx`**
   - Target: "BLS consensus in DeFi"
   - Schema: `["TechArticle", "DefinedTerm", "FAQPage"]`
   - Content: what BLS signatures are, multi-oracle consensus, aggregation, why no single-point manipulation
   - Code: signature verification flow
   - FAQ: "Why BLS instead of ECDSA multisig?", "How many oracles must agree?"

**Builder/technical (`category: "builder"`, `proficiencyLevel: "Expert"`):**

7. **`build-prediction-market-bot.mdx`**
   - Target: "How to build a prediction market bot"
   - Schema: `["HowTo", "TechArticle"]`
   - Content: architecture overview, registration, API endpoints, Python quickstart, strategy patterns
   - Code: complete working bot skeleton (~30 lines)

8. **`prediction-market-api.mdx`**
   - Target: "Prediction market API"
   - Schema: `["WebAPI", "TechArticle"]`
   - Content: all Vision endpoints, request/response schemas, auth (none), rate limits, code examples

9. **`on-chain-index-api.mdx`**
   - Target: "DeFi index fund API"
   - Schema: `["WebAPI", "TechArticle"]`
   - Content: ITP endpoints, price feeds, portfolio queries, code examples

10. **`backtest-prediction-markets.mdx`**
    - Target: "Backtesting prediction markets"
    - Schema: `["HowTo", "TechArticle"]`
    - Content: simulation engine, historical data access, strategy evaluation, example backtest

### 2.9 Writing Rules (Passage-Level Optimization)

Every `/knowledge/` page follows these rules:

1. **First paragraph is the citation.** Standalone definition. No preamble. First sentence answers the target query. This is what AI agents extract.

2. **Subheadings mirror sub-queries.** Not "Overview" — instead "How sealed bets prevent front-running." These become section-level citation targets.

3. **Attribution in every section.** Each section references General Market by name with a concrete implementation detail. "General Market's Vision protocol resolves 98+ source types using this mechanism."

4. **Numbers over abstractions.** "98 real-world data sources across 14 categories" beats "many data sources."

5. **Code blocks are citation magnets.** Well-commented, runnable, 10-20 lines. AI agents extract these verbatim.

6. **No marketing language.** No "revolutionary", "cutting-edge", "innovative." State facts. The authority comes from precision.

7. **Writing style:** Cioran method per CLAUDE.md. Declarative. Short sentences. Precise vocabulary. The prose between code blocks reads like someone who built a protocol because the alternatives were intolerable.

---

## Layer 3: llms.txt Rewrite

### 3.1 Which files

- `frontend/public/llms.txt` — the main site version. This is what gets rewritten.
- `frontend/public/llms-full.txt` — the comprehensive reference. This gets expanded.
- `docs/llms.txt` — the Mintlify docs site version. Stays separate, not modified in this spec. It serves a different audience (docs readers vs. main site crawlers).

### 3.2 llms.txt (entry point, ~2-3KB)

```markdown
# General Market

General Market is a DeFi protocol with two products: Index Tracking Products (ITPs) — on-chain equivalents of ETFs with NAV-based pricing and BLS consensus — and Vision — sealed parimutuel prediction markets across 98+ real-world data sources.

## Index Tracking Products (ITPs)

On-chain index funds. Fixed basket of assets, NAV floats with underlying prices. Created with custom weights, rebalanced without changing NAV. Multi-oracle BLS consensus for trustless execution. Lending integration via Morpho.

- App: https://www.generalmarket.io
- API: https://www.generalmarket.io/api/itps
- Learn more: https://www.generalmarket.io/knowledge/on-chain-index-products

## Vision — AI Prediction Markets

Sealed parimutuel prediction markets. 98+ real-world data sources: weather, transport delays, earthquakes, crypto prices, nuclear reactor output, npm downloads, Twitch viewers, sports, stocks. AI bots compete. No counterparty, no order book, no front-running.

- App: https://www.generalmarket.io/index
- API: https://www.generalmarket.io/api/vision
- Learn more: https://www.generalmarket.io/knowledge/parimutuel-prediction-markets

## Knowledge Base

- [Parimutuel Prediction Markets](https://www.generalmarket.io/knowledge/parimutuel-prediction-markets)
- [On-Chain Index Products](https://www.generalmarket.io/knowledge/on-chain-index-products)
- [Real-World Data Markets](https://www.generalmarket.io/knowledge/real-world-data-markets)
- [Sealed Bet Mechanism](https://www.generalmarket.io/knowledge/sealed-bet-mechanism)
- [NAV Calculation](https://www.generalmarket.io/knowledge/nav-calculation)
- [BLS Consensus](https://www.generalmarket.io/knowledge/bls-consensus)
- [Build a Prediction Market Bot](https://www.generalmarket.io/knowledge/build-prediction-market-bot)
- [Prediction Market API](https://www.generalmarket.io/knowledge/prediction-market-api)
- [Index Product API](https://www.generalmarket.io/knowledge/on-chain-index-api)
- [Backtest Prediction Markets](https://www.generalmarket.io/knowledge/backtest-prediction-markets)

## For Builders

- Bot quickstart: https://www.generalmarket.io/knowledge/build-prediction-market-bot
- Vision API reference: https://www.generalmarket.io/knowledge/prediction-market-api
- Index API reference: https://www.generalmarket.io/knowledge/on-chain-index-api
- Full technical reference: https://www.generalmarket.io/llms-full.txt
- Documentation: https://docs.generalmarket.io

## Network

- L3 (Index Orbit): Chain ID 111222333, Collateral GM (18 decimals)
- Settlement: Arbitrum Sepolia, USDC (6 decimals)
```

**Note:** Vision app link is `/index` — this is the correct route in the codebase. The route name predates the "Index" product branding.

### 3.3 llms-full.txt (comprehensive reference, ~40-50KB)

Expand current 15.9KB file. Structure:

```
# General Market — Full Technical Reference

## 1. Protocol Overview
[2-3 citable paragraphs — what GM is, two products, key differentiators]

## 2. Index Tracking Products (ITPs)
### 2.1 Concept
[Citable definition paragraph]
### 2.2 NAV Formula
[Formula with worked numeric example]
### 2.3 Order Lifecycle
[All 10 steps with detail — not just names, full descriptions]
### 2.4 Rebalancing
[How weights change, NAV preservation]
### 2.5 Lending Integration
[Morpho integration, how it works]

## 3. Vision — Prediction Markets
### 3.1 Concept
[Citable definition paragraph]
### 3.2 Batch Lifecycle
[State transitions: open → sealed → resolved → claimable]
### 3.3 Sealed Bet Mechanism
[Commit-reveal, BLS verification]
### 3.4 Data Sources
[All 14 categories with example sources]
### 3.5 Bitmap Encoding
[Big-endian bit packing reference]
### 3.6 Resolution Types
[Binary, range, threshold — with examples]

## 4. API Reference — Vision
### 4.1 GET /api/vision/batches
[Full request/response JSON]
### 4.2 GET /api/vision/state
[Full request/response JSON]
### 4.3 POST /api/vision/bitmap
[Full request/response JSON]
... [all endpoints]

## 5. API Reference — Index
### 5.1 GET /api/itps
[Full request/response JSON]
... [all endpoints]

## 6. Architecture
[Oracles, data node, bridge, settlement, contracts]

## 7. Security Model
[BLS consensus, sealed bets, no single-point-of-failure]

## 8. Contract Addresses
[Testnet + mainnet]

## 9. Error Codes
[Complete list]

## 10. Glossary
[All domain-specific terms with definitions]
```

Each section opens with a citable paragraph. Cross-references to `/knowledge/` pages inline.

---

## Layer 4: JSON-LD Expansion

### 4.1 New Schema Generators

Add to `frontend/components/seo/JsonLd.tsx`:

```typescript
// For /knowledge/ pages — concept pages get proficiencyLevel "Beginner",
// builder pages get "Expert". Determined by frontmatter `category` field.
export function TechArticleJsonLd({
  title, description, url, datePublished, dateModified, proficiencyLevel
}: {
  title: string
  description: string
  url: string
  datePublished: string   // from frontmatter `date`
  dateModified: string    // same as datePublished; bumped on content updates
  proficiencyLevel: 'Beginner' | 'Expert'
})
// @type: TechArticle, publisher: Organization ref

export function DefinedTermJsonLd({
  name, description, url
}: {
  name: string
  description: string
  url: string
})
// @type: DefinedTerm, inDefinedTermSet: { @type: DefinedTermSet, name: "DeFi Concepts" }

export function FAQPageJsonLd({
  questions
}: {
  questions: Array<{ question: string; answer: string }>
})
// @type: FAQPage, mainEntity: Array<{ @type: Question, name, acceptedAnswer: { @type: Answer, text } }>

export function WebAPIJsonLd({
  name, description, url, documentationUrl
}: {
  name: string
  description: string
  url: string
  documentationUrl: string
})
// @type: WebAPI, provider: Organization ref

export function HowToJsonLd({
  name, description, steps
}: {
  name: string
  description: string
  steps: Array<{ name: string; text: string }>
})
// @type: HowTo, step: Array<{ @type: HowToStep, name, text }>
```

All types are valid Schema.org: `TechArticle` (subtype of `Article`), `DefinedTerm`, `FAQPage`, `WebAPI`, `HowTo`.

### 4.2 Schema Assignment

| Page | Schemas | proficiencyLevel |
|------|---------|-----------------|
| `parimutuel-prediction-markets` | TechArticle, DefinedTerm, FAQPage | Beginner |
| `on-chain-index-products` | TechArticle, DefinedTerm, FAQPage | Beginner |
| `real-world-data-markets` | TechArticle, FAQPage | Beginner |
| `sealed-bet-mechanism` | TechArticle, DefinedTerm, FAQPage | Beginner |
| `nav-calculation` | TechArticle, DefinedTerm, FAQPage | Beginner |
| `bls-consensus` | TechArticle, DefinedTerm, FAQPage | Beginner |
| `build-prediction-market-bot` | HowTo, TechArticle | Expert |
| `prediction-market-api` | WebAPI, TechArticle | Expert |
| `on-chain-index-api` | WebAPI, TechArticle | Expert |
| `backtest-prediction-markets` | HowTo, TechArticle | Expert |

### 4.3 JSON-LD Injection in Knowledge Pages

The knowledge page component reads `frontmatter.schema` and `frontmatter.faq`, then conditionally renders:

```typescript
{schema.includes('TechArticle') && <TechArticleJsonLd ... />}
{schema.includes('DefinedTerm') && <DefinedTermJsonLd ... />}
{schema.includes('FAQPage') && faq && <FAQPageJsonLd questions={faq.map(f => ({ question: f.q, answer: f.a }))} />}
{schema.includes('WebAPI') && <WebAPIJsonLd ... />}
{schema.includes('HowTo') && <HowToJsonLd ... />}
```

This keeps schema declaration in frontmatter (content authors control it) and rendering in the page component.

---

## Layer 5: Sitemap & Discovery

### 5.1 Sitemap Base URL Fix

Update `frontend/app/sitemap.ts` line 7:
```typescript
const baseUrl = 'https://www.generalmarket.io'
```
This matches `metadataBase` in the root layout. Currently `https://generalmarket.io` (no www).

### 5.2 Sitemap: Knowledge Hub

Add `/knowledge` to the `staticRoutes` array in `sitemap.ts`:

```typescript
{ path: '/knowledge', changeFrequency: 'weekly' as const, priority: 0.5 },
```

### 5.3 Sitemap: Knowledge Pages

Add to `frontend/app/sitemap.ts`, after the learn articles block:

```typescript
import { getKnowledgeSlugs, getKnowledgeArticle } from '@/lib/knowledge/articles'

// Knowledge pages
for (const slug of getKnowledgeSlugs()) {
  const article = getKnowledgeArticle(slug)
  const path = `/knowledge/${slug}`
  entries.push({
    url: localeUrl(path, defaultLocale),
    lastModified: article ? new Date(article.frontmatter.date) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
    alternates: alternatesForPath(path),
  })
}
```

### 5.4 Internal Linking

Knowledge pages link to each other where concepts overlap:
- `parimutuel-prediction-markets` → `sealed-bet-mechanism`, `real-world-data-markets`
- `on-chain-index-products` → `nav-calculation`, `bls-consensus`
- `build-prediction-market-bot` → `prediction-market-api`, `backtest-prediction-markets`
- Every page links to at least 2 other knowledge pages
- Pages with `/learn/` counterparts include a "Further reading" link to the learn article

---

## Implementation Sequence

1. **AI crawler infrastructure** (~30 min)
   - robots.txt rewrite
   - sitemap.ts base URL fix

2. **Knowledge route scaffolding** (~2 hours)
   - `frontend/lib/knowledge/articles.ts` helper module
   - `frontend/content/knowledge/` directory
   - `frontend/app/[locale]/knowledge/[slug]/page.tsx` route handler
   - `frontend/app/[locale]/knowledge/page.tsx` hub page

3. **JSON-LD expansion** (~1 hour)
   - 5 new schema generators in `frontend/components/seo/JsonLd.tsx`
   - Integration in knowledge page template via frontmatter `schema` field

4. **Sitemap update** (~30 min)
   - Import `getKnowledgeSlugs` / `getKnowledgeArticle` in `sitemap.ts`
   - Add knowledge page entries

5. **llms.txt rewrite** (~1 hour)
   - New `frontend/public/llms.txt`
   - Expanded `frontend/public/llms-full.txt` following section 3.3 structure

6. **Content creation** (~4-6 hours)
   - Write 10 knowledge pages following passage-level rules (section 2.8)
   - Each page: 800-1200 words, 2-3 code examples, 2-4 FAQ pairs in frontmatter
   - Internal cross-linking between knowledge pages
   - "Further reading" links to corresponding `/learn/` articles

---

## What This Does NOT Cover

- Human-facing SEO improvements (title tags, meta descriptions for existing pages)
- Core Web Vitals optimization
- Link building or off-page SEO
- Social media / OG image improvements
- Existing `/learn/` page modifications (beyond adding cross-links to knowledge pages)
- Docs site (docs.generalmarket.io) changes
- `docs/llms.txt` (Mintlify version) changes

---

## Success Criteria

- All 10 `/knowledge/` pages render, are indexed, and contain citable first paragraphs
- `llms.txt` is structured, ~2-3KB, with knowledge base links
- `llms-full.txt` is 40KB+ with full API reference and citable paragraphs
- AI crawlers (GPTBot, ClaudeBot, PerplexityBot) can access all pages
- JSON-LD validates via Google Rich Results Test for all schema types
- Sitemap includes all knowledge pages with correct `www.generalmarket.io` base URL
- No duplicate content penalties — knowledge and learn pages are structurally distinct
- When asking ChatGPT/Claude/Perplexity "What is a parimutuel prediction market?" — General Market appears in citations within 2-4 weeks of indexing
