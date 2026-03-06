# SEO Content Strategy — Vision (General Market)
## Design Document — 2026-02-27

### Goal
Capture blue-ocean keywords (AI prediction markets, bot trading) and high-intent comparison traffic (Polymarket/Kalshi alternatives) through 7 new MDX-powered learn pages.

### Audience
Primary: AI/bot builders who want to deploy trading agents on prediction markets.
Secondary: Traders actively comparison-shopping between Polymarket, Kalshi, and alternatives.

---

## 1. MDX Infrastructure

### Setup
Add `@next/mdx` and `gray-matter` to the frontend. MDX files live in `frontend/content/learn/`.

Each `.mdx` file has YAML frontmatter:
```yaml
---
title: "AI Prediction Markets: Why Your Bot Should Trade Here"
description: "Vision is the first prediction market designed for AI agents..."
keywords: ["AI prediction market", "prediction market bot", "AI trading"]
date: "2026-02-27"
author: "General Market"
slug: "ai-prediction-markets"
---
```

### Routing
A catch-all dynamic route at `frontend/app/[locale]/learn/[slug]/page.tsx`:

1. Reads `content/learn/{slug}.mdx`
2. Parses frontmatter with `gray-matter`
3. Compiles MDX body with `@next/mdx`
4. Exports `generateMetadata()` from frontmatter (title, description, canonical, OG type: article, Twitter card)
5. Injects Article + BreadcrumbList JSON-LD schema automatically
6. Renders with custom MDX components: `<Callout>`, `<ComparisonTable>`, `<CodeBlock>`, `<FeatureGrid>`

### Hub page
`frontend/app/[locale]/learn/page.tsx` — styled like `/index` (hero band, section bar, grid cards — text-only, no images). Reads all `.mdx` files from `content/learn/`, extracts frontmatter, renders a 3-column grid of article cards (title, description, category tag, reading time). Hero band with "Learn" H1 and subtitle. Section bar showing "Articles" with count. This fixes the broken breadcrumb (current `/learn/what-are-itps` breadcrumb points to `/learn` which 404s today). Uses existing design tokens and layout patterns (`hero-band`, `section-bar` CSS classes, `border-border-light`, `bg-surface`).

### Migration
The existing `/learn/what-are-itps` page (currently a 364-line `.tsx` file) gets migrated to `content/learn/what-are-itps.mdx` with the same content. The custom `.tsx` route file is deleted.

### Sitemap update
`frontend/app/sitemap.ts` updated to:
1. Read all MDX files from `content/learn/`
2. Add each as a sitemap entry with `lastModified` from frontmatter `date`
3. Add `/learn` hub page

### i18n
MDX content is English-only for batch 1. The `generateMetadata()` function pulls `title` and `description` from frontmatter (not from `seo.json`). Non-EN locales fall back to EN content with EN metadata. This avoids blocking on translations for the initial SEO push. i18n can be added later by placing locale-specific MDX files in `content/learn/{locale}/`.

---

## 2. Page Plan — Batch 1 (7 Pages)

### Page 1: `/learn` (Hub)
**Purpose:** Index page linking to all learn articles. Fixes broken breadcrumb. Internal linking anchor.
**Layout:** Hero band + section bar + 3-column grid of text-only article cards. Each card shows title, description, category tag (e.g. "AI Trading", "Comparison", "Technical"), and estimated reading time. Matches the visual language of `/index` page (hero-band, section-bar patterns).
**Schema:** CollectionPage + BreadcrumbList (Home > Learn)
**SEO metadata:** from `seo.pages.learn` in i18n.
**No target keyword** — this is a structural page.

### Page 2: `/learn/ai-prediction-markets`
**Target keyword:** "AI prediction market" (8,100/mo, difficulty 3)
**Secondary:** "AI agents prediction markets", "autonomous prediction markets"
**Content outline (~1,500 words):**
- H1: AI Prediction Markets: Where Agents Compete for Alpha
- What makes a prediction market "AI-native" (sealed bets, bitmap portfolios, API-first)
- Why AI agents need different infrastructure than human traders (no front-running, thousands of simultaneous positions, tick-based settlement)
- Vision's 25,000+ markets across 79 data sources — the breadth argument
- The alpha argument: 19 traders/market vs 1,200 on Polymarket
- CTA: `npx generalmarket init` to deploy your first agent
**Schema:** Article + BreadcrumbList
**Internal links to:** `/learn/build-prediction-market-bot`, `/sources`, homepage leaderboard

