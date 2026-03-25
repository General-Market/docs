# SEO Action Plan — generalmarket.io

**Generated:** 2026-03-25
**Current Score:** 47/100
**Target Score:** 75/100 (achievable with Critical + High fixes)

---

## CRITICAL — Fix Immediately (blocks indexing, social sharing, i18n)

### 1. Fix www/non-www domain mismatch
**File:** `app/sitemap.ts` line 7
**Change:** `const baseUrl = 'https://generalmarket.io'` → `'https://www.generalmarket.io'`
**Impact:** Unifies sitemap and canonical signals. Without this, Google sees two competing domains.
**Effort:** 1 minute

### 2. Fix 3 broken canonical URLs
**Files:** `app/[locale]/sources/page.tsx`, `points/page.tsx`, `explorer/page.tsx`
**Change:** Add `alternates: { canonical: '/sources' }` (etc.) to each page's `generateMetadata`
**Impact:** Prevents Google from treating these pages as homepage duplicates.
**Effort:** 10 minutes

### 3. Add Open Graph + Twitter Card meta tags
**File:** `app/[locale]/layout.tsx` — `generateMetadata` function
**Change:** Add `openGraph` and `twitter` fields consuming existing `seo.og.*` translation keys. Create a default OG image (`public/og-image.png`, 1200x630).
**Impact:** Every social share gets a preview card instead of a bare URL.
**Effort:** 30 minutes

### 4. Fix HTML lang on locale pages
**File:** `i18n/request.ts`
**Change:** Debug `getLocale()` — it returns `"en"` for all requests during SSR. The locale from the URL path must propagate to the root layout's `lang` attribute.
**Impact:** Google can correctly classify page language. Currently all Korean/Japanese/Chinese pages are indexed as English.
**Effort:** 1-2 hours (investigation required)

### 5. Fix conflicting robots meta on 404 pages
**File:** `app/layout.tsx`
**Change:** Move `robots: { index: true, follow: true }` from root layout to `[locale]/layout.tsx`, so `not-found.tsx`'s `noindex` isn't contradicted.
**Impact:** 404 pages cleanly excluded from index.
**Effort:** 15 minutes

---

## HIGH — Fix Within 1 Week (significant ranking impact)

### 6. Fix hreflang on all pages
**Files:** Every page's `generateMetadata` that sets `alternates`
**Change:** When setting `alternates: { canonical: '/path' }`, also include `languages` map:
```ts
alternates: {
  canonical: '/sources',
  languages: {
    en: '/sources',
    ko: '/ko/sources',
    ja: '/ja/sources',
    zh: '/zh/sources',
    'x-default': '/sources',
  },
}
```
**Impact:** Google discovers locale relationships. Currently only homepage has correct hreflang.
**Effort:** 1-2 hours

### 7. Add H1 to 3 pages
**Files:** `app/[locale]/index/page.tsx`, `about/page.tsx`, `learn/page.tsx`
**Change:** Promote existing H2 to H1, or add a proper H1.
**Impact:** Strongest on-page heading signal restored.
**Effort:** 15 minutes

### 8. Add `/explorer` to sitemap
**File:** `app/sitemap.ts`
**Change:** Add `'/explorer'` to `staticRoutes` array.
**Effort:** 1 minute

### 9. Fix duplicate brand in titles
**Files:** `about/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`, `legal-vision/page.tsx`, `legal-index/page.tsx`
**Change:** Remove ` -- General Market` suffix from page-level titles. The layout template already appends `| General Market`.
**Effort:** 15 minutes

### 10. Add brand to homepage title
**File:** `app/[locale]/layout.tsx` or homepage `generateMetadata`
**Change:** `"AI Prediction Markets Powered by AI Agents"` → `"AI Prediction Markets Powered by AI Agents | General Market"`
**Effort:** 1 minute

### 11. Remove RPC IP from footer
**File:** `components/layout/Footer.tsx`
**Change:** Remove or mask the `http://142.132.164.24` link. Replace with a labeled link or remove entirely.
**Impact:** Stops exposing infrastructure + bleeding PageRank to bare IP.
**Effort:** 5 minutes

### 12. Add Article `image` to learn schema
**File:** `components/seo/JsonLd.tsx` (or learn article page)
**Change:** Add `image` property to Article JSON-LD. Use OG image or create article-specific images.
**Impact:** Enables Article rich results in Google.
**Effort:** 15 minutes

---

## MEDIUM — Fix Within 1 Month (optimization, content, performance)

### 13. Split client providers by route
**Files:** `app/client-providers.tsx`, `app/layout.tsx`, route group layouts
**Change:** Create `(marketing)` route group for `/about`, `/learn`, `/points`, legal pages with PostHog-only providers. Keep full Web3 stack in `(app)` route group.
**Expected impact:** -60% JS on informational pages (~4 MB less)
**Effort:** 4-8 hours

