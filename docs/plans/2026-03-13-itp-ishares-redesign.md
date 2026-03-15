# ITP Page Redesign — iShares Style (v3)

> Revised after 2 rounds of adversarial review (6 reviewers total). All CRITICAL/HIGH resolved.

## Design Principles
1. **Every number has a date** — Use `new Date().toLocaleDateString()` as render timestamp (data is real-time via SSE/ISR)
2. **Institutional typography** — Large bold values, small gray labels, no tiny uppercase headers
3. **Tab-based navigation** — Real tab panels (show/hide), not anchor scroll
4. **No card borders on data sections** — Horizontal rules only, white background, `py-8` spacing between sections
5. **Empty states are designed** — Loading skeleton when nav=0, never show "$0.00" as real data
6. **Adapt iShares to crypto** — Keep unique sections (Founders, DeFi, Funding) styled institutionally

## "As of" Date Strategy

**Problem from R2**: No API returns timestamps.

**Solution**: Our data is live (SSE for NAV, ISR 60s for enrichment, CoinGecko 5min cache). The "as of" date is the **current render date**, which is accurate because:
- NAV comes from SSE (real-time) → "as of {today}"
- Holdings/enrichment revalidates every 60s → "as of {today}"
- This matches iShares which shows "as of {today}" for NAV (their data is also end-of-day delayed)

Implementation: Single helper function:
```typescript
function asOfToday() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
```

