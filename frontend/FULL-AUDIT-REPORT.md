# SEO Audit Report — generalmarket.io

**Date:** 2026-03-25
**Pages audited:** 12 (+ 4 locale variants sampled)
**Locales:** en, ko, ja, zh
**Environment:** Next.js 15 dev server (localhost:3000)

---

## Overall SEO Health Score: 47 / 100

| Category | Weight | Score | Weighted |
|----------|--------|-------|----------|
| Technical SEO | 25% | 52 | 13.0 |
| Content Quality | 25% | 52 | 13.0 |
| On-Page SEO | 20% | 40 | 8.0 |
| Schema / Structured Data | 10% | 45 | 4.5 |
| Performance (CWV) | 10% | 45 | 4.5 |
| Images | 5% | 30 | 1.5 |
| AI Search Readiness | 5% | 55 | 2.75 |
| **TOTAL** | | | **47.25** |

---

## Top 5 Critical Issues

1. **Canonical URL domain schism** — Sitemap uses `generalmarket.io`, canonical tags use `www.generalmarket.io`. Google sees two different sites.
2. **3 pages canonicalize to homepage** — `/sources`, `/points`, `/explorer` all declare themselves duplicates of `/`. They will be de-indexed.
3. **Zero Open Graph / Twitter Card tags** — Every social share renders as a bare URL. No preview card anywhere.
4. **`<html lang="en">` on all locale pages** — `/ko/index`, `/ja/about`, `/zh` all claim to be English. i18n locale resolution broken during SSR.
5. **5.8 MB gzipped JS on every page** — Web3 provider stack (wagmi, WalletConnect, PostHog, SSE) loads on informational pages that need none of it.

## Top 5 Quick Wins

1. **Fix sitemap baseUrl** — Change `app/sitemap.ts` line 7 to `https://www.generalmarket.io`. One line.
2. **Add canonical to 3 pages** — Add `alternates: { canonical: '/sources' }` (etc.) to `generateMetadata` in sources, points, explorer page files.
3. **Add OG/Twitter meta** — Add `openGraph` and `twitter` fields to locale layout's `generateMetadata`. Consume existing `seo.og` translation keys.
4. **Remove `X-Powered-By`** — Add `poweredByHeader: false` to `next.config.ts`.
5. **Fix duplicate brand in 5 titles** — Remove ` -- General Market` from page-level titles (the template already appends `| General Market`).

---

## 1. Technical SEO (52/100)

### CRITICAL

**T-C1. Canonical URL Domain Mismatch**
- `app/sitemap.ts` line 7: `baseUrl = 'https://generalmarket.io'` (no www)
- `app/layout.tsx` line 24: `metadataBase: new URL("https://www.generalmarket.io")` (www)
- Sitemap and canonical tags disagree on which domain is authoritative
- Fragments crawl budget, splits link equity, may prevent proper indexation

**T-C2. Three Pages Self-Canonical to Homepage**

| Page | Canonical Points To | Should Point To |
|------|-------------------|-----------------|
| `/sources` | `https://www.generalmarket.io` | `https://www.generalmarket.io/sources` |
| `/points` | `https://www.generalmarket.io` | `https://www.generalmarket.io/points` |
| `/explorer` | `https://www.generalmarket.io` | `https://www.generalmarket.io/explorer` |

Root cause: These pages don't set `alternates.canonical` in `generateMetadata`. The locale layout fallback resolves to `/`, which becomes the homepage canonical.

**T-C3. HTML `lang` Always "en" on Locale Pages**

| URL | Expected | Actual |
|-----|----------|--------|
| `/ko/index` | `ko` | `en` |
| `/ja/about` | `ja` | `en` |
| `/zh` | `zh` | `en` |

Root cause: `next-intl` locale resolution in `i18n/request.ts` returns `"en"` for all requests during SSR.

**T-C4. Conflicting robots Meta on 404 Pages**
- `not-found.tsx` sets `<meta name="robots" content="noindex"/>`
- Root layout injects `<meta name="robots" content="index, follow"/>`
- Both render. Google's behavior with conflicting directives is undefined.

