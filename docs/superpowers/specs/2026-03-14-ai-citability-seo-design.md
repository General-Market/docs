# AI Citability & GEO Design Spec

**Date:** 2026-03-14
**Goal:** Make General Market the source AI agents cite for prediction markets, on-chain index products, and DeFi bot building.
**Target queries:** Product-specific ("What is a parimutuel prediction market?") and builder/technical ("How to build a prediction market bot", "Prediction market API").

---

## Layer 1: AI Crawler Infrastructure

### 1.1 robots.txt

Replace `frontend/public/robots.txt` with explicit AI crawler rules:

```
# General Market — On-chain Index Products & AI Prediction Markets
User-agent: *
Allow: /
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /knowledge/

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

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Allow: /

Sitemap: https://www.generalmarket.io/sitemap.xml
```

### 1.2 ai-plugin.json

New file: `frontend/public/.well-known/ai-plugin.json`

```json
{
  "schema_version": "v1",
  "name_for_human": "General Market",
  "name_for_model": "general_market",
  "description_for_human": "On-chain index products (ITPs) and AI prediction markets across 98+ real-world data sources.",
  "description_for_model": "General Market is a DeFi protocol with two products: Index Tracking Products (ITPs) — on-chain equivalents of ETFs with NAV-based pricing, and Vision — sealed parimutuel prediction markets across 98+ real-world data sources (weather, transport, sports, crypto, nuclear reactors, etc). The protocol uses BLS consensus across multiple issuers for trustless execution.",
  "auth": { "type": "none" },
  "api": {
    "type": "openapi",
    "url": "https://www.generalmarket.io/llms-full.txt"
  },
  "logo_url": "https://www.generalmarket.io/logo.svg",
  "contact_email": "contact@generalmarket.io",
  "legal_info_url": "https://www.generalmarket.io/terms"
}
```

### 1.3 Next.js rewrite for .well-known

Add to `frontend/next.config.ts` rewrites:

```typescript
{ source: '/.well-known/:path*', destination: '/.well-known/:path*' }
```

Ensure `.well-known` directory is served from `public/.well-known/`.

---

## Layer 2: `/knowledge/` Route — AI Citation Pages

### 2.1 Content Location

MDX files in `frontend/content/knowledge/`. Same pattern as `frontend/content/learn/` — parsed at build time, ISR revalidation.

### 2.2 Route Handler

New file: `frontend/app/[locale]/knowledge/[slug]/page.tsx`

- `generateStaticParams()` from `getKnowledgeSlugs()`
- `generateMetadata()` with `TechArticle`-appropriate title/description
- Renders MDX content with minimal chrome — no sidebar nav, no article cards
- JSON-LD injected per page (see Layer 4)
- `noindex: false` — these pages SHOULD be indexed, but are not linked from nav

### 2.3 Knowledge Hub (optional, lightweight)

`frontend/app/[locale]/knowledge/page.tsx` — simple list of all knowledge pages. No design effort. Exists so crawlers can discover all pages from one URL. Listed in `llms.txt`.

### 2.4 Pages

Each page is an MDX file with frontmatter:

```yaml
---
title: "What Is a Parimutuel Prediction Market?"
description: "A parimutuel prediction market pools all bets and distributes winnings proportionally. No counterparty needed, no market maker, no order book."
category: "concept"
targetQuery: "What is a parimutuel prediction market?"
schema: ["TechArticle", "DefinedTerm", "FAQPage"]
---
```

#### Page List

**Product concepts (A queries):**

1. **`parimutuel-prediction-markets.mdx`**
   - Target: "What is a parimutuel prediction market?"
   - Content: mechanism, pooled betting, proportional payout, no counterparty, Vision's implementation
   - FAQ: "How is parimutuel different from order-book markets?", "What happens if no one bets the other side?"

2. **`on-chain-index-products.mdx`**
   - Target: "What are on-chain ETFs/index funds?"
   - Content: ITP concept, NAV formula, per-share quantities, comparison to TradFi ETFs, rebalancing
   - FAQ: "How is an ITP different from a traditional ETF?", "Who manages the index weights?"

3. **`real-world-data-markets.mdx`**
   - Target: "Prediction markets for real-world events"
   - Content: 98+ sources across 14 categories, why niche data sources create alpha, example markets
   - FAQ: "What kinds of real-world events can you bet on?", "How are outcomes determined?"