### Page 3: `/learn/prediction-market-bots`
**Target keyword:** "prediction market bot" (5,400/mo, difficulty 3)
**Secondary:** "prediction market trading bot", "automated prediction market"
**Content outline (~1,200 words):**
- H1: Prediction Market Bots: How Automated Agents Are Beating Human Traders
- The bot landscape: Polymarket arbitrage bots ($150K+ profits), PredictEngine, manual strategy tools
- Why most bots fail on Polymarket (efficient markets, front-running, public orderbook)
- What Vision does differently: sealed bets prevent front-running, exotic markets are inefficient, parimutuel pools reward conviction not speed
- Bot performance on Vision: link to live leaderboard
- CTA: Register your bot (free, on-chain)
**Schema:** Article + BreadcrumbList
**Internal links to:** `/learn/ai-prediction-markets`, `/learn/build-prediction-market-bot`, homepage

### Page 4: `/learn/build-prediction-market-bot`
**Target keyword:** "how to build prediction market bot" (2,400/mo, difficulty 2)
**Secondary:** "prediction market bot tutorial", "Claude Code trading bot" (1,900/mo)
**Content outline (~2,000 words):**
- H1: Build a Prediction Market Bot in 10 Minutes
- Prerequisites: wallet, USDC on Arbitrum, Claude Code (or any agent framework)
- Step 1: `npx generalmarket init` — what it scaffolds
- Step 2: Understanding the data sources (pick your niche)
- Step 3: Writing a simple strategy (moving average on earthquake frequency, or weather temperature delta)
- Step 4: Submitting bets via the API (bitmap encoding, sealed commit, reveal)
- Step 5: Monitoring performance on the leaderboard
- Code snippets throughout (TypeScript)
- CTA: Deploy your bot now
**Schema:** Article + HowTo + BreadcrumbList
**Internal links to:** `/learn/ai-prediction-markets`, `/sources`, `/learn/prediction-market-bots`

### Page 5: `/learn/polymarket-vs-general-market`
**Target keyword:** "polymarket alternative" (12,100/mo, difficulty 5)
**Secondary:** "polymarket vs general market", "polymarket alternative 2026"
**Content outline (~1,500 words):**
- H1: Polymarket vs General Market (Vision): Which Prediction Market Is Right for You?
- Fair, honest comparison table:

| Feature | Polymarket | Vision (General Market) |
|---------|-----------|----------------------|
| Markets | ~8,000 (politics, crypto, sports, culture) | 25,000+ (79 data sources including weather, earthquakes, space, wildlife, tech) |
| Model | Order book (CLOB) | Sealed parimutuel pools |
| Front-running | Possible (public orderbook) | Impossible (sealed commit-reveal) |
| Fee | Variable spread | 0.3% on profit only |
| KYC | Required (US) | Not required |
| Bot support | API + third-party tools | Native (`npx generalmarket init`, on-chain bot registry) |
| Avg traders/market | ~1,200 | ~19 |
| Settlement | UMA oracle | BLS 3-of-5 consensus |
| Chain | Polygon | Arbitrum Orbit L3 |

- When to use Polymarket: high-liquidity political/crypto markets, proven track record, US-regulated
- When to use Vision: AI agents, exotic data, low-competition markets, sealed bets, no KYC
- Honest acknowledgment: Polymarket has more liquidity and a longer track record. Vision targets a different niche.
- CTA: Try Vision (link to homepage) or read more about AI prediction markets
**Schema:** Article + BreadcrumbList
**Internal links to:** `/learn/ai-prediction-markets`, `/learn/kalshi-vs-general-market`, `/about`

### Page 6: `/learn/kalshi-vs-general-market`
**Target keyword:** "kalshi alternative" (6,600/mo, difficulty 5)
**Secondary:** "kalshi vs general market"
**Content outline (~1,200 words):**
- H1: Kalshi vs General Market (Vision): Regulated Exchange vs Decentralized Protocol
- Same honest comparison format as above but Kalshi-specific:

| Feature | Kalshi | Vision (General Market) |
|---------|-------|----------------------|
| Regulation | CFTC-licensed DCM | Decentralized protocol |
| Markets | Politics, sports, economics, weather, culture | 25,000+ across 79 data sources |
| Model | Order book (CLOB) | Sealed parimutuel pools |
| Min bet | $1 | $0.10 |
| KYC | Required (US-only) | Not required |
| Bot support | API | Native bot registry + CLI |
| Settlement | Centralized clearing | BLS 3-of-5 consensus |
| Chain | Off-chain (centralized) | Arbitrum Orbit L3 (on-chain) |

- When to use Kalshi: US regulatory compliance matters, traditional finance UX, sports betting
- When to use Vision: global access, AI agents, exotic data, on-chain transparency
- CTA: same pattern
**Schema:** Article + BreadcrumbList
**Internal links to:** `/learn/polymarket-vs-general-market`, `/learn/ai-prediction-markets`, `/about`

### Page 7: `/learn/sealed-prediction-markets`
**Target keyword:** "sealed bid prediction market" (480/mo, difficulty 1)
**Secondary:** "prediction market no front running", "parimutuel prediction market" (1,300/mo)
**Content outline (~1,000 words):**
- H1: Sealed Prediction Markets: Why Your Bets Should Be Private
- The front-running problem in prediction markets (public orderbooks, MEV, whale watching)
- How sealed commit-reveal works (hash on-chain, reveal to issuers, BLS settlement)
- Why this matters for AI agents (bots can't copy your strategy if they can't see your bets)
- Parimutuel model: winners split losers' stakes, 0.3% fee on profit only
- Comparison: order book (Polymarket/Kalshi) vs sealed parimutuel (Vision)
- CTA: Try sealed betting on Vision
**Schema:** Article + BreadcrumbList
**Internal links to:** `/learn/ai-prediction-markets`, `/learn/prediction-market-bots`, `/about`

---

## 3. Technical SEO Fixes (Ship with Batch 1)

These are low-effort, high-impact fixes to ship alongside the new content:

### 3a. Add `/source/[sourceId]` to sitemap
Currently missing. These are 79 fully-formed pages with metadata and content. Read the sources list and add each as a sitemap entry.

### 3b. Add `changeFrequency` and `priority` to sitemap
Currently missing on all entries. Set:
- Homepage: `daily`, priority `1.0`
- `/index`, `/sources`: `daily`, priority `0.9`
- `/learn/*`: `monthly`, priority `0.8`
- `/about`: `monthly`, priority `0.7`
- `/itp/*`: `daily`, priority `0.8`
- `/source/*`: `weekly`, priority `0.6`

### 3c. Fix `/learn` hub 404
The existing `/learn/what-are-itps` breadcrumb points to `/learn` which doesn't exist. The new hub page fixes this.

### 3d. Add Dataset schema to `/source/[sourceId]`
Each source page describes a data feed. Add `@type: Dataset` JSON-LD with name, description, creator, temporal coverage.

---

## 4. Internal Linking Strategy

Every new learn page links to:
1. **2-3 other learn pages** (topical cluster)
2. **At least 1 product page** (`/sources`, `/`, `/index`)
3. **The learn hub** (via breadcrumb)

The learn hub links to every article (hub-and-spoke model).

Update existing pages to link back:
- **Footer:** Replace "What are ITPs?" link with "Learn" hub link
- **Homepage:** add "Learn" section in navigation linking to hub
- `/about`: add "Learn more" links to relevant articles
- `/sources`: add contextual links to `/learn/ai-prediction-markets` and `/learn/prediction-market-bots`
- `/learn/what-are-itps`: add cross-links to new articles in its "Further Reading" section

---

## 5. Schema Markup Per Page

| Page | Schemas |
|---|---|
| `/learn` (hub) | BreadcrumbList, CollectionPage |
| `/learn/ai-prediction-markets` | Article, BreadcrumbList |
| `/learn/prediction-market-bots` | Article, BreadcrumbList |
| `/learn/build-prediction-market-bot` | Article, HowTo, BreadcrumbList |
| `/learn/polymarket-vs-general-market` | Article, BreadcrumbList |
| `/learn/kalshi-vs-general-market` | Article, BreadcrumbList |
| `/learn/sealed-prediction-markets` | Article, BreadcrumbList |
| `/source/[sourceId]` (existing, enhanced) | Dataset, BreadcrumbList |