### 14. Expand homepage content
**File:** `app/[locale]/page.tsx`
**Change:** Add 300+ words of server-rendered explanatory text: what General Market is, what products it offers, who it's for. Above the category grid.
**Impact:** Homepage goes from invisible (128 words) to indexable.
**Effort:** 1-2 hours

### 15. Expand /about page
**File:** `app/[locale]/about/page.tsx`
**Change:** Add founder background paragraph, legal entity, jurisdiction, audit status, technology summary, project timeline. Target 500+ words.
**Impact:** YMYL trust signal dramatically improved.
**Effort:** 2-3 hours

### 16. Add FAQ sections to product pages
**Files:** Homepage, `/index`, `/points`
**Change:** Add 5-10 Q&As per page with FAQ schema markup.
**Impact:** FAQ content is highest-yield for both SEO and AI citation.
**Effort:** 3-4 hours

### 17. Create Vision product explainer
**Location:** New learn article
**Content:** How sealed parimutuel markets work on GM, equivalent depth to ITP article.
**Effort:** 4-6 hours

### 18. Expand /points to 500+ words
**File:** `app/[locale]/points/page.tsx`
**Change:** Add season rules, conversion mechanics, earning strategies, FAQ.
**Effort:** 1-2 hours

### 19. Remove phantom dependencies
**File:** `frontend/package.json`
**Remove:** `@solana/web3.js`, `socket.io-client`, `porto`, `pino` (if server-only, move to devDependencies). Migrate 2 `swr` call sites to react-query, then remove `swr`.
**Impact:** -200-500 KB gzipped
**Effort:** 1-2 hours

### 20. Enrich Organization schema
**File:** `components/seo/JsonLd.tsx`
**Change:** Add `foundingDate`, expand `sameAs` (Discord, GitHub, docs site), add `contactPoint`.
**Effort:** 15 minutes

### 21. Add BreadcrumbList to remaining pages
**Files:** `/sources`, `/points`, `/explorer`, `/privacy`, `/terms`, `/legal-*`
**Change:** Add `BreadcrumbJsonLd` component (already exists, just not used).
**Effort:** 30 minutes

### 22. Convert crypto logos to next/image
**File:** `components/domain/vision/VisionMarketsGrid.tsx` (~line 216)
**Change:** Replace raw `<img src="/logos/crypto/...">` with `<Image>` component.
**Impact:** Automatic WebP conversion, proper sizing, lazy loading. 9,141 PNGs at 32KB avg → ~5-10KB WebP.
**Effort:** 30 minutes

### 23. Fix learn hub anchor text
**File:** Learn hub article card component
**Change:** Separate category badge, title, and description into distinct elements within the `<a>` tag, or restructure so anchor text is meaningful.
**Effort:** 30 minutes

---

## LOW — Backlog (nice to have)

### 24. Suppress X-Powered-By
**File:** `next.config.ts`
**Change:** `poweredByHeader: false`
**Effort:** 10 seconds

### 25. Update sitemap lastmod dynamically
**File:** `app/sitemap.ts`
**Change:** Use `new Date()` or git commit date instead of hardcoded `2026-02-27`.
**Effort:** 5 minutes

### 26. Set legal pages to noindex
**Files:** privacy, terms, legal-vision, legal-index `generateMetadata`
**Change:** `robots: { index: false, follow: true }`
**Impact:** Saves crawl budget for pages that won't rank.
**Effort:** 10 minutes

### 27. Lazy-load PostHog session recording
**File:** `lib/posthog.ts`
**Change:** Defer session_recording + heatmaps init until after LCP via `loaded` callback.
**Impact:** -100-200 KB + reduced INP from autocapture event listeners.
**Effort:** 30 minutes

### 28. Create security/audit disclosure page
**Content:** Audit status, security practices, bug bounty (if any), insurance.
**Impact:** Critical trust signal for YMYL financial protocol.
**Effort:** 2-3 hours

### 29. Add named author to learn articles
**Change:** "Max, Founder at General Market" instead of "General Market" as article author.
**Impact:** Named human authors carry more weight for YMYL E-E-A-T.
**Effort:** 15 minutes

### 30. Create Getting Started tutorial
**Content:** Wallet setup, first ITP purchase, first Vision bet. Targeting new users.
**Effort:** 4-6 hours

### 31. Verify production cache headers
**Command:** `curl -sI "https://www.generalmarket.io/_next/static/chunks/main-app-*.js" | grep cache-control`
**If `no-store` in production:** Add immutable cache headers in `next.config.ts` for `/_next/static/:path*`.
**Effort:** 15 minutes

---

## Score Projection

| Phase | Fixes | Projected Score |
|-------|-------|----------------|
| Current | — | 47 |
| After Critical (1-5) | Canonicals, OG, lang, robots | 62 |
| After High (6-12) | Hreflang, H1s, sitemap, titles | 72 |
| After Medium (13-23) | Content expansion, perf, schema | 82 |
| After Low (24-31) | Polish, security page, tutorials | 88 |
