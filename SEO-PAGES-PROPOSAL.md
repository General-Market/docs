# Page Proposals: About + Learn

Based on analysis of **Resend.com** (best-in-class SEO for developer tools) and **Polymarket** (largest prediction market).

---

## Key Takeaways from Research

**Resend does right:**
- H1 = exact target keyword, not a creative tagline
- `/humans/{name}` pages for every team member (E-E-A-T gold)
- Blog mixes educational content (60%) with product updates (40%)
- Every blog post attributed to a real person with a profile page
- Investor names listed on About page (47+ names including Figma/Vercel/Sentry founders)
- Incident reports and SOC 2 compliance as trust signals
- Feature pages structured as narrative (problem > solution > proof > CTA), not spec sheets

**Polymarket does right:**
- Product IS the pitch — homepage is a Bloomberg terminal, not a landing page
- Volume as the ultimate trust signal ("$461M traded" > any about page)
- Education is pull, not push — in a separate help center
- Sports examples over crypto jargon in educational content
- Press mentions (Bloomberg, FT) as authority, not self-promotion
- Anti-marketing tone — zero superlatives, just data

**What GM should take from each:**
- From Resend: the About page structure, team attribution, investor naming, blog architecture
- From Polymarket: the tone (data > fluff), letting numbers speak, sports-grade simplicity in explanations
- From neither: neither has the "AI agents competing" angle — this is GM's unique content moat

---

## Page 1: `/about`

**Target queries:** "general market", "general market team", "general market protocol", "who built general market"

**Route:** `app/[locale]/about/page.tsx`

### Structure

```
┌─────────────────────────────────────────────┐
│ HEADER (nav)                                │
├─────────────────────────────────────────────┤
│                                             │
│  [H1] About General Market                 │
│                                             │
│  One paragraph. What GM is. No fluff.       │
│  "General Market is an on-chain protocol    │
│  for index products and AI prediction       │
│  markets. Built on Arbitrum Orbit L3."      │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [H2] What We Build                         │
│                                             │
│  Two products, two columns:                 │
│                                             │
│  ┌──────────────┐  ┌──────────────────┐    │
│  │ INDEX         │  │ VISION            │    │
│  │ PRODUCTS      │  │ AI PREDICTION     │    │
│  │               │  │ MARKETS           │    │
│  │ Create and    │  │ AI agents         │    │
│  │ trade ETF-    │  │ compete by        │    │
│  │ like index    │  │ building          │    │
│  │ products on-  │  │ portfolios of     │    │
│  │ chain. 100+   │  │ predictions       │    │
│  │ assets, real- │  │ across 25,000+    │    │
│  │ time NAV,     │  │ markets. P2P      │    │
│  │ single-tx     │  │ betting, BLS-     │    │
│  │ deployment.   │  │ verified.         │    │
│  │               │  │                   │    │
│  │ [Explore →]   │  │ [Leaderboard →]   │    │
│  └──────────────┘  └──────────────────┘    │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [H2] Numbers                               │
│                                             │
│  Live stats bar (pulled from SSE/API):      │
│  ┌──────┬──────┬──────┬──────┬──────┐      │
│  │ ITPs │ AUM  │ Bets │ Agents│ Vol  │      │
│  │  42  │ $2.1M│ 1,847│  31  │ $890K│      │
│  └──────┴──────┴──────┴──────┴──────┘      │
│                                             │
│  No adjectives. Just the numbers.           │
│  (Polymarket model: volume speaks.)         │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [H2] Team                                  │
│                                             │
│  Grid of team members. Each card:           │
│  ┌─────────────────┐                        │
│  │ [photo]         │                        │
│  │ Name            │                        │
│  │ Role            │                        │
│  │ @twitter  🔗web │                        │
│  └─────────────────┘                        │
│                                             │
│  (Resend model: real people = trust.)       │
│  (No individual /humans/ pages yet —        │
│   add those later if blog launches.)        │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [H2] Technology                            │
│                                             │
│  Short paragraphs, not a spec sheet:        │
│                                             │
│  • Settlement: Arbitrum Orbit L3 with BLS   │
│    signature verification. 3-of-5 keeper    │
│    consensus for bet resolution.            │
│                                             │
│  • Smart Contracts: Non-custodial escrow.   │
│    All funds held in contract, never by     │
│    the platform.                            │
│                                             │
│  • Data: 100+ price sources aggregated      │
│    in real-time. 25,000+ prediction         │
│    markets from Polymarket, Kalshi, etc.    │
│                                             │
│  [View Docs →]  [View Contract →]           │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [H2] Press & Recognition                   │
│                                             │
│  Logos or text mentions of any press,       │
│  grants, accelerators, notable users.       │
│  If none yet: skip this section entirely.   │
│  (Don't fake it. Polymarket lets Bloomberg  │
│   write their story.)                       │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [H2] Contact                               │
│                                             │
│  Discord | Twitter | docs@generalmarket.io  │
│                                             │
│  (Resend model: ContactPoint schema for     │
│   Google Knowledge Panel.)                  │
│                                             │
├─────────────────────────────────────────────┤
│ FOOTER                                      │
└─────────────────────────────────────────────┘
```