All Article schemas include: `headline`, `description`, `author` (Organization), `publisher` (Organization with logo), `datePublished`, `dateModified`, `mainEntityOfPage`, `image`.

---

## 6. Keyword-to-Page Mapping Summary

| Priority | Keyword | Volume | Diff | Page |
|---|---|---|---|---|
| 1 | AI prediction market | 8,100 | 3 | `/learn/ai-prediction-markets` |
| 2 | prediction market bot | 5,400 | 3 | `/learn/prediction-market-bots` |
| 3 | how to build prediction market bot | 2,400 | 2 | `/learn/build-prediction-market-bot` |
| 4 | polymarket alternative | 12,100 | 5 | `/learn/polymarket-vs-general-market` |
| 5 | kalshi alternative | 6,600 | 5 | `/learn/kalshi-vs-general-market` |
| 6 | sealed bid prediction market | 480 | 1 | `/learn/sealed-prediction-markets` |
| 6 | parimutuel prediction market | 1,300 | 2 | `/learn/sealed-prediction-markets` |
| 7 | Claude Code trading bot | 1,900 | 1 | `/learn/build-prediction-market-bot` |
| — | (hub, structural) | — | — | `/learn` |

**Total addressable monthly search volume: ~38,280**
**Average difficulty: 3.0** (scale 1-10)
**Competitor overlap: Near zero** for blue ocean pages; medium for comparison pages.

---

## 7. i18n Metadata Updates

Add to `messages/en/seo.json` under `pages`:

```json
"learn": {
  "title": "Learn — AI Prediction Markets, Bots & Trading Guides",
  "description": "Tutorials and guides for AI prediction market trading. Build bots, compare platforms, understand sealed parimutuel markets."
}
```

Article-level metadata comes from MDX frontmatter (not `seo.json`), so no per-article i18n entries needed for batch 1.

---

## 8. Verification Checklist

After implementation, verify:
- [ ] `npx tsc --noEmit` — clean compile
- [ ] Visit `/learn` — hub renders with all article cards, correct count
- [ ] Visit each `/learn/{slug}` — article renders from MDX, correct H1/metadata
- [ ] Check JSON-LD in browser dev tools on each page (Article, BreadcrumbList, HowTo on tutorial)
- [ ] Verify sitemap at `/sitemap.xml` includes all new routes + `/source/*` pages
- [ ] Verify `/learn` breadcrumb no longer 404s
- [ ] Footer link updated from "What are ITPs?" to "Learn"
- [ ] `/learn/what-are-itps` "Further Reading" links to new articles
- [ ] MDX code blocks render with syntax highlighting
- [ ] Comparison tables render correctly on mobile

---

## 9. Competitive Intelligence (from Cross-Platform Gap Analysis)

Independent audit of 5 competitor platforms confirms the opportunity. Source: `docs/plans/vision-competitor-analysis.md`.

### Industry-Wide Content Gaps

No competitor (0/5) covers these topics well:

| Gap | Polymarket | Kalshi | Azuro | Manifold | Metaculus |
|-----|-----------|--------|-------|----------|-----------|
| Trading/betting strategy guides | 0/10 | 2/10 | 0/10 | 1/10 | 3/10 |
| Position sizing / bankroll math | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 |
| Backtesting tools or guides | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 |
| "How to estimate probabilities" | 0/10 | 0/10 | 0/10 | 0/10 | 2/10 |
| Bot-building tutorial (end-to-end) | 0/10 | 0/10 | 0/10 | 0/10 | 3/10 |
| Competitor comparison pages | 0/10 | 1/10 | 1/10 | 0/10 | 0/10 |
| Post-mortem analysis (why crowd was wrong) | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 |

**Key competitor insights:**
- **Polymarket** has 100+ pages of API/developer docs but zero strategy guides, zero bot tutorials, zero comparison pages. All education content is produced by third parties — Polymarket gives away the entire SEO surface for trader education.
- **Kalshi** has strategy content scattered across 3 domains (help.kalshi.com, news.kalshi.com, kalshi.com/blog) with no unified curriculum. Thin Substack posts, not deep guides. Nobody teaches the math.
- **Azuro** invested in developer docs (React SDK, 30+ hooks) but completely ignored bettor education.
- **Manifold/Metaculus** are not direct competitors (play-money / forecasting) but confirm the pattern: nobody teaches you how to actually get good at prediction markets.

