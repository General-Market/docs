# i18n Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full Korean, Japanese, and Simplified Chinese translations to the Next.js 15 frontend with geo-based locale detection and cookie persistence.

**Architecture:** `next-intl` with App Router `[locale]` segment, Cloudflare/Vercel geo middleware, per-component JSON translation files. See `docs/plans/2026-02-22-i18n-design.md` for full design.

**Tech Stack:** next-intl, Next.js 15 App Router middleware, Cloudflare CF-IPCountry header

---

### Task 1: Install next-intl and create i18n config

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/i18n/config.ts`
- Create: `frontend/i18n/request.ts`

**Step 1: Install next-intl**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && npm install next-intl`

**Step 2: Create i18n config**

Create `frontend/i18n/config.ts`:
```typescript
export const locales = ['en', 'ko', 'ja', 'zh'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  KR: 'ko',
  JP: 'ja',
  CN: 'zh',
  SG: 'zh',
  MY: 'zh',
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  zh: '中文',
}
```

**Step 3: Create i18n request config**

Create `frontend/i18n/request.ts`:
```typescript
import { getRequestConfig } from 'next-intl/server'
import { locales, type Locale } from './config'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !locales.includes(locale as Locale)) {
    locale = 'en'
  }

  // Load all namespace files for this locale
  const namespaces = [
    'common', 'markets', 'portfolio', 'create-itp',
    'buy-modal', 'sell-modal', 'lending', 'p2pool',
    'backtest', 'system', 'seo'
  ]

  const messages: Record<string, Record<string, unknown>> = {}
  for (const ns of namespaces) {
    try {
      messages[ns] = (await import(`../../messages/${locale}/${ns}.json`)).default
    } catch {
      // Fallback to English if translation file missing
      messages[ns] = (await import(`../../messages/en/${ns}.json`)).default
    }
  }

  return { locale, messages }
})
```

**Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/i18n/
git commit -m "feat(i18n): install next-intl, add i18n config and request loader"
```

---

### Task 2: Create English translation files (source of truth)

**Files:**
- Create: `frontend/messages/en/common.json`
- Create: `frontend/messages/en/markets.json`
- Create: `frontend/messages/en/portfolio.json`
- Create: `frontend/messages/en/create-itp.json`
- Create: `frontend/messages/en/buy-modal.json`
- Create: `frontend/messages/en/sell-modal.json`
- Create: `frontend/messages/en/lending.json`
- Create: `frontend/messages/en/p2pool.json`
- Create: `frontend/messages/en/backtest.json`
- Create: `frontend/messages/en/system.json`
- Create: `frontend/messages/en/seo.json`

Extract every hardcoded English string from the codebase into these files. This is the most labor-intensive task.

**Step 1: Extract layout strings → common.json**

Read `frontend/components/layout/Header.tsx` and `frontend/components/layout/Footer.tsx`. Extract all strings into `frontend/messages/en/common.json`:

```json
{
  "brand": {
    "name": "General Market",
    "tagline": "Decentralized Index Products",
    "topbar": "General Market — Decentralized Index Products",
    "description": "Institutional-grade index products for the digital asset economy."
  },
  "nav": {
    "investment": "Investment",
    "vision": "Vision",
    "docs": "Docs",
    "support": "Support",
    "markets": "Markets",
    "portfolio": "Portfolio",
    "create": "Create",
    "lend": "Lend",
    "backtest": "Backtest",
    "system": "System",
    "p2pool": "P2Pool",
    "leaderboard": "Leaderboard",
    "markets_data": "Markets"
  },
  "footer": {
    "product": "Product",
    "resources": "Resources",
    "indexes": "Indexes",
    "simulation": "Simulation",
    "lending": "Lending",
    "create_itp": "Create ITP",
    "discord": "Discord",
    "privacy_policy": "Privacy Policy",
    "terms_of_service": "Terms of Service",
    "copyright": "© 2026 General Market. All rights reserved.",
    "disclaimer": "Index products involve risk. Past performance does not guarantee future results. This platform does not provide financial advice."
  },
  "aria": {
    "toggle_menu": "Toggle menu",
    "discord": "Discord",
    "twitter": "X (Twitter)"
  },
  "language": {
    "label": "Language",
    "en": "English",
    "ko": "한국어",
    "ja": "日本語",
    "zh": "中文"
  },
  "actions": {
    "connect_wallet": "Connect Wallet",
    "disconnect": "Disconnect",
    "close": "Close",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "submit": "Submit",
    "loading": "Loading...",
    "copy": "Copy",
    "copied": "Copied!",
    "share": "Share"
  },
  "status": {
    "pending": "Pending",
    "batched": "Batched",
    "filled": "Filled",
    "cancelled": "Cancelled",
    "expired": "Expired",
    "active": "Active",
    "completed": "Completed"
  },
  "errors": {
    "generic": "Something went wrong. Please try again.",
    "wallet_not_connected": "Please connect your wallet first.",
    "wrong_chain": "Please switch to the correct network."
  }
}
```

**Step 2: Extract remaining component strings**

For each namespace file, read the corresponding components and extract all hardcoded strings. The pattern is:
1. Read component source file
2. Find every English string literal in JSX, labels, placeholders, error messages
3. Create descriptive hierarchical keys
4. Add to the appropriate namespace JSON

**Key files to read per namespace:**

- `markets.json` ← `MarketsSection.tsx`, `VisionMarketsGrid.tsx`, `ItpListing.tsx`
- `portfolio.json` ← `PortfolioSection.tsx`, `PortfolioModal.tsx`, `CostBasisCard.tsx`, `USDCBalanceCard.tsx`
- `create-itp.json` ← `CreateItpSection.tsx`
- `buy-modal.json` ← `BuyItpModal.tsx`, `TransactionStepper.tsx`
- `sell-modal.json` ← `SellItpModal.tsx`
- `lending.json` ← `VaultModal.tsx`, `LendingSection.tsx`, `lending/BorrowUsdc.tsx`, `lending/DepositCollateral.tsx`, `lending/RepayDebt.tsx`, `lending/WithdrawCollateral.tsx`, `lending/LendingHistory.tsx`, `lending/MarketsTable.tsx`, `lending/PositionCard.tsx`, `lending/VaultDeposit.tsx`, `lending/VaultPosition.tsx`
- `p2pool.json` ← `p2pool/P2PoolPage.tsx`, `p2pool/BatchCard.tsx`, `p2pool/CreateBatchModal.tsx`, `p2pool/ExpandedBatch.tsx`, `p2pool/DepositModal.tsx`, `p2pool/WithdrawModal.tsx`, `p2pool/StrategyTemplates.tsx`
- `backtest.json` ← `simulation/BacktestSection.tsx`, `simulation/SimFilterPanel.tsx`, `simulation/SimHoldingsTable.tsx`, `simulation/SimStatsGrid.tsx`
- `system.json` ← `SystemStatusSection.tsx`, `ConnectionStatus.tsx`
- `seo.json` ← `app/layout.tsx`, `app/page.tsx`, `app/itp/[itpId]/page.tsx`, `app/vision/page.tsx`, `components/seo/JsonLd.tsx`

**Step 3: Commit**

```bash
git add frontend/messages/en/
git commit -m "feat(i18n): extract all English strings into translation files"
```

---

### Task 3: Create Korean, Japanese, and Chinese translation files

**Files:**
- Create: `frontend/messages/ko/*.json` (11 files)
- Create: `frontend/messages/ja/*.json` (11 files)
- Create: `frontend/messages/zh/*.json` (11 files)

**Step 1: For each locale, copy English structure and translate**

Copy the exact key structure from `messages/en/` to each locale directory. Translate values following these rules:

- DeFi acronyms stay English: ITP, NAV, USDC, APY, TVL, DeFi, L3, ETF
- Add native descriptions in parentheses for key terms: `"NAV (순자산가치)"`
- Keep brand name "General Market" untranslated
- Keep technical identifiers untranslated (chain names, token symbols)
- Translate all UI chrome: buttons, labels, descriptions, placeholders, errors, statuses

**Step 2: Commit per locale**

```bash
git add frontend/messages/ko/ && git commit -m "feat(i18n): add Korean translations"
git add frontend/messages/ja/ && git commit -m "feat(i18n): add Japanese translations"
git add frontend/messages/zh/ && git commit -m "feat(i18n): add Chinese (Simplified) translations"
```

---

### Task 4: Add middleware for locale detection and routing

**Files:**
- Create: `frontend/middleware.ts`
- Modify: `frontend/next.config.ts` (add next-intl plugin)

**Step 1: Create middleware**

Create `frontend/middleware.ts`:
```typescript
import createMiddleware from 'next-intl/middleware'
import { NextRequest } from 'next/server'
import { locales, defaultLocale, COUNTRY_TO_LOCALE, type Locale } from './i18n/config'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed' // don't add /en prefix for default locale
})

export default function middleware(request: NextRequest) {
  // If user has a locale cookie, next-intl handles it
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value

  if (!cookieLocale) {
    // Geo detection: Cloudflare first, then Vercel
    const country =
      request.headers.get('cf-ipcountry') ||
      request.geo?.country ||
      ''

    const geoLocale = COUNTRY_TO_LOCALE[country]
    if (geoLocale && geoLocale !== defaultLocale) {
      // Set cookie so future visits remember
      const response = intlMiddleware(request)
      response.cookies.set('NEXT_LOCALE', geoLocale, {
        maxAge: 365 * 24 * 60 * 60,
        path: '/',
        sameSite: 'lax'
      })
      return response
    }
  }

  return intlMiddleware(request)
}

export const config = {
  // Match all paths except api, _next, static files
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
}
```

**Step 2: Update next.config.ts**

Add next-intl plugin to `frontend/next.config.ts`:
```typescript
import createNextIntlPlugin from 'next-intl/plugin'
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

// Wrap existing config:
export default withNextIntl(nextConfig)
```

**Step 3: Verify middleware runs**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && npm run build`
Expected: Build succeeds without errors.

**Step 4: Commit**

```bash
git add frontend/middleware.ts frontend/next.config.ts
git commit -m "feat(i18n): add locale middleware with Cloudflare/Vercel geo detection"
```

---

### Task 5: Restructure app routes under [locale]

**Files:**
- Create: `frontend/app/[locale]/layout.tsx` (new locale-aware layout)
- Move: `frontend/app/page.tsx` → `frontend/app/[locale]/page.tsx`
- Move: `frontend/app/itp/` → `frontend/app/[locale]/itp/`
- Move: `frontend/app/vision/` → `frontend/app/[locale]/vision/`
- Move: `frontend/app/privacy/` → `frontend/app/[locale]/privacy/`
- Move: `frontend/app/terms/` → `frontend/app/[locale]/terms/`
- Modify: `frontend/app/layout.tsx` (strip locale-specific content, keep as bare root)

**Step 1: Create [locale] layout**

Create `frontend/app/[locale]/layout.tsx`:
```typescript
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales, type Locale } from '@/i18n/config'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo' })
  return {
    title: { default: t('title'), template: t('title_template') },
    description: t('description'),
    openGraph: { locale },
    alternates: {
      languages: Object.fromEntries(
        locales.map((l) => [l, `/${l}`])
      ),
    },
  }
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()

  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
```

**Step 2: Modify root layout**

Modify `frontend/app/layout.tsx`: remove metadata strings (moved to [locale] layout), make `<html lang>` dynamic. Keep fonts, body structure, ClientProviders. The root layout should accept a `locale` prop or read it from the URL.

**Step 3: Move all page routes under [locale]**

Move each page directory/file into `app/[locale]/`:
```bash
mkdir -p frontend/app/\[locale\]
mv frontend/app/page.tsx frontend/app/\[locale\]/page.tsx
mv frontend/app/itp frontend/app/\[locale\]/itp
mv frontend/app/vision frontend/app/\[locale\]/vision
mv frontend/app/privacy frontend/app/\[locale\]/privacy
mv frontend/app/terms frontend/app/\[locale\]/terms
```

Keep `app/api/` at root level (no locale prefix for API routes).

**Step 4: Update any internal `<Link>` href paths**

Search all components for `<Link href="/..."` and update to use `next-intl`'s `Link` component or prepend locale. `next-intl` provides a `Link` wrapper that auto-prefixes locale:

```typescript
import { Link } from '@/i18n/routing'
// Instead of: <Link href="/itp/5">
// Use:        <Link href="/itp/5">  (auto-prefixed by next-intl)
```

Create `frontend/i18n/routing.ts`:
```typescript
import { createNavigation } from 'next-intl/navigation'
import { locales, defaultLocale } from './config'

export const { Link, redirect, usePathname, useRouter } =
  createNavigation({ locales, defaultLocale, localePrefix: 'as-needed' })
```

**Step 5: Build test**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && npm run build`
Expected: Build succeeds. All routes now under `[locale]`.

**Step 6: Commit**

```bash
git add frontend/app/ frontend/i18n/routing.ts
git commit -m "feat(i18n): restructure app routes under [locale] segment"
```

---

### Task 6: Wire translations into layout components (Header + Footer)

**Files:**
- Modify: `frontend/components/layout/Header.tsx`
- Modify: `frontend/components/layout/Footer.tsx`
- Create: `frontend/components/layout/LanguageSwitcher.tsx`

**Step 1: Create LanguageSwitcher component**

Create `frontend/components/layout/LanguageSwitcher.tsx`:
```typescript
'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/routing'
import { locales, LOCALE_LABELS, type Locale } from '@/i18n/config'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  function onSelectChange(newLocale: string) {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`
    router.replace(pathname, { locale: newLocale as Locale })
  }

  return (
    <select
      value={locale}
      onChange={(e) => onSelectChange(e.target.value)}
      className="bg-transparent text-xs border border-white/20 rounded px-2 py-1 text-white/70 hover:text-white cursor-pointer"
      aria-label="Language"
    >
      {locales.map((l) => (
        <option key={l} value={l} className="bg-black text-white">
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  )
}
```

**Step 2: Wire Header.tsx**

Replace hardcoded strings in `Header.tsx` with `useTranslations('common')`:
```typescript
const t = useTranslations('common')

const INVESTMENT_NAV = [
  { id: 'markets', label: t('nav.markets') },
  { id: 'portfolio', label: t('nav.portfolio') },
  { id: 'create', label: t('nav.create') },
  { id: 'lend', label: t('nav.lend') },
  { id: 'backtest', label: t('nav.backtest') },
  { id: 'system', label: t('nav.system') },
]
```

Add `<LanguageSwitcher />` to the header (next to Docs/Support links).

Replace all `<Link>` imports with `import { Link } from '@/i18n/routing'`.

**Step 3: Wire Footer.tsx**

Same pattern: `useTranslations('common')` for all footer strings.

**Step 4: Build test**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && npm run dev`
Visit `http://localhost:3000` — verify header/footer render with translations.
Visit `http://localhost:3000/ko` — verify Korean strings appear.

**Step 5: Commit**

```bash
git add frontend/components/layout/
git commit -m "feat(i18n): wire Header, Footer, and LanguageSwitcher with translations"
```

---

### Task 7: Wire translations into domain components (batch 1 — core sections)

**Files:**
- Modify: `frontend/components/domain/HomeClient.tsx`
- Modify: `frontend/components/domain/ItpListing.tsx`
- Modify: `frontend/components/domain/MarketsSection.tsx`
- Modify: `frontend/components/domain/PortfolioSection.tsx`
- Modify: `frontend/components/domain/CreateItpSection.tsx`

For each component:
1. Add `import { useTranslations } from 'next-intl'`
2. Add `const t = useTranslations('<namespace>')` at top of component
3. Replace every hardcoded string with `t('key')`
4. Replace `<Link>` with locale-aware Link from `@/i18n/routing`

**Commit after this batch:**
```bash
git add frontend/components/domain/
git commit -m "feat(i18n): wire core section components with translations"
```

---

### Task 8: Wire translations into domain components (batch 2 — modals)

**Files:**
- Modify: `frontend/components/domain/BuyItpModal.tsx`
- Modify: `frontend/components/domain/SellItpModal.tsx`
- Modify: `frontend/components/domain/VaultModal.tsx`
- Modify: `frontend/components/domain/RebalanceModal.tsx`
- Modify: `frontend/components/domain/LendItpModal.tsx`
- Modify: `frontend/components/domain/ChartModal.tsx`
- Modify: `frontend/components/ui/TransactionStepper.tsx`

Same pattern as Task 7. Pay attention to dynamic micro-step labels in BuyItpModal and SellItpModal — these use function-based labels that need `t()` calls.

**Commit:**
```bash
git add frontend/components/domain/ frontend/components/ui/TransactionStepper.tsx
git commit -m "feat(i18n): wire modal components with translations"
```

---

### Task 9: Wire translations into domain components (batch 3 — lending, p2pool, simulation)

**Files:**
- Modify: all files in `frontend/components/lending/`
- Modify: all files in `frontend/components/domain/p2pool/`
- Modify: all files in `frontend/components/domain/simulation/`

Same pattern. Use `lending`, `p2pool`, and `backtest` namespaces respectively.

**Commit:**
```bash
git add frontend/components/lending/ frontend/components/domain/p2pool/ frontend/components/domain/simulation/
git commit -m "feat(i18n): wire lending, P2Pool, and simulation components with translations"
```

---

### Task 10: Wire translations into remaining domain components

**Files:**
- Modify: remaining components in `frontend/components/domain/` not covered by Tasks 7-9
- This includes: `BotTradingNotice.tsx`, `WalletConnectButton.tsx`, `HowItWorks.tsx`, `SystemStatusSection.tsx`, leaderboard components, bet/agent components, balance cards, etc.

Same pattern. Use `common` namespace for shared strings, domain-specific namespaces where appropriate.

**Commit:**
```bash
git add frontend/components/domain/ frontend/components/ui/
git commit -m "feat(i18n): wire remaining domain and UI components with translations"
```

---

### Task 11: Wire translations into pages and SEO metadata

**Files:**
- Modify: `frontend/app/[locale]/page.tsx`
- Modify: `frontend/app/[locale]/itp/[itpId]/page.tsx`
- Modify: `frontend/app/[locale]/vision/page.tsx`
- Modify: `frontend/app/[locale]/privacy/page.tsx`
- Modify: `frontend/app/[locale]/terms/page.tsx`
- Modify: `frontend/app/sitemap.ts`
- Modify: `frontend/components/seo/JsonLd.tsx`

**Step 1: Wire page metadata**

Each page's `generateMetadata` should use `getTranslations({ locale, namespace: 'seo' })`.

**Step 2: Update sitemap**

`sitemap.ts` should generate URLs for all locales:
```typescript
import { locales } from '@/i18n/config'

// For each page, generate entries per locale with alternates
locales.flatMap(locale => pages.map(page => ({
  url: `https://generalmarket.io/${locale}${page.path}`,
  alternates: {
    languages: Object.fromEntries(
      locales.map(l => [l, `https://generalmarket.io/${l}${page.path}`])
    )
  }
})))
```

**Step 3: Wire privacy/terms pages**

These have large blocks of legal text. Create dedicated keys in `common.json` or a new `legal.json` namespace if the strings are extensive.

**Step 4: Commit**

```bash
git add frontend/app/ frontend/components/seo/
git commit -m "feat(i18n): wire page metadata, sitemap, and legal pages with translations"
```

---

### Task 12: Create translation completeness check script

**Files:**
- Create: `frontend/scripts/check-translations.ts`

**Step 1: Write the script**

Create `frontend/scripts/check-translations.ts`:
```typescript
import fs from 'fs'
import path from 'path'

const MESSAGES_DIR = path.join(__dirname, '..', 'messages')
const LOCALES = ['en', 'ko', 'ja', 'zh']
const SOURCE_LOCALE = 'en'

function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null) {
      return getKeys(value as Record<string, unknown>, fullKey)
    }
    return [fullKey]
  })
}

let hasErrors = false

const sourceDir = path.join(MESSAGES_DIR, SOURCE_LOCALE)
const namespaces = fs.readdirSync(sourceDir).filter(f => f.endsWith('.json'))

for (const ns of namespaces) {
  const sourceKeys = getKeys(JSON.parse(fs.readFileSync(path.join(sourceDir, ns), 'utf8')))

  for (const locale of LOCALES.filter(l => l !== SOURCE_LOCALE)) {
    const targetPath = path.join(MESSAGES_DIR, locale, ns)
    if (!fs.existsSync(targetPath)) {
      console.error(`MISSING: ${locale}/${ns}`)
      hasErrors = true
      continue
    }
    const targetKeys = getKeys(JSON.parse(fs.readFileSync(targetPath, 'utf8')))
    const missing = sourceKeys.filter(k => !targetKeys.includes(k))
    const extra = targetKeys.filter(k => !sourceKeys.includes(k))
    if (missing.length) {
      console.error(`${locale}/${ns}: ${missing.length} missing keys: ${missing.join(', ')}`)
      hasErrors = true
    }
    if (extra.length) {
      console.warn(`${locale}/${ns}: ${extra.length} extra keys: ${extra.join(', ')}`)
    }
  }
}

if (hasErrors) {
  console.error('\nTranslation check FAILED — missing keys found.')
  process.exit(1)
} else {
  console.log('\nAll translations complete!')
}
```

**Step 2: Add npm script**

Add to `package.json` scripts:
```json
"check-translations": "npx tsx scripts/check-translations.ts"
```

**Step 3: Run it**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && npm run check-translations`
Expected: All translations complete (or lists missing keys to fix).

**Step 4: Commit**

```bash
git add frontend/scripts/check-translations.ts frontend/package.json
git commit -m "feat(i18n): add translation completeness check script"
```

---

### Task 13: Full build and smoke test

**Step 1: Build**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && npm run build`
Expected: Clean build, no errors.

**Step 2: Smoke test all locales**

Run dev server: `cd /Users/maxguillabert/Downloads/index/frontend && npm run dev`

Test each locale:
- `http://localhost:3000` → English (default)
- `http://localhost:3000/ko` → Korean
- `http://localhost:3000/ja` → Japanese
- `http://localhost:3000/zh` → Chinese

Verify for each:
- Header renders in correct language
- Footer renders in correct language
- Navigation labels translated
- Language switcher works and persists via cookie
- Page metadata (title, description) in correct language
- Internal links preserve locale prefix

**Step 3: Verify agent-friendliness**

Fetch without JS (simulating agent):
```bash
curl -s http://localhost:3000/ko | head -20
```
Expected: `<html lang="ko">` and Korean strings in server-rendered HTML.

**Step 4: Final commit**

```bash
git add -A && git commit -m "feat(i18n): complete KO/JA/ZH translations — build verified"
```
