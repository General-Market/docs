# SEO Propositions — generalmarket.io

**Audit date:** 2026-02-27
**SEO Health Score:** 38/100
**Codebase:** `/frontend/` (local, Next.js 15 App Router + next-intl)

---

## Table of Contents

1. [CRITICAL: SSR Bailout — Empty Body for Crawlers](#1-critical-ssr-bailout--empty-body-for-crawlers)
2. [CRITICAL: Hardcoded Canonical URL on All Pages](#2-critical-hardcoded-canonical-url-on-all-pages)
3. [HIGH: Wrong Chain References (Base L2 → Arbitrum Orbit L3)](#3-high-wrong-chain-references-base-l2--arbitrum-orbit-l3)
4. [HIGH: Invalid Schema Markup (FAQPage, SearchAction, InvestmentFund)](#4-high-invalid-schema-markup-faqpage-searchaction-investmentfund)
5. [HIGH: Sitemap Issues (404 URLs, Stale Dates, Missing Pages)](#5-high-sitemap-issues-404-urls-stale-dates-missing-pages)
6. [HIGH: OG/Twitter Images Returning 404](#6-high-ogtwitter-images-returning-404)
7. [HIGH: Vision Homepage — Zero Crawlable Content](#7-high-vision-homepage--zero-crawlable-content)
8. [HIGH: Client-Only Pages Missing Metadata (sources, points)](#8-high-client-only-pages-missing-metadata-sources-points)
9. [MEDIUM: Broken Twitter/X Link in Footer](#9-medium-broken-twitterx-link-in-footer)
10. [MEDIUM: PostHog useSearchParams CSR Bailout](#10-medium-posthog-usesearchparams-csr-bailout)
11. [MEDIUM: wagmi SSR Configuration](#11-medium-wagmi-ssr-configuration)
12. [MEDIUM: Generic Page Titles and Descriptions](#12-medium-generic-page-titles-and-descriptions)
13. [MEDIUM: Missing x-default Hreflang in Sitemap](#13-medium-missing-x-default-hreflang-in-sitemap)
14. [MEDIUM: Duplicate Entries in Sitemap (Per-Locale Bloat)](#14-medium-duplicate-entries-in-sitemap-per-locale-bloat)
15. [MEDIUM: No H3 Hierarchy / Duplicate H2s](#15-medium-no-h3-hierarchy--duplicate-h2s)
16. [MEDIUM: Skeleton Loading CLS (Cumulative Layout Shift)](#16-medium-skeleton-loading-cls-cumulative-layout-shift)
17. [LOW: Missing Preconnect Hints](#17-low-missing-preconnect-hints)
18. [LOW: No Custom 404 Page](#18-low-no-custom-404-page)
19. [LOW: ISR/Caching for ITP Pages](#19-low-isrcaching-for-itp-pages)
20. [E-E-A-T: No Team/About Page](#20-e-e-a-t-no-teamabout-page)
21. [E-E-A-T: No Blog or Educational Content](#21-e-e-a-t-no-blog-or-educational-content)
22. [E-E-A-T: Thin ITP Detail Pages](#22-e-e-a-t-thin-itp-detail-pages)
23. [AI Search: No dateModified in JSON-LD](#23-ai-search-no-datemodified-in-json-ld)
24. [AI Search: No Vision/Betting Structured Data](#24-ai-search-no-visionbetting-structured-data)

---

## 1. CRITICAL: SSR Bailout — Empty Body for Crawlers

**File:** `app/client-providers.tsx:9-11`

**Current code:**
```tsx
const Providers = dynamic(() => import('./providers').then((mod) => mod.Providers), {
  ssr: false,
})
```

**Problem:** `ssr: false` wraps the **entire app tree** (wagmi, PostHog, SSE, all children). During server-side rendering, Next.js emits an empty `<body>` — Googlebot sees zero content. This is the single biggest SEO blocker. The `BAILOUT_TO_CLIENT_SIDE_RENDERING` error means the entire page is invisible to crawlers.

**Why this matters:** Google renders JavaScript but deprioritizes pages that require full client rendering. An empty server response signals "nothing here" and pages may not be indexed at all. This affects every page on the site.

**Fix:** Remove `ssr: false` and instead make the provider tree SSR-safe:

1. In `lib/wagmi.ts`, add `ssr: true` to `createConfig()` — wagmi supports this natively and avoids the `indexedDB` error during SSR.
2. In `PostHogProvider.tsx`, wrap `useSearchParams()` in a `<Suspense>` boundary (see proposition #10).
3. In `client-providers.tsx`, switch from `dynamic({ ssr: false })` to a regular import:
   ```tsx
   import { Providers } from './providers'

   export function ClientProviders({ children }: { children: ReactNode }) {
     return (
       <ErrorBoundary>
         <Providers>{children}</Providers>
       </ErrorBoundary>
     )
   }
   ```
4. Keep `'use client'` on the file — client components still SSR their initial HTML, they just also hydrate on the client.

**Impact:** Goes from 0% crawlable content to ~100%. Every other SEO fix depends on this one.

---

## 2. CRITICAL: Hardcoded Canonical URL on All Pages

**File:** `app/layout.tsx:58`

**Current code:**
```tsx
<link rel="canonical" href="https://generalmarket.io" />
```

**Problem:** Every page (`/index`, `/itp/42`, `/ko/privacy`, etc.) declares its canonical as the homepage. Google sees all pages as duplicates of the homepage and may deindex them. This is hardcoded in the root `<head>`.

**Why this matters:** Canonical tags tell Google "this is the real URL for this content." When every page says it's the homepage, Google either ignores the canonical (best case) or consolidates all pages into one (worst case, loss of all page-level rankings).

**Fix:** Remove the hardcoded `<link>` from `app/layout.tsx` and use Next.js metadata API instead. The `[locale]/layout.tsx` already sets `alternates.languages` — extend it to include `canonical`:

```tsx
// In app/layout.tsx — DELETE line 57-59 entirely (the <head> block with canonical)

// In app/[locale]/layout.tsx generateMetadata():
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.metadata' })
  const path = locale === 'en' ? '' : `/${locale}`

  return {
    title: { default: t('title'), template: t('title_template') },
    description: t('description'),
    keywords: t('keywords').split(', '),
    alternates: {
      canonical: `https://generalmarket.io${path}`,
      languages: Object.fromEntries(
        locales.map((l) => [l, l === 'en' ? '/' : `/${l}`])
      ),
    },
  }
}
```

Each sub-page (`/itp/[itpId]`, `/index`, etc.) should also set its own canonical in its `generateMetadata()`.

**Impact:** Allows Google to properly index each page as a unique entity.

---

## 3. HIGH: Wrong Chain References (Base L2 → Arbitrum Orbit L3)

**Files:** 16+ i18n files across all 4 locales

**Affected strings:**
| File | Key | Current | Correct |
|------|-----|---------|---------|
| `messages/en/seo.json` | `metadata.keywords` | "Base L2" | "Arbitrum Orbit, L3" |
| `messages/ja/seo.json` | `metadata.keywords` | "Base L2" | "Arbitrum Orbit, L3" |
| `messages/ko/seo.json` | `metadata.keywords` | "Base L2" | "Arbitrum Orbit, L3" |
| `messages/zh/seo.json` | `metadata.keywords` | "Base L2" | "Arbitrum Orbit, L3" |
| `messages/*/common.json` | `wallet.login` | "Login on Base" / localized | "Login on Index L3" / localized |
| `messages/*/common.json` | `deploy_agent.requirements` | "USDC on Base" | "USDC on Base" (this one is correct — agents deploy on Base) |
| `messages/*/portfolio.json` | `bet_details.view_on_basescan` | "View on BaseScan" | "View on Explorer" (the chain is Arbitrum Orbit, not Base) |

**Problem:** The protocol runs on Arbitrum Orbit L3 (chain ID 421611337), not Base L2. SEO keywords referencing "Base L2" are factually wrong and target the wrong search audience. Users searching for Base L2 DeFi won't find an Arbitrum product useful.

**Why this matters:** Wrong keywords mean wrong audience. Google also cross-references claims — if your metadata says "Base" but your chain config says Arbitrum, it's a trust signal mismatch.

**Fix:** Search-and-replace across all 4 locale seo.json files. The `wallet.login` and `portfolio.bet_details.view_on_basescan` strings need locale-appropriate translations.

**Note:** `deploy_agent.requirements` ("USDC on Base") is intentionally correct because the agent deployment flow happens on Base chain.

**Impact:** Correct keyword targeting and factual accuracy across all locales.

---

## 4. HIGH: Invalid Schema Markup (FAQPage, SearchAction, InvestmentFund)

**Files:** `components/seo/JsonLd.tsx`, `app/[locale]/layout.tsx:67`

**Problem 1 — FAQPage (line 114):**
Google restricted FAQPage rich results to **government and healthcare sites only** (August 2023). For all other sites, FAQPage schema is silently ignored by Google. It's dead weight.

**Problem 2 — SearchAction (line 44):**
```json
"potentialAction": {
  "@type": "SearchAction",
  "target": "https://generalmarket.io/?search={search_term_string}"
}
```
The site has **no search functionality**. Declaring a SearchAction for a non-existent search is schema spam. Google may penalize or distrust the site's structured data.

**Problem 3 — InvestmentFund (line 143):**
`InvestmentFund` is a **pending schema.org type** (not in the core vocabulary). Google does not recognize it. It generates Rich Results validation errors.

**Why this matters:** Invalid or inaccurate schema markup erodes Google's trust in your structured data. If 3 out of 5 schema blocks are wrong, Google may start ignoring all of them — including the valid ones (Organization, SoftwareApplication, Breadcrumb).

**Fix:**

1. **Delete FAQJsonLd** component and its usage in `[locale]/layout.tsx:67`
2. **Remove SearchAction** from `WebsiteJsonLd` — just delete the `potentialAction` property
3. **Replace InvestmentFund** with `FinancialProduct` (core schema.org type) on ITP detail pages:
   ```json
   {
     "@type": "FinancialProduct",
     "name": "DeFi Blue Chips (DEFI5)",
     "description": "...",
     "url": "https://generalmarket.io/itp/42",
     "provider": { "@type": "Organization", "name": "General Market" },
     "category": "Index Fund"
   }
   ```
4. **Keep valid schemas:** Organization, WebSite (without SearchAction), SoftwareApplication, BreadcrumbList

**Impact:** Clean structured data that Google actually processes. Prevents validation errors in Search Console.

---

## 5. HIGH: Sitemap Issues (404 URLs, Stale Dates, Missing Pages)

**File:** `app/sitemap.ts`

**Problem 1 — `/docs` returns 404:**
Line 25 includes `{ path: '/docs', ... }` but `/docs` is served by Mintlify proxy (vercel.json rewrite). The sitemap points to `https://generalmarket.io/docs` which may not resolve correctly for crawlers. Additionally, Mintlify has its own sitemap — you shouldn't duplicate their URLs.

**Problem 2 — `new Date()` for all lastModified:**
Lines 39, 52: Every URL gets today's date as `lastModified`. Google knows this is fake and eventually ignores your sitemap dates entirely. Lastmod should reflect actual content change dates.

**Problem 3 — Missing pages:**
`/sources` and `/points` pages exist but aren't in the sitemap.

**Problem 4 — No x-default hreflang:**
The `alternatesForPath()` function maps `en`, `ko`, `ja`, `zh` but doesn't include `x-default` (fallback for users whose language isn't covered).

**Why this matters:** The sitemap is Google's roadmap to your site. Wrong URLs waste crawl budget. Fake dates erode trust. Missing pages mean Google discovers them slower (or never).

**Fix:**

```ts
const staticRoutes = [
  { path: '', changeFrequency: 'daily' as const, priority: 1 },
  { path: '/index', changeFrequency: 'daily' as const, priority: 0.9 },
  { path: '/sources', changeFrequency: 'daily' as const, priority: 0.5 },
  { path: '/points', changeFrequency: 'daily' as const, priority: 0.5 },
  { path: '/privacy', changeFrequency: 'monthly' as const, priority: 0.3 },
  { path: '/terms', changeFrequency: 'monthly' as const, priority: 0.3 },
  // Remove /docs — Mintlify manages its own sitemap
]

function alternatesForPath(path: string) {
  return {
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, localeUrl(path, l)])),
      'x-default': localeUrl(path, defaultLocale), // Add x-default
    },
  }
}

// For lastModified, use static dates for static pages and ITP creation dates for ITP pages:
// Static pages: hardcode a real deploy/update date
// ITP pages: use itp.createdAt or itp.updatedAt if available from API
```

**Impact:** Correct crawl signals, no wasted budget on 404s, all pages discoverable.

---

## 6. HIGH: OG/Twitter Images Returning 404

**Files:** `app/opengraph-image.tsx`, `app/twitter-image.tsx`

**Problem:** These image generation routes exist at the root but return 404. This is likely because the Next.js locale routing (`[locale]/`) causes the image route to not match. When someone shares a link on Twitter/Discord/Slack, no preview image appears — just a blank card.

**Why this matters:** Social sharing is a major traffic driver. A link shared without an image gets dramatically lower engagement (up to 80% fewer clicks). Missing OG images also mean no visual preview in search results that support it.

**Fix:** Two options:

**Option A — Move to locale directory:**
Move `opengraph-image.tsx` and `twitter-image.tsx` into `app/[locale]/` so they inherit the locale routing.

**Option B — Use static OG images:**
Place a pre-generated `og-image.png` (1200x630) in `/public/` and reference it in metadata:
```tsx
openGraph: {
  images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'General Market' }],
},
twitter: {
  card: 'summary_large_image',
  images: ['/og-image.png'],
},
```

Option B is simpler and more reliable. Dynamic OG generation is nice for ITP pages (showing the specific fund name/NAV), but a static fallback should exist.

**Impact:** Social sharing previews work. Links shared on Twitter/Discord/Telegram show a branded card.

---

## 7. HIGH: Vision Homepage — Zero Crawlable Content

**File:** `app/[locale]/page.tsx`

**Current code:**
```tsx
export default function VisionPage() {
  return (
    <main>
      <Header />
      <SourcesGrid />  {/* This is 'use client' — renders nothing server-side */}
      <Footer />
    </main>
  )
}
```

**Problem:** The homepage (Vision landing) contains only `<SourcesGrid />` which is a client component. Combined with the SSR bailout (proposition #1), the homepage has zero crawlable text content. Even after fixing #1, `SourcesGrid` renders nothing on the server because its data comes from client-side hooks.

**Why this matters:** The homepage is the most important page for SEO. Google sees an empty page with just a header/footer. No H1, no descriptive text, no call-to-action — nothing to index.

**Fix:** Add a server-rendered intro section above `<SourcesGrid />`:

```tsx
export default async function VisionPage() {
  const t = await getTranslations('seo.sr_only')

  return (
    <main>
      <Header />
      {/* Server-rendered SEO content */}
      <section className="max-w-site mx-auto px-6 pt-12 pb-6">
        <h1 className="text-3xl font-black tracking-tight">
          {t('h1')}
        </h1>
        <p className="text-text-secondary mt-2 max-w-2xl">
          {/* Add a new key like seo.pages.vision.intro */}
          AI-powered prediction markets on-chain. Agents compete by building
          portfolios of thousands of predictions simultaneously.
        </p>
      </section>
      <SourcesGrid />
      <Footer />
    </main>
  )
}
```

The `sr_only.h1` key already exists ("General Market — On-Chain Index Products") — make it visible, not `sr-only`.

**Impact:** Homepage becomes indexable. Google has content to rank.

---

## 8. HIGH: Client-Only Pages Missing Metadata (sources, points)

**Files:** `app/[locale]/sources/page.tsx`, `app/[locale]/points/page.tsx`

**Problem:** Both pages are fully `'use client'` with no `generateMetadata()` export. They inherit the generic parent metadata ("General Market") with no page-specific title or description.

**Why this matters:** Without unique titles/descriptions, these pages compete with the homepage for the same generic "General Market" query. Google treats them as thin/duplicate content.

**Fix:** For each page, either:

**Option A — Add a wrapper server component:**
```tsx
// app/[locale]/sources/page.tsx
import { getTranslations } from 'next-intl/server'
import { SourcesPageClient } from './SourcesPageClient'

export async function generateMetadata({ params }) {
  const { locale } = await params
  return {
    title: 'Source Monitoring',
    description: 'Live health status of all data sources feeding market prices on General Market.',
  }
}

export default function SourcesPage() {
  return <SourcesPageClient />
}
```

Move the current content to a `SourcesPageClient.tsx` file with `'use client'`.

**Option B — Use static `metadata` export:**
Next.js supports `export const metadata = { title: '...' }` even in client components — but only if you don't also use `generateMetadata`. Simpler but less flexible for i18n.

Add corresponding keys to `seo.json` for all 4 locales.

**Impact:** Each page gets unique title/description in search results. No more generic metadata inheritance.

---

## 9. MEDIUM: Broken Twitter/X Link in Footer

**File:** `components/layout/Footer.tsx:33`

**Current code:**
```tsx
<a href="https://x.com" ...>
```

**Problem:** Links to `https://x.com` (the platform root) instead of `https://x.com/otc_max` (the actual account). This is a broken social signal.

**Why this matters:** Google uses social profile links in Organization schema's `sameAs` to verify brand identity. The JsonLd.tsx correctly uses `https://x.com/otc_max`, but the footer contradicts it. Inconsistent social links reduce trust signals.

**Fix:**
```tsx
<a href="https://x.com/otc_max" ...>
```

**Impact:** Consistent brand signals. Users can actually find the Twitter account.

---

## 10. MEDIUM: PostHog useSearchParams CSR Bailout

**File:** `components/PostHogProvider.tsx:14`

**Current code:**
```tsx
const searchParams = useSearchParams()
```

**Problem:** `useSearchParams()` at the top level of a client component (without a `<Suspense>` boundary) triggers a Next.js CSR bailout. Even after fixing proposition #1, this component would force the entire tree that contains it to bail out of SSR.

**Why this matters:** This is a secondary SSR bailout. Fixing #1 without fixing this would leave you partially broken.

**Fix:** Wrap `useSearchParams` in a Suspense boundary:

```tsx
import { Suspense } from 'react'

function PostHogPageTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname
    posthog.capture('page_viewed', { path: pathname, url, referrer: document.referrer || undefined })
  }, [pathname, searchParams])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { initPostHog() }, [])

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageTracker />
      </Suspense>
      {children}
    </>
  )
}
```

**Impact:** Prevents secondary SSR bailout. PostHog tracking still works identically.

---

## 11. MEDIUM: wagmi SSR Configuration

**File:** `lib/wagmi.ts:45`

**Current code:**
```tsx
export const wagmiConfig = createConfig({
  chains: [indexL3],
  connectors: [injected()],
  transports: { [indexL3.id]: chainTransport },
})
```

**Problem:** wagmi v2 supports `ssr: true` in config which avoids `indexedDB` access during server rendering. Without it, wagmi tries to access browser APIs during SSR, which is why `ssr: false` was added to `client-providers.tsx` in the first place.

**Why this matters:** This is the root cause that led to proposition #1. Adding `ssr: true` here is what makes it safe to remove `ssr: false` from the dynamic import.

**Fix:**
```tsx
export const wagmiConfig = createConfig({
  chains: [indexL3],
  connectors: [injected()],
  transports: { [indexL3.id]: chainTransport },
  ssr: true, // Prevents indexedDB access during SSR
})
```

**Impact:** Enables SSR for the entire app without indexedDB errors.

---

## 12. MEDIUM: Generic Page Titles and Descriptions

**File:** `messages/en/seo.json` (and ja, ko, zh equivalents)

**Current:**
```json
"title": "General Market",
"description": "The institutional-grade protocol for on-chain index products."
```

**Problem:** The title "General Market" is generic and doesn't differentiate in search results. The description is accurate but doesn't include a call-to-action or differentiator.

**Why this matters:** Page titles are the #1 on-page ranking factor. A descriptive title helps both ranking and click-through rate. "General Market" alone competes with every general marketplace in the world.

**Fix:**
```json
"title": "General Market — On-Chain Index Products & AI Prediction Markets",
"description": "Create, trade, and manage tokenized index products on-chain. AI agents compete in prediction markets. Built on Arbitrum Orbit L3."
```

For ITP pages, the current `"{name} ({symbol})"` pattern is good. For Vision:
```json
"vision": {
  "title": "Vision — AI Prediction Markets",
  "description": "AI agents compete by building portfolios of predictions across 25,000+ markets. Peer-to-peer betting on Base with BLS-verified settlement."
}
```

**Impact:** Better SERP click-through rate and keyword targeting.

---

## 13. MEDIUM: Missing x-default Hreflang in Sitemap

**File:** `app/sitemap.ts:14-17`

**Problem:** The `alternatesForPath()` function generates hreflang for `en`, `ko`, `ja`, `zh` but no `x-default`. The `x-default` hreflang tells Google "for any language not listed, use this URL."

**Why this matters:** Without `x-default`, visitors whose browser language isn't en/ko/ja/zh may see a random locale version in search results.

**Fix:** Already covered in proposition #5, but specifically:
```ts
'x-default': localeUrl(path, defaultLocale),
```

**Impact:** Correct language fallback behavior in search results.

---

## 14. MEDIUM: Duplicate Entries in Sitemap (Per-Locale Bloat)

**File:** `app/sitemap.ts:34-44`

**Problem:** The sitemap generates one entry per locale per route (4 entries for `/index`). With hreflang alternates already set, Google only needs one entry per route with the alternates pointing to all locale variants. The current approach inflates the sitemap 4x.

**Why this matters:** Bloated sitemaps waste crawl budget. Google may throttle crawl rate if the sitemap is too large relative to the site's authority.

**Fix:** Generate one entry per route (using the default locale URL) with alternates covering all locales:

```ts
for (const route of staticRoutes) {
  entries.push({
    url: localeUrl(route.path, defaultLocale), // One canonical entry
    lastModified: route.lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    alternates: alternatesForPath(route.path), // All locales listed here
  })
}
```

**Impact:** Cleaner sitemap, no wasted crawl budget.

---

## 15. MEDIUM: No H3 Hierarchy / Duplicate H2s

**Problem:** Multiple pages use H2 for section titles but never use H3 for subsections. Some pages have duplicate H2 text (e.g., "Holdings" appears multiple times on ITP pages). The heading hierarchy jumps H1 → H2 with no H3.

**Why this matters:** Heading hierarchy helps Google understand content structure. Missing levels (H1 → H2 with no H3) aren't a ranking penalty, but proper hierarchy improves content understanding for featured snippets and passage ranking.

**Fix:** Audit each page template and ensure:
- One visible H1 per page (currently sr-only on most pages — see #7)
- H2 for major sections
- H3 for subsections within H2 blocks
- No duplicate heading text on the same page

This is a content-structure task, best done page-by-page during content improvements.

**Impact:** Better content structure signals. Minor ranking improvement.

---

## 16. MEDIUM: Skeleton Loading CLS (Cumulative Layout Shift)

**Problem:** Client-side data loading uses skeleton screens that may cause layout shift when real content replaces them. If skeleton dimensions don't match final content, CLS increases.

**Why this matters:** CLS is a Core Web Vital. Google uses it as a ranking signal. Threshold: Good < 0.1, Needs Improvement < 0.25, Poor ≥ 0.25.

**Fix:** Ensure all skeleton components use explicit `min-height` / `width` / `aspect-ratio` matching the final rendered content. For tables: use fixed column widths. For cards: use fixed heights.

**Impact:** Better CLS score. Better Core Web Vitals ranking signal.

---

## 17. LOW: Missing Preconnect Hints

**File:** `app/layout.tsx`

**Problem:** No `<link rel="preconnect">` for external origins the page will need (RPC endpoint, PostHog, fonts).

**Why this matters:** Preconnect saves ~100-200ms per external connection by establishing TCP+TLS early. Faster page load = better CWV scores.

**Fix:** Add to `app/layout.tsx` `<head>`:
```tsx
<link rel="preconnect" href="https://us.i.posthog.com" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
```

Note: Google Fonts with `next/font` already handles font preloading, so the fonts preconnect may be redundant. Check if PostHog is the main latency contributor.

**Impact:** Minor performance improvement. ~100-200ms faster initial load.

---

## 18. LOW: No Custom 404 Page

**Problem:** No `app/not-found.tsx` exists. Next.js serves a default 404 page with no branding or navigation back to useful content.

**Why this matters:** Custom 404 pages retain users who hit dead links. They can link back to the homepage, sitemap, or popular pages. Crawlers also benefit from seeing a proper 404 with navigation.

**Fix:** Create `app/not-found.tsx`:
```tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-black">404</h1>
        <p className="text-text-secondary mt-2">Page not found</p>
        <Link href="/" className="mt-4 inline-block text-sm font-bold underline">
          Back to General Market
        </Link>
      </div>
    </main>
  )
}
```

**Impact:** Better user experience on dead links. Minor SEO benefit from internal linking.

---

## 19. LOW: ISR/Caching for ITP Pages

**File:** `app/[locale]/itp/[itpId]/page.tsx`

**Problem:** ITP detail pages fetch data on every request with no caching. This slows response time and increases server load.

**Why this matters:** Faster server response time (TTFB) is a Core Web Vital proxy metric. ISR (Incremental Static Regeneration) can serve cached pages while revalidating in the background.

**Fix:** Add `revalidate` to the page:
```tsx
export const revalidate = 60 // Revalidate every 60 seconds
```

Or use `unstable_cache` for the data fetching function. NAV prices update ~every minute, so a 60s revalidate is reasonable.

**Impact:** Faster TTFB for ITP pages. Reduces server load.

---

## 20. E-E-A-T: No Team/About Page

**Problem:** No `/about` or `/team` page exists. E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) is Google's quality framework. For financial products, Trustworthiness is weighted heavily.

**Why this matters:** Google's Quality Rater Guidelines specifically call out financial sites ("Your Money or Your Life" / YMYL) as needing strong trust signals. A DeFi protocol with no team page is a red flag.

**Fix:** Create an `/about` page with:
- Team members (names, roles, links to LinkedIn/Twitter)
- Company mission
- Security audit information (if any)
- Contact information

This is a content task, not a code task.

**Impact:** Significant trust signal for YMYL queries. Can improve rankings for financial keywords.

---

## 21. E-E-A-T: No Blog or Educational Content

**Problem:** No blog, guides, or educational content exists. The docs (Mintlify) cover technical API documentation but not educational "what is an ITP" / "how DeFi indexes work" content.

**Why this matters:** Educational content targets informational queries ("what is a crypto index fund"), which are high-volume and build topical authority. A site that only has transactional pages (buy/sell/trade) misses the entire top-of-funnel.

**Fix:** Consider adding a `/blog` or `/learn` section with articles like:
- "What Are Index Tracking Products (ITPs)?"
- "How On-Chain Index Funds Work"
- "Understanding NAV in DeFi"
- "AI Prediction Markets Explained"

This is a long-term content strategy task.

**Impact:** Topical authority. Captures informational search traffic. Builds E-E-A-T.

---

## 22. E-E-A-T: Thin ITP Detail Pages

**File:** `app/[locale]/itp/[itpId]/page.tsx`

**Problem:** ITP detail pages show a holdings table, NAV, and AUM — but no explanatory content about the specific ITP's strategy, risk profile, or performance history. Each page is ~200 words of data with no editorial content.

**Why this matters:** Google considers pages with only data tables as "thin content." Adding 200+ words of unique, descriptive text per ITP page significantly improves their ranking potential.

**Fix:** For each ITP, add:
- A description paragraph (strategy, thesis)
- Performance summary (if data available)
- Risk disclaimer
- Related ITPs

The descriptions could be generated from the ITP's asset composition (e.g., "This ITP tracks 10 large-cap DeFi tokens weighted by market cap...").

**Impact:** Each ITP page becomes a standalone content page rather than a thin data table.

---

## 23. AI Search: No dateModified in JSON-LD

**Problem:** No schema markup includes `dateModified` or `datePublished`. AI search engines (ChatGPT, Perplexity) and Google AI Overviews prefer fresh, dated content.

**Why this matters:** AI citation engines prioritize recent content. Without dates, your content is treated as undated/potentially stale.

**Fix:** Add `dateModified` to the WebSite schema and individual page schemas:
```json
{
  "@type": "WebSite",
  "dateModified": "2026-02-27"
}
```

For ITP pages, use the ITP's last rebalance date or last trade date.

**Impact:** Better visibility in AI-powered search results.

---

## 24. AI Search: No Vision/Betting Structured Data

**Problem:** The Vision (prediction markets / betting) section has no structured data at all. No schema describes what a "portfolio bet" is, who the agents are, or how the leaderboard works.

**Why this matters:** AI search engines parse structured data to understand novel concepts. Without it, they may misrepresent or skip Vision entirely.

**Fix:** Consider `SportsEvent` or custom `Event` schema for bet resolutions. For the leaderboard, `ItemList` schema could work:
```json
{
  "@type": "ItemList",
  "name": "AI Agent Leaderboard",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Agent 0x1234...", "url": "..." }
  ]
}
```

This is exploratory — no standard schema exists for prediction markets. Focus on the basics (#1-#5) first.

**Impact:** Better AI search understanding of the Vision product.

---

## Priority Implementation Order

| # | Priority | Effort | Proposition |
|---|----------|--------|-------------|
| 1 | CRITICAL | Medium | SSR Bailout fix |
| 11 | CRITICAL (dep of #1) | Trivial | wagmi `ssr: true` |
| 10 | CRITICAL (dep of #1) | Small | PostHog Suspense |
| 2 | CRITICAL | Small | Canonical URL fix |
| 4 | HIGH | Medium | Schema cleanup |
| 5 | HIGH | Small | Sitemap fixes |
| 3 | HIGH | Small | Chain name fixes |
| 9 | MEDIUM | Trivial | Footer Twitter link |
| 6 | HIGH | Small | OG images |
| 7 | HIGH | Medium | Vision homepage content |
| 8 | HIGH | Small | Page metadata |
| 12 | MEDIUM | Small | Better titles |
| 13 | MEDIUM | Trivial | x-default hreflang |
| 14 | MEDIUM | Small | Sitemap dedup |
| 17 | LOW | Trivial | Preconnect hints |
| 18 | LOW | Small | Custom 404 |
| 19 | LOW | Trivial | ISR caching |
| 15 | MEDIUM | Medium | Heading hierarchy |
| 16 | MEDIUM | Medium | Skeleton CLS |
| 20 | E-E-A-T | Large | About/Team page |
| 21 | E-E-A-T | Large | Blog/Learn content |
| 22 | E-E-A-T | Medium | ITP descriptions |
| 23 | AI Search | Small | dateModified |
| 24 | AI Search | Medium | Vision structured data |

**Recommended approach:** Fix #1 + #11 + #10 + #2 together (they're interconnected — SSR + canonical). Then #4 + #5 + #3 as a second batch. Then everything else by priority.

**Expected score after CRITICAL + HIGH fixes:** ~65-70/100
**Expected score after all fixes:** ~80-85/100
**(E-E-A-T content work needed for 90+)**