### Schema Markup

```json
{
  "@type": "AboutPage",
  "name": "About General Market",
  "description": "...",
  "mainEntity": {
    "@type": "Organization",
    "name": "General Market",
    "url": "https://generalmarket.io",
    "description": "On-chain protocol for index products and AI prediction markets.",
    "sameAs": [
      "https://x.com/otc_max",
      "https://discord.gg/xsfgzwR6"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "url": "https://discord.gg/xsfgzwR6"
    }
  }
}
```

### Metadata

```json
{
  "title": "About — General Market",
  "description": "The team and technology behind General Market. On-chain index products and AI prediction markets built on Arbitrum Orbit L3."
}
```

### Implementation Notes

- Server component — all content is static/translatable, perfect for SSR
- The "Numbers" section can use `getItpSummaries()` server-side for ITP count/AUM
- Team data can be a simple JSON array in the codebase (no CMS needed)
- i18n: add `about` keys to all 4 locale message files
- Add to sitemap, footer nav, and header dropdown

---

## Page 2: `/learn/what-are-itps`

**Target queries:** "what is a crypto index fund", "on-chain ETF", "tokenized index products", "DeFi index fund explained", "what is an ITP"

**Route:** `app/[locale]/learn/what-are-itps/page.tsx`

This is the single highest-value educational page. It targets informational queries that are the top of the funnel for anyone researching DeFi index products.

### Why This Specific Article

Resend's highest-traffic pages aren't their homepage — they're their framework guides (`/docs/send-with-nextjs`). Each one targets a specific long-tail query. For GM, the equivalent is "what is a crypto index fund" — a query with real volume and no great on-chain answer yet.

### Structure

```
┌─────────────────────────────────────────────┐
│ HEADER (nav)                                │
├─────────────────────────────────────────────┤
│                                             │
│  Learn · 8 min read                         │
│                                             │
│  [H1] What Are Index Tracking              │
│       Products (ITPs)?                      │
│                                             │
│  The on-chain equivalent of ETFs.           │
│  A single token that holds a basket of      │
│  crypto assets with fixed weights.          │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [H2] The 30-Second Version                │
│                                             │
│  You want exposure to "DeFi" but don't     │
│  want to buy 10 tokens separately.         │
│                                             │
│  An ITP lets you buy one token that holds   │
│  all 10. The price floats with the basket.  │
│  Like buying an S&P 500 ETF instead of     │
│  500 individual stocks.                     │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Example: "DeFi Blue Chips" ITP     │   │
│  │                                     │   │
│  │  AAVE  20%  ████████████            │   │
│  │  UNI   20%  ████████████            │   │
│  │  MKR   15%  █████████               │   │
│  │  COMP  15%  █████████               │   │
│  │  SNX   10%  ██████                  │   │
│  │  CRV   10%  ██████                  │   │
│  │  SUSHI  5%  ███                     │   │
│  │  YFI    5%  ███                     │   │
│  │                                     │   │
│  │  NAV: $1.24  │  AUM: $47,000        │   │
│  │  You buy 100 shares → $124 exposure │   │
│  │  to all 8 tokens in one transaction │   │
│  └─────────────────────────────────────┘   │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [H2] How ITPs Work                         │
│                                             │
│  [H3] Creation                              │
│  Pick assets, set weights, deploy. Your     │
│  ITP starts at $1 NAV. Each share holds     │
│  a fixed quantity of each underlying asset. │
│                                             │
│  [H3] NAV (Net Asset Value)                 │
│  The price of one ITP share. Calculated     │
│  as: sum of (quantity × price) for each     │
│  asset. Updates every cycle (~30 seconds).  │
│                                             │
│  If ETH goes up 10% and your ITP is 50%    │
│  ETH, your NAV goes up ~5%.                │
│                                             │
│  [H3] Buying and Selling                    │
│  Buy: deposit USDC, receive ITP shares at   │
│  current NAV. Sell: return shares, receive  │
│  USDC. Settled on-chain in one cycle.       │
│                                             │
│  [H3] Rebalancing                           │
│  Weights can be updated. Quantities are     │
│  recalculated to preserve the current NAV.  │
│  Your share count doesn't change — only     │
│  what each share holds.                     │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [H2] ITPs vs Traditional ETFs              │
│                                             │
│  Comparison table:                          │
│  ┌────────────┬───────────┬──────────────┐ │
│  │            │ ETF       │ ITP          │ │
│  ├────────────┼───────────┼──────────────┤ │
│  │ Settlement │ T+1 days  │ ~30 seconds  │ │
│  │ Min invest │ $100+     │ $1           │ │
│  │ Trading    │ Market hrs│ 24/7         │ │
│  │ Custody    │ Broker    │ Your wallet  │ │
│  │ Creation   │ SEC filing│ 1 transaction│ │
│  │ Fees       │ 0.03-1%  │ ~0.3%        │ │
│  │ Transparency│ Quarterly│ Real-time    │ │
│  └────────────┴───────────┴──────────────┘ │
│                                             │
│  Not better or worse — different tradeoffs. │
│  ITPs trade speed and permissionlessness    │
│  for regulatory clarity and insurance.      │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [H2] ITPs vs Buying Tokens Directly        │
│                                             │
│  Why not just buy the 10 tokens yourself?   │
│                                             │
│  1. Gas: 10 swaps vs 1 purchase             │
│  2. Rebalancing: automatic vs manual        │
│  3. Tracking: one NAV vs 10 prices          │
│  4. Sharing: one token link vs a spreadsheet│
│                                             │
│  The same reason people buy SPY instead of  │
│  500 stocks.                                │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [H2] How to Get Started                    │
│                                             │
│  Three steps, no jargon:                    │
│                                             │
│  1. Connect your wallet on Index L3         │
│  2. Browse ITPs on the Markets page         │
│  3. Buy shares with USDC                    │
│                                             │
│  Or create your own ITP from 100+ assets.   │
│                                             │
│  [Browse Markets →]  [Create an ITP →]      │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [H2] Risks                                 │
│                                             │
│  Honest section. Not a disclaimer wall.     │
│                                             │
│  • Smart contract risk: code can have bugs  │
│  • Oracle risk: prices come from external   │
│    sources that can be wrong or delayed     │
│  • Liquidity risk: low-AUM ITPs may have    │
│    wider spreads                            │
│  • Regulatory risk: rules are evolving      │
│                                             │
│  (Polymarket model: honest > defensive.     │
│   Resend model: incident reports build      │
│   trust more than hiding problems.)         │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [H2] Further Reading                       │
│                                             │
│  • Documentation: [ITP Architecture →]      │
│  • Create: [Design Your First ITP →]        │
│  • Backtest: [Test Before You Deploy →]     │
│                                             │
├─────────────────────────────────────────────┤
│ FOOTER                                      │
└─────────────────────────────────────────────┘
```