### HIGH

**T-H1. Hreflang Tags Missing or Broken**
- Only `/` has correct hreflang in HTML
- `/sources`, `/points`, `/explorer`: hreflang present but points to homepage
- 8 other pages: hreflang completely absent
- Root cause: page-level `alternates: { canonical: '...' }` replaces entire `alternates` object, discarding `languages` map

**T-H2. Locale Pages Have Zero Hreflang**
- `/ko/index` has no hreflang tags at all
- Bidirectional requirement violated: English doesn't point to Korean, Korean doesn't point back

**T-H3. `/explorer` Missing from Sitemap**
- Returns 200, linked from navigation, has indexable content
- Not in `staticRoutes` array in `app/sitemap.ts`

**T-H4. `Cache-Control: no-store` on All Pages**
- Static pages like `/privacy`, `/terms`, `/learn/what-are-itps` return `no-store, must-revalidate`
- Prevents CDN caching, forces full SSR every request
- Verify in production — may be dev-mode artifact

### MEDIUM

**T-M1. Stale Sitemap `lastmod`**
- All entries: `2026-02-27` (nearly a month old)
- Should update on deploy

**T-M2. `X-Powered-By: Next.js` Exposed**
- Information disclosure. Fix: `poweredByHeader: false`

### PASS

- robots.txt valid and permissive
- 404 pages return HTTP 404
- All 200 pages have `robots: index, follow`
- Clean URLs, no trailing slashes
- HSTS with preload (63072000s)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- CSP comprehensive
- Permissions-Policy restricts camera/mic/geo
- All pages fully SSR (content in initial HTML)
- PWA manifest, icons present
- llms.txt and llms-full.txt available

---

## 2. Content Quality (52/100)

### E-E-A-T Score: 34.85 / 100

| Factor | Weight | Score |
|--------|--------|-------|
| Experience | 20% | 35 |
| Expertise | 25% | 48 |
| Authoritativeness | 25% | 25 |
| Trustworthiness | 30% | 32 |

### Page-by-Page Content Scores

| Page | Words | Min Required | Score | Verdict |
|------|-------|-------------|-------|---------|
| `/` | 128 | 500 | 28 | Catastrophically thin |
| `/index` | 1,018 | 800 | 45 | Bare minimum |
| `/sources` | 124 | 800 | 12 | Dashboard, no text |
| `/points` | 166 | 800 | 25 | Skeletal |
| `/about` | 208 | 500 | 38 | YMYL concern |
| `/explorer` | 135 | 300 | 15 | Dashboard, no text |
| `/learn` | 554 | 300 | 68 | Adequate hub |
| `/learn/what-are-itps` | 3,105 | 1,500 | 82 | Excellent |

### Critical Gaps

1. **No security/audit page** — Financial protocol with no linked audit report. Worst trust signal for YMYL.
2. **No Vision product explainer** — ITP article is thorough; no equivalent for the prediction market product.
3. **No FAQ anywhere** — Every product page should have 5-10 Q&As.
4. **No Getting Started tutorial** — No onboarding content for new users.
5. **About page dangerously thin** — One team member, no bio, no legal entity, no jurisdiction, no audit.

### What Works

- `/learn/what-are-itps` is genuinely excellent: distinctive voice, specific data, named failures, honest risk section
- Learn hub has 10 articles with good topical diversity
- Writing style is authentic (not generic AI content)

---

## 3. On-Page SEO (40/100)

### CRITICAL

**OP-C1. Zero OG / Twitter Card Tags (ALL 12 pages)**
- No `og:title`, `og:description`, `og:image`, `og:url`
- No `twitter:card`, `twitter:title`, `twitter:image`
- Every social share renders blank
- No OG image exists in `/public/`

### HIGH

**OP-H1. Missing H1 on 3 Pages**

| Page | H1? | What Exists |
|------|-----|-------------|
| `/index` | No | 11 H2s |
| `/about` | No | H2 "About" |
| `/learn` | No | H2 "Learn" |

**OP-H2. Homepage Title Missing Brand**
- Title: "AI Prediction Markets Powered by AI Agents"
- No "General Market" anywhere