For inception date: Use `config.createdAt` (hardcoded per ITP type, accurate for ITP #1).

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ HERO: Category + Ticker Badge + Fund Name + BUY CTA      │
│ (inside ItpPageClient — client component with modal state)│
├──────────────────────────────────────────────────────────┤
│ STATS BAR: NAV (large) | 1D Change | AUM | Holdings     │
│           with "as of" dates under each                  │
├──────────────────────────────────────────────────────────┤
│ TABS: [Overview] [Performance] [Key Facts] [Holdings]    │
│ (NOT sticky — avoids z-index collision with Header)      │
├──────────────────────────────────────────────────────────┤
│ TAB PANELS (show/hide, min-height: 400px):               │
│                                                          │
│ Overview:                                                │
│   - Investment Objective + "Why This Index?"             │
│   - Portfolio Composition (donut + legend)               │
│   - Concentration Metrics                                │
│   - Founder Intelligence (conditional)                   │
│   - DeFi Protocol Health (conditional)                   │
│   - Funding Intelligence (conditional)                   │
│                                                          │
│ Performance:                                             │
│   - NAV Chart (1D/7D/90D — existing timeframes only)     │
│   - Since Inception Return (single stat, not a table)    │
│                                                          │
│ Key Facts:                                               │
│   - Fund Details (2-col grid)                            │
│   - Portfolio Characteristics (2-col grid)               │
│   - Fees (read from on-chain FeeRegistry, NOT hardcoded) │
│                                                          │
│ Holdings:                                                │
│   - "as of" + search + full-width table + pagination     │
└──────────────────────────────────────────────────────────┘
```

**Key decisions from R2 feedback:**
- **No sticky tabs** — avoids z-index war with Header. Tabs scroll with page.
- **No ReturnsTable** — descoped. We don't have 30D/YTD data endpoints. Show "Since Inception" as a single stat in Performance instead. Chart is the main content.
- **Fees from on-chain** — Read `getFeeRate(itpId)` via contract call, NOT hardcoded "0%". If fee is 0, display "0.00%" dynamically. Shows gas costs disclaimer.
- **BuyItpModal state** — Lives in `ItpPageClient` (`useState<boolean>`), passed to Hero and TradeCta.
- **Tab panels min-height** — `min-h-[400px]` prevents layout jump on tab switch.
- **Investment sub-nav hidden** — On `/itp/[itpId]` pages, hide the Investment sub-nav to avoid double nav bars.
- **Config schema updated** — Add `tabs` grouping to config (see below).

## Config Schema Update

```typescript
export interface ItpPageConfig {
  tabs: {
    overview: SectionId[]
    performance: SectionId[]
    keyFacts: SectionId[]
    holdings: SectionId[]
  }
  heroStyle?: 'dark' | 'brand' | 'white'
  label?: string           // Category label e.g. "CRYPTO INDEX"
  createdAt?: string       // ISO date
  investmentObjective?: {
    whyPoints: string[]    // "Why This Index?" bullet points
    objective: string      // Investment objective paragraph
  }
}

const CONFIGS = {
  'crypto-top-n': {
    tabs: {
      overview: ['investment-objective', 'breakdown', 'concentration', 'founders', 'defi-health', 'funding'],
      performance: ['performance'],
      keyFacts: ['fund-facts', 'portfolio-characteristics', 'fees'],
      holdings: ['holdings'],
    },
    heroStyle: 'dark',
    label: 'Crypto Index',
    createdAt: '2026-02-18',
    investmentObjective: {
      whyPoints: [
        'Broad crypto exposure: Track the top 100 cryptocurrencies by market capitalization in a single product',
        'Equal weight: Every asset gets 1% allocation, reducing concentration risk vs market-cap weighted indexes',
        'On-chain settlement: Fully transparent, verifiable holdings with BLS-verified consensus',
      ],
      objective: 'The Top 100 Crypto Index seeks to track the performance of a diversified basket of the 100 largest digital assets by market capitalization, equally weighted and rebalanced periodically.',
    },
  },
  // ... other configs
}
```

## Phase 1: Hero Section

**Location**: Inside `ItpPageClient.tsx` (client component — has modal state access)

```tsx
// In ItpPageClient:
const [buyModalOpen, setBuyModalOpen] = useState(false)

// Hero renders before TabNavigation
<HeroSection
  label={config.label}
  symbol={symbol}
  name={name}
  onBuy={() => setBuyModalOpen(true)}
/>
{buyModalOpen && <BuyItpModal itpId={itpId} onClose={() => setBuyModalOpen(false)} />}
```

Layout:
```
CRYPTO INDEX                              [Buy This Index]
[ITP1] Top 100 Crypto Index
```

- Category label: `text-xs font-semibold uppercase tracking-widest text-gray-500`
- Ticker badge: `bg-gray-900 text-white px-3 py-1.5 text-sm font-bold inline-block`
- Fund name: `text-3xl lg:text-4xl font-bold text-gray-900 ml-3 inline`
- BUY CTA: `bg-gray-900 text-white px-8 py-3 text-sm font-bold hover:bg-gray-800` — calls `onBuy()`
- **Mobile**: Stack vertically. CTA full-width below name. `flex flex-col lg:flex-row lg:items-center lg:justify-between`

Also renders a Sell button (secondary style) next to Buy on desktop, below on mobile.

## Phase 2: Stats Bar

**Rewrite: `sections/KeyStatsBar.tsx`**

```
NAV / Share          1 Day NAV Change       Total Value Locked    Holdings
as of Mar 13, 2026   as of Mar 13, 2026     as of Mar 13, 2026    as of Mar 13, 2026
$1.0291              ▲ +$0.0023 (+0.23%)    $10,450.00            100
```

- Container: `flex items-start divide-x divide-gray-200 py-6` (no outer border)
- Each stat: `px-6 first:pl-0`
- Label: `text-xs text-gray-500 mb-0.5`
- "as of" line: `text-[10px] text-gray-400`
- NAV value: `text-3xl font-bold tabular-nums`
- Other values: `text-xl font-bold tabular-nums`
- 1D change: `text-color-up` or `text-color-down` with ▲/▼ prefix

**Empty states:**
- `nav === 0`: `<div className="animate-pulse bg-gray-200 h-9 w-28 rounded" />`
- `aum === 0`: Show "—"
- `sinceInception`: `nav > 0 ? ((nav - 1) * 100) : null` — render null as "—"

**Mobile**: `grid grid-cols-2 gap-4` with `border-b border-gray-100 pb-4` per cell instead of divide-x

## Phase 3: Tab Navigation

**New: `TabNavigation.tsx`** — replaces `SectionRenderer.tsx`

```tsx
type TabId = 'overview' | 'performance' | 'key-facts' | 'holdings'
const TAB_LABELS: Record<TabId, string> = {
  overview: 'Overview',
  performance: 'Performance',
  'key-facts': 'Key Facts',
  holdings: 'Holdings',
}

function TabNavigation({ config, sectionProps }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  return (
    <>
      {/* Tab bar — NOT sticky, scrolls with page */}
      <div className="border-b border-gray-200 mb-8">
        <div className="flex gap-0 overflow-x-auto">
          {Object.entries(TAB_LABELS).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as TabId)}
              className={cn(
                'px-6 py-3 text-sm font-semibold whitespace-nowrap',
                activeTab === id
                  ? 'border-b-2 border-gray-900 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab panel — min height prevents layout jump */}
      <div className="min-h-[400px]">
        {config.tabs[activeTab].map(sectionId => {
          const Section = REGISTRY[sectionId]
          return Section ? <Section key={sectionId} {...sectionProps} /> : null
        })}
      </div>
    </>
  )
}
```

**Sections within panels separated by:** `<hr className="border-gray-200 my-8" />`

**Investment sub-nav**: On ITP detail pages, the Investment layout sub-nav (Markets/Portfolio/Create/etc.) should be hidden. Check if this is controlled by the page layout — if so, add a prop or use a different layout for ITP detail.

## Phase 4: Investment Objective

**New: `sections/InvestmentObjective.tsx`**

Reads `investmentObjective` from config (not hardcoded in component).

```
Why This Index?                    Investment Objective
─────────────────                  ────────────────────
1. Broad crypto exposure...        The Top 100 Crypto Index seeks...
2. Equal weight...
3. On-chain settlement...
```

- Desktop: `grid grid-cols-1 lg:grid-cols-2 gap-12`
- Headings: `text-xl font-bold text-gray-900 mb-4`
- Points: `<ol className="list-decimal list-inside space-y-4 text-sm text-gray-600 leading-relaxed">`
- Objective: `<p className="text-sm text-gray-600 leading-relaxed">`
- HR below: `<hr className="border-gray-200 my-8" />`
- If `config.investmentObjective` is undefined: Section doesn't render.

## Phase 5: Performance Chart

**Rewrite: `sections/PerformanceChart.tsx`**

- Keep existing AreaChart + timeframe toggles (1D/7D/90D — existing timeframes only, no 30D/ALL)
- Remove card border wrapper
- Add "as of" date: `<p className="text-xs text-gray-400 mb-2">as of {asOfToday()}</p>`
- Increase chart height: 300px
- Below chart: Single "Since Inception" stat:
  ```
  Since Inception Return: +2.91% (from Feb 18, 2026)
  ```
- Style: `text-lg font-bold` with color, inception date from `config.createdAt`

**NOT building a ReturnsTable** — descoped due to missing 30D/YTD data endpoints. Can be added later when data-node supports period returns.

## Phase 6: Holdings Table Enhancement

**Rewrite: `sections/HoldingsTable.tsx`**

- Add header: `<h2 className="text-2xl font-bold text-gray-900">Holdings</h2>` + `<p className="text-xs text-gray-400">as of {asOfToday()}</p>`
- Add search: `<input placeholder="Filter list by keyword..." className="border border-gray-300 rounded px-3 py-1.5 text-sm w-64" />`
  - Filter state: `useState('')`, debounce 200ms, searches `symbol` and `name`
  - Filtering resets pagination to page 1
- Remove card wrapper: table is full-width, `border-b border-gray-200` between rows
- Header row: `bg-gray-50 text-xs font-semibold uppercase text-gray-500`
- Default sort: Weight descending
- Pagination: `"1 to 20 of {total}"` + page number buttons

**Mobile**: Hide Market Cap column via `hidden lg:table-cell`. Keep Ticker, Weight, Price, 24h visible.

## Phase 7: Key Facts Expansion

**Rewrite: `sections/FundFacts.tsx`** as 2-column grid with horizontal rules

Desktop: `grid grid-cols-2 gap-x-16`
Each row: `flex justify-between py-3 border-b border-gray-100`
Label: `text-sm text-gray-600`
Value: `text-sm font-semibold text-gray-900 text-right`
Optional "as of": `text-[10px] text-gray-400` below label

LEFT:
- NAV / Share → $1.0291 (as of today)
- Chain → Index L3 (Orbit)
- Settlement Address → 0x7740...E937 [Copy]
- Rebalance Method → Equal Weight

RIGHT:
- Fund Inception → Feb 18, 2026
- Asset Class → Crypto Index
- ITP ID → 0x0000...0001 [Copy]
- Number of Holdings → 100

**Portfolio Characteristics sub-section:**
Same 2-column layout:
- Top 5 Concentration → 5.0%
- Top 10 Concentration → 10.0%
- HHI Index → 100 (Low)
- Average Market Cap → $12.4B (computed from enrichment)

**Fees sub-section:**
- Read fee from on-chain: `useReadContract({ functionName: 'getFeeRate', args: [itpId] })`
- Display dynamically: "Management Fee: {feeRate}%" (will be 0% for ITP #1)
- Add disclaimer: `<p className="text-[10px] text-gray-400 mt-2">Network gas costs apply to all transactions.</p>`
- If contract call fails: Show "Fee information unavailable"

## Phase 8: Section Restyling (Global)

**All section components — remove card styling:**
```diff
- className="bg-white border border-border-light rounded-lg p-4"
+ className="py-8"
```

The `py-8` replaces the visual spacing that card `p-4` padding provided. Sections are separated by `<hr>` elements in the tab panel renderer.

**Section headings:**
```diff
- className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-4"
+ className="text-2xl font-bold text-gray-900 mb-6"
```

**FounderDemographics chart containers:**
```diff
- className="bg-white border border-border-light rounded-lg p-4"
+ className="py-4"
```

**Donut chart colors:**
```typescript
const COLORS = [
  '#1a1a2e', '#e94560', '#0f3460', '#f97316', '#06b6d4',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6',
  '#94a3b8',  // "Other" — always muted gray
]
```
First 10 are high-contrast distinct hues. Last is neutral for "Other" bucket.

**Page background:**
`bg-page` is already `#FFFFFF` in Tailwind config — no change needed. But ensure no section uses `bg-surface` or other non-white backgrounds.

## Phase 9: Empty State Design

| Condition | Current | New |
|-----------|---------|-----|
| nav = 0 | Shows "$0.0000" | Pulse skeleton |
| aum = 0 | Shows "$0.00" | Shows "—" |
| assetCount = 0 | Shows "0" | Shows "—" |
| sinceInception (nav=0) | Shows "-100.00%" | Shows "—" |
| Holdings empty | Shows empty table | "Holdings data loading..." |
| Performance no data | Shows "Loading chart..." | "Performance data not yet available" gray box |
| Founders/DeFi/Funding null | Section hidden | Same (correct) |

Guard:
```typescript
const sinceInception = nav > 0 ? (nav - 1) * 100 : null
```

## Implementation Order

1. **Phase 8** — Global restyling (card borders, headings, colors, spacing)
2. **Phase 9** — Empty states (skeleton, "—", guards)
3. **Phase 1** — Hero section + BuyItpModal wiring in ItpPageClient
4. **Phase 2** — Stats bar rewrite (horizontal, "as of", skeletons)
5. **Phase 3** — Tab navigation (replace SectionRenderer, new config schema)
6. **Phase 4** — Investment Objective (new section, config-driven content)
7. **Phase 5** — Performance chart (restyled, since inception stat)
8. **Phase 6** — Holdings table (search, "as of", pagination style)
9. **Phase 7** — Key Facts (2-col, portfolio characteristics, on-chain fees)