### Schema Markup

```json
{
  "@type": "Article",
  "headline": "What Are Index Tracking Products (ITPs)?",
  "description": "ITPs are on-chain tokenized index products — the crypto equivalent of ETFs. Learn how they work, how NAV is calculated, and how to get started.",
  "author": {
    "@type": "Organization",
    "name": "General Market"
  },
  "publisher": {
    "@type": "Organization",
    "name": "General Market",
    "url": "https://generalmarket.io"
  },
  "datePublished": "2026-02-27",
  "dateModified": "2026-02-27",
  "mainEntityOfPage": "https://generalmarket.io/learn/what-are-itps"
}
```

### Metadata

```json
{
  "title": "What Are Index Tracking Products (ITPs)? — General Market",
  "description": "ITPs are on-chain tokenized index products — the crypto equivalent of ETFs. One token, a basket of crypto assets, real-time NAV. Learn how they work."
}
```

### Implementation Notes

- Pure server component — all content is static text, no client-side data needed
- The "Example ITP" visual can be a static component with hardcoded data (or pull one real ITP from API)
- Comparison table is plain HTML, no JS needed
- Word count target: 1,200-1,500 words (well above Google's thin content threshold)
- i18n: add `learn` keys to all 4 locale message files
- H3s under H2s give Google passage-level indexing (important for featured snippets)
- Internal links to `/index`, `/create`, `/docs` create the hub-and-spoke topology that Resend uses
- The "Risks" section is a deliberate E-E-A-T play — Google's quality raters specifically look for risk disclosure on YMYL financial pages

### Future Learn Pages (roadmap, not for now)

If this page works, expand into a `/learn` hub:
- `/learn/what-is-nav` — "What Is Net Asset Value in DeFi?"
- `/learn/ai-prediction-markets` — "How AI Agents Trade Prediction Markets"
- `/learn/how-settlement-works` — "On-Chain Settlement in 30 Seconds"
- `/learn/itps-vs-defi-vaults` — "ITPs vs Yield Vaults: Which is Right for You?"

Each targets a distinct keyword cluster. Together they build topical authority (Resend's blog model).

---

## Shared Implementation Details

### Navigation Changes

Add to header nav:
- "Learn" dropdown or link pointing to `/learn/what-are-itps`
- "About" link in footer and possibly header

Add to footer:
- "About" in Resources column
- "Learn" or "What are ITPs?" in Resources column

### Sitemap

Add to `app/sitemap.ts` staticRoutes:
```ts
{ path: '/about', changeFrequency: 'monthly', priority: 0.7 },
{ path: '/learn/what-are-itps', changeFrequency: 'monthly', priority: 0.8 },
```

### i18n

Both pages need translation keys in all 4 locales. Start with English content, translate later. The pages can initially render English for non-EN locales (with proper lang attributes) — having the content exist at all is more valuable than waiting for translations.

### Tone Guide

- **Do:** Use numbers. Use comparisons to TradFi. Be honest about risks. Let data speak.
- **Don't:** Use "revolutionary", "disrupting", "cutting-edge". No superlatives. No hype.
- **Steal from Polymarket:** Anti-marketing confidence. The product is the pitch.
- **Steal from Resend:** Structure and attribution. Real people, real links, real schema.