**OP-H3. Duplicate Brand in 5 Titles**
- "About -- General Market | General Market"
- Same pattern on privacy, terms, legal-vision, legal-index
- Page adds ` -- General Market`, template appends `| General Market`

**OP-H4. RPC IP Address Exposed in Footer (ALL pages)**
- `http://142.132.164.24` rendered as clickable `<a>` tag
- L3 RPC endpoint exposed to every crawler and visitor
- Bleeds PageRank to non-HTTPS bare IP

### MEDIUM

**OP-M1. Short Meta Descriptions**

| Page | Chars | Issue |
|------|-------|-------|
| `/sources` | 79 | Far too short |
| `/explorer` | 53 | Barely a sentence |
| `/points` | 111 | Borderline |

**OP-M2. Identical Keywords Meta on 11/12 Pages**
- Same `index funds,ETF,institutional...` on every page except learn article
- Google ignores keywords meta, but signals templated SEO

**OP-M3. Learn Hub Anchor Text Garbled**
- Article cards: category + title + description concatenated in single `<a>` tag
- Crawlers see one long nonsensical anchor string

**OP-M4. All Images Have Empty Alt Text**
- Logo: `alt=""` on every page
- Only `/about` has descriptive alt ("Max")

### Summary Table

| Page | Title | Meta Desc | H1 | Canonical | OG | Hreflang |
|------|-------|-----------|----|-----------|-----|----------|
| `/` | No brand | OK | OK | OK | MISSING | OK |
| `/index` | OK | OK | MISSING | OK | MISSING | MISSING |
| `/sources` | OK | Short | OK | WRONG | MISSING | WRONG |
| `/points` | OK | Short | OK | WRONG | MISSING | WRONG |
| `/about` | Dup brand | OK | MISSING | OK | MISSING | MISSING |
| `/explorer` | OK | Short | OK | WRONG | MISSING | WRONG |
| `/learn` | Long | OK | MISSING | OK | MISSING | MISSING |
| `/learn/*` | OK | OK | OK | OK | MISSING | MISSING |
| Legal (x4) | Dup brand | OK | OK | OK | MISSING | MISSING |

---

## 4. Schema & Structured Data (45/100)

### Current Inventory

**Global (all pages):** Organization, WebSite, SoftwareApplication (3 JSON-LD blocks)

| Page | Additional Schema |
|------|------------------|
| `/index` | BreadcrumbList |
| `/about` | AboutPage + nested Organization |
| `/learn` | CollectionPage + ItemList + BreadcrumbList |
| `/learn/*` | Article + BreadcrumbList |
| Others | None |

### Validation Errors

- **Article schema lacks `image`** — Required by Google for Article rich results. Ineligible for rich snippets.
- **FinancialProduct component exists but renders nothing** — Imported in `/index/page.tsx` but empty data at build time.
- **SoftwareApplication duplicated on every page** — Including legal pages. Noise.
- **Organization schema thin** — No `foundingDate`, only 1 `sameAs` (Twitter). Missing Discord, GitHub, docs site.

### Missing Schema (by impact)

| Priority | Schema | Where |
|----------|--------|-------|
| HIGH | BreadcrumbList | 8 of 12 pages lack it |
| HIGH | WebPage | Legal pages (currently only inherit global) |
| HIGH | Article `image` | All learn articles |
| MEDIUM | SiteNavigationElement | Homepage/layout |
| MEDIUM | Organization enrichment | Global (foundingDate, more sameAs) |
| LOW | DataCatalog/Dataset | `/sources` |

### Rich Result Eligibility

| Type | Status | Blocker |
|------|--------|---------|
| Sitelinks | Partial | No SearchAction |
| Breadcrumbs | 3/12 pages | Missing on 9 pages |
| Article | Blocked | `image` missing |
| Organization Panel | Partial | Thin schema |
| FinancialProduct | Blocked | Not rendering |

---

## 5. Performance (45/100)

### JS Bundle — CRITICAL