### What This Validates in Our Plan

- **Bot tutorial** (`/learn/build-prediction-market-bot`): 0/5 competitors have one. Polymarket has a GitHub agents repo with no walkthrough. Kalshi has SDKs with no strategy implementation.
- **Comparison pages** (`/learn/polymarket-vs-general-market`, `/learn/kalshi-vs-general-market`): Polymarket has zero comparison pages. Kalshi has one election-focused piece. Third-party review sites own ALL "X vs Y" queries.
- **Sealed/parimutuel explainer** (`/learn/sealed-prediction-markets`): Nobody explains this mechanism in accessible terms — only academic papers.

### Batch 2 Content Roadmap (Informed by Gap Analysis)

After batch 1 ranks, these are the next opportunities:

1. **Post-mortem analysis series** ("Why Crowds Get It Wrong") — 0/5 competitors cover this. Vision resolves thousands of ticks/day across 25K+ markets, creating a unique dataset for analyzing prediction failures. Recurring content keeps the site fresh for crawlers. Target: "prediction market accuracy", "why prediction markets fail".

2. **Category landing pages** — Weather markets, earthquake markets, space weather. Completely uncontested niches. Target: "weather prediction market" (4.4K/mo), "earthquake prediction market" (880/mo).

3. **Strategy handbook** ("The Math of Prediction Markets") — Position sizing, Kelly Criterion, EV in parimutuel markets, bankroll management. 0/5 competitors teach the math. Vision's deterministic parimutuel formulas make it a cleaner pedagogical framework than CLOB. Lower search volume but builds deep authority and E-E-A-T signals.

4. **Programmatic SEO** — Auto-generate pages from 79 data sources (e.g., `/markets/weather`, `/markets/earthquakes`). High page count for long-tail coverage.

---

## 10. Out of Scope (Batch 1)

- **Batch 2 content** (see roadmap above — ships after batch 1 ranks)
- **Programmatic SEO** (auto-generating pages from 79 data sources — separate project)
- **i18n translations** (EN-only for batch 1, localization as a follow-up)
- **Link building / PR outreach** (getting listed on "best prediction market 2026" roundups — not a code task)
- **Per-page OG images** (dynamic OG images for each article — nice-to-have, not blocking)

---

## 11. Success Metrics

Track via Google Search Console (connect if not already):
- **Impressions** for target keywords within 4-6 weeks
- **Click-through rate** from SERP
- **Average position** for blue ocean keywords (target: top 10 within 8 weeks)
- **Organic traffic** to `/learn/*` pages

Track via PostHog:
- **Learn page → product page** conversion (e.g., `/learn/build-prediction-market-bot` → `npx generalmarket init` or bot registration)
- **Comparison page → signup** conversion

---

## 12. File Structure After Implementation

```
frontend/
├── content/
│   └── learn/
│       ├── what-are-itps.mdx              (migrated from .tsx)
│       ├── ai-prediction-markets.mdx       (NEW)
│       ├── prediction-market-bots.mdx      (NEW)
│       ├── build-prediction-market-bot.mdx (NEW)
│       ├── polymarket-vs-general-market.mdx(NEW)
│       ├── kalshi-vs-general-market.mdx    (NEW)
│       └── sealed-prediction-markets.mdx   (NEW)
├── app/
│   └── [locale]/
│       └── learn/
│           ├── page.tsx                    (NEW — hub page)
│           ├── [slug]/
│           │   └── page.tsx               (NEW — MDX renderer)
│           └── what-are-itps/
│               └── page.tsx               (DELETED — migrated to MDX)
├── components/
│   └── mdx/
│       ├── Callout.tsx                    (NEW)
│       ├── ComparisonTable.tsx            (NEW)
│       ├── CodeBlock.tsx                  (NEW)
│       └── FeatureGrid.tsx               (NEW)
└── lib/
    └── mdx.ts                             (NEW — MDX compilation + frontmatter parsing)
```

---

## 13. Dependencies

| Package | Purpose |
|---|---|
| `@next/mdx` | MDX support in Next.js |
| `gray-matter` | YAML frontmatter parsing |
| `rehype-highlight` or `shiki` | Code syntax highlighting (for bot tutorial) |
| `remark-gfm` | GitHub-flavored markdown (tables, strikethrough) |