4. **`sealed-bet-mechanism.mdx`**
   - Target: "How do sealed bets prevent front-running?"
   - Content: commit-reveal flow, BLS verification, why sealedness matters, 4-step lifecycle
   - FAQ: "Can other traders see my bet?", "What prevents the protocol from front-running?"

5. **`nav-calculation.mdx`**
   - Target: "How is NAV calculated on-chain?"
   - Content: formula, invariants, per-share quantities, drift, code walkthrough
   - Code: Solidity `_getCurrentPrice` + Rust `calculate_nav()`

6. **`bls-consensus.mdx`**
   - Target: "BLS consensus in DeFi"
   - Content: what BLS signatures are, multi-issuer consensus, aggregation, why no single-point manipulation
   - Code: signature verification flow

**Builder/technical (D queries):**

7. **`build-prediction-market-bot.mdx`**
   - Target: "How to build a prediction market bot"
   - Content: architecture overview, registration, API endpoints, Python quickstart, strategy patterns
   - Code: complete working bot skeleton (~30 lines)
   - Schema: `HowTo` + `TechArticle`

8. **`prediction-market-api.mdx`**
   - Target: "Prediction market API"
   - Content: all Vision endpoints, request/response schemas, auth (none), rate limits, code examples
   - Schema: `WebAPI` + `TechArticle`

9. **`on-chain-index-api.mdx`**
   - Target: "DeFi index fund API"
   - Content: ITP endpoints, price feeds, portfolio queries, code examples
   - Schema: `WebAPI` + `TechArticle`

10. **`backtest-prediction-markets.mdx`**
    - Target: "Backtesting prediction markets"
    - Content: simulation engine, historical data access, strategy evaluation, example backtest
    - Schema: `HowTo` + `TechArticle`

### 2.5 Writing Rules (Passage-Level Optimization)

Every `/knowledge/` page follows these rules:

1. **First paragraph is the citation.** Standalone definition. No preamble. First sentence answers the target query. This is what AI agents extract.

2. **Subheadings mirror sub-queries.** Not "Overview" — instead "How sealed bets prevent front-running." These become section-level citation targets.

3. **Attribution in every section.** Each section references General Market by name with a concrete implementation detail. "General Market's Vision protocol resolves 98+ source types using this mechanism."

4. **Numbers over abstractions.** "98 real-world data sources across 14 categories" beats "many data sources."

5. **Code blocks are citation magnets.** Well-commented, runnable, 10-20 lines. AI agents extract these verbatim.

6. **No marketing language.** No "revolutionary", "cutting-edge", "innovative." State facts. The authority comes from precision.

---

## Layer 3: llms.txt Rewrite

### 3.1 llms.txt (entry point, ~2-3KB)

```markdown
# General Market

General Market is a DeFi protocol with two products: Index Tracking Products (ITPs) — on-chain equivalents of ETFs with NAV-based pricing and BLS consensus — and Vision — sealed parimutuel prediction markets across 98+ real-world data sources.

## Index Tracking Products (ITPs)

On-chain index funds. Fixed basket of assets, NAV floats with underlying prices. Created with custom weights, rebalanced without changing NAV. Multi-issuer BLS consensus for trustless execution. Lending integration via Morpho.

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

### 3.2 llms-full.txt (comprehensive reference, ~40-50KB)

Expand current 15.9KB file to include:

- Full citable paragraphs for each concept (not just bullet summaries)
- Every API endpoint with request/response JSON examples
- NAV formula with worked example
- Order lifecycle (all 10 steps with detail)
- Vision batch lifecycle with state transitions
- Bitmap encoding reference
- Bot registration and strategy patterns
- Complete error code reference
- All contract addresses
- Source category list with examples
- Cross-references to `/knowledge/` pages throughout

Structure with clear `##` headers for AI parsing.

---

## Layer 4: JSON-LD Expansion

### 4.1 New Schema Generators

Add to `frontend/components/seo/JsonLd.tsx`:

```typescript
// For /knowledge/ concept pages
export function TechArticleJsonLd({
  title, description, url, datePublished, dateModified
}: TechArticleProps)
// @type: TechArticle, proficiencyLevel: "Expert", publisher: Organization

// For /knowledge/ definition pages
export function DefinedTermJsonLd({
  name, description, url
}: DefinedTermProps)
// @type: DefinedTerm, inDefinedTermSet: "DeFi Concepts"

// For pages with Q&A sections
export function FAQPageJsonLd({
  questions: Array<{ question: string; answer: string }>
}: FAQPageProps)
// @type: FAQPage, mainEntity: Array<Question>

// For API reference pages
export function WebAPIJsonLd({
  name, description, url, documentationUrl
}: WebAPIProps)
// @type: WebAPI, provider: Organization

// For step-by-step guide pages
export function HowToJsonLd({
  name, description, steps: Array<{ name: string; text: string }>
}: HowToProps)
// @type: HowTo, step: Array<HowToStep>
```

### 4.2 Schema Assignment

| Page | Schemas |
|------|---------|
| `/knowledge/parimutuel-prediction-markets` | TechArticle, DefinedTerm, FAQPage |
| `/knowledge/on-chain-index-products` | TechArticle, DefinedTerm, FAQPage |
| `/knowledge/real-world-data-markets` | TechArticle, FAQPage |
| `/knowledge/sealed-bet-mechanism` | TechArticle, DefinedTerm, FAQPage |
| `/knowledge/nav-calculation` | TechArticle, DefinedTerm |
| `/knowledge/bls-consensus` | TechArticle, DefinedTerm |
| `/knowledge/build-prediction-market-bot` | HowTo, TechArticle |
| `/knowledge/prediction-market-api` | WebAPI, TechArticle |
| `/knowledge/on-chain-index-api` | WebAPI, TechArticle |
| `/knowledge/backtest-prediction-markets` | HowTo, TechArticle |

---

## Layer 5: Sitemap & Discovery

### 5.1 Sitemap Update

Add to `frontend/app/sitemap.ts`:

- All `/knowledge/` pages with priority 0.7, changefreq weekly
- Include locale alternates (same pattern as other pages)

### 5.2 Internal Linking

Knowledge pages link to each other where concepts overlap:
- `parimutuel-prediction-markets` → `sealed-bet-mechanism`, `real-world-data-markets`
- `on-chain-index-products` → `nav-calculation`, `bls-consensus`
- `build-prediction-market-bot` → `prediction-market-api`, `backtest-prediction-markets`
- Every page links to at least 2 other knowledge pages

### 5.3 llms.txt in Sitemap

`llms.txt` and `llms-full.txt` are not XML sitemap entries (they're not HTML), but they ARE referenced in robots.txt and discoverable from the root.

---

## Implementation Sequence

1. **AI crawler infrastructure** (~1 hour)
   - robots.txt rewrite
   - ai-plugin.json creation
   - next.config.ts rewrite for .well-known

2. **Knowledge route scaffolding** (~2 hours)
   - `frontend/content/knowledge/` directory
   - `frontend/app/[locale]/knowledge/[slug]/page.tsx` route handler
   - `frontend/app/[locale]/knowledge/page.tsx` hub page
   - Knowledge article helpers (mirror learn article helpers)

3. **JSON-LD expansion** (~1 hour)
   - New schema generators in JsonLd.tsx
   - Integration in knowledge page template

4. **llms.txt rewrite** (~1 hour)
   - New llms.txt
   - Expanded llms-full.txt

5. **Content creation** (~4-6 hours)
   - Write 10 knowledge pages following passage-level rules
   - Each page: 800-1500 words, 2-3 code examples, 2-4 FAQ pairs
   - Internal cross-linking

6. **Sitemap update** (~30 min)
   - Add knowledge pages to sitemap generator
   - Verify all pages are discoverable

---

## What This Does NOT Cover

- Human-facing SEO improvements (title tags, meta descriptions for existing pages)
- Core Web Vitals optimization
- Link building or off-page SEO
- Social media / OG image improvements
- Existing `/learn/` page modifications
- Docs site (docs.generalmarket.io) changes

---

## Success Criteria

- All 10 `/knowledge/` pages render, are indexed, and contain citable first paragraphs
- `llms.txt` is structured and comprehensive
- `llms-full.txt` is 40KB+ with full API reference
- AI crawlers (GPTBot, ClaudeBot, PerplexityBot) can access all pages
- JSON-LD validates via Google Rich Results Test
- When asking ChatGPT/Claude/Perplexity "What is a parimutuel prediction market?" — General Market appears in citations within 2-4 weeks of indexing