| Metric | Value |
|--------|-------|
| Homepage total JS (gzipped) | ~5.8 MB |
| `/index` total JS (gzipped) | ~7.5 MB |
| `main-app.js` (gzipped) | 1.7 MB |
| `app/layout.js` (gzipped) | 1.3 MB |
| `template.js` (gzipped) | 511 KB |

Root cause: `ClientProviders` wraps ALL routes with wagmi + viem + WalletConnect + PostHog + SSE + framer-motion + tanstack-query. Informational pages (`/about`, `/learn`, `/points`, legal) pay the full Web3 tax for nothing.

### Phantom Dependencies

| Package | Status |
|---------|--------|
| `@solana/web3.js` | Unused — zero imports |
| `socket.io-client` | Unused — zero imports |
| `@metamask/sdk` | Unused directly |
| `lit` | Unused directly |
| `porto` | Unused — zero imports |
| `pino` | Server-only, bundled into client |
| `swr` | Redundant (2 imports vs 29 for react-query) |

### Core Web Vitals Assessment

| Metric | Likely Rating | Primary Factor |
|--------|---------------|----------------|
| LCP | NEEDS IMPROVEMENT to POOR | JS parse blocks hydration; 5.8 MB gzipped |
| INP | GOOD to NEEDS IMPROVEMENT | PostHog autocapture + SSE main-thread processing |
| CLS | GOOD | Images have dimensions, fonts use swap + fallbacks |

### Other Performance Issues

- **Cache-Control `no-store` on `_next/static/` assets** — Verify production. If same, every page nav re-downloads 5-8 MB.
- **Single 149 KB CSS file** — Every route loads styles for every component.
- **9,141 unoptimized PNG logos** (285 MB total) — Raw `<img>` tags, not `next/image`, no WebP/AVIF.
- **RSC payload inlined** — 176-180 KB of `self.__next_f.push()` blocks per page.

---

## 6. Images (30/100)

- Logo SVG (3.3 KB) on every page — `alt=""`
- `/about` has one photo (`/images/max.png`) — `alt="Max"` (good)
- 9,141 crypto logos in `/public/logos/` — raw PNG, not through `next/image`
- Source images in `source-imgs/` — WebP, well-optimized (287 files, 6 MB)
- No hero images, no infographics, nothing for Google Image Search
- No `srcset`, no responsive images, no lazy loading on logos

---

## 7. AI Search Readiness (55/100)

### Strengths
- `llms.txt` well-structured with chain IDs, contract addresses, API endpoints
- `robots.txt` explicitly allows `/llms.txt` and `/llms-full.txt`
- Article schema with `datePublished` on learn pages
- Learn articles contain citable facts with specificity
- Breadcrumb schema provides topical hierarchy

### Weaknesses
- No FAQ schema (highest-yield for LLM citation)
- Organization `sameAs` has only Twitter (no GitHub, Discord, Crunchbase)
- Article author is organization, not named person
- Homepage invisible to LLMs (128 words)
- No `speakable` schema

---

## Files Requiring Changes

| File | Issues |
|------|--------|
| `app/sitemap.ts` (line 7) | www/non-www mismatch, missing `/explorer` |
| `app/layout.tsx` (line 24) | metadataBase domain, global robots override |
| `app/[locale]/layout.tsx` | Missing OG/Twitter meta, hreflang generation |
| `app/[locale]/sources/page.tsx` | Missing canonical |
| `app/[locale]/points/page.tsx` | Missing canonical |
| `app/[locale]/explorer/page.tsx` | Missing canonical |
| `app/[locale]/index/page.tsx` | Missing H1 |
| `app/[locale]/about/page.tsx` | Missing H1, thin content |
| `app/[locale]/learn/page.tsx` | Missing H1 |
| `i18n/request.ts` | Locale resolution broken (always returns "en") |
| `app/not-found.tsx` | Conflicting robots meta |
| `app/client-providers.tsx` | All providers on all routes (perf) |
| `next.config.ts` | poweredByHeader, cache headers |
| `components/layout/Footer.tsx` | RPC IP exposed |
| `components/seo/JsonLd.tsx` | Article missing image, FinancialProduct not rendering |
