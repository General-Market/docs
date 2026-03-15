# ITP Fund Page (BlackRock-Style) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal ITP detail page with a rich BlackRock/iShares-inspired fund page enriched with founder demographics, DeFi metrics, and funding data.

**Architecture:** Config-driven section renderer. Each ITP type (crypto-top-n, defi-sector, etc.) declares which sections appear and in what order via a config file. A section registry maps section IDs to React components. The client wrapper iterates the config array and renders matching components — no switch statements, no conditionals per type. Server component fetches ITP detail + enrichment data (ISR 60s). Enrichment joins holdings → coin-map.json → crypto_founders_complete.json + DeFiLlama via an API route.

**Tech Stack:** Next.js 15 (App Router), Recharts (BarChart, PieChart, AreaChart), Tailwind CSS, existing hooks (useItpNav, useItpNavSeries, useItpMetadata)

**Spec:** `docs/superpowers/specs/2026-03-12-itp-fund-page-design.md`

---

## File Structure

```
frontend/
├── app/[locale]/itp/[itpId]/
│   └── page.tsx                              — MODIFY: server shell with enrichment fetch
├── app/api/itp-enrichment/
│   └── route.ts                              — CREATE: enrichment API (joins holdings → founders/defi)
├── lib/
│   ├── itp-enrichment-types.ts               — CREATE: shared TypeScript types for enrichment data
│   └── itp-page-config.ts                    — CREATE: section registry + ITP type configs
├── components/domain/itp-page/
│   ├── ItpPageClient.tsx                     — CREATE: config-driven section renderer
│   ├── sections/
│   │   ├── KeyStatsBar.tsx                   — CREATE: 4 stat cards
│   │   ├── PerformanceChart.tsx              — CREATE: NAV line chart with timeframe tabs
│   │   ├── HoldingsTable.tsx                 — CREATE: sortable, paginated holdings table
│   │   ├── PortfolioBreakdown.tsx            — CREATE: donut chart (top 10 + Other)
│   │   ├── ConcentrationMetrics.tsx          — CREATE: 3 concentration stat cards
│   │   ├── FounderDemographics.tsx           — CREATE: 4 horizontal bar charts
│   │   ├── DefiHealth.tsx                    — CREATE: aggregate TVL cards + table
│   │   ├── FundingOverview.tsx               — CREATE: raises + investor chart
│   │   ├── FundFacts.tsx                     — CREATE: key details grid
│   │   └── TradeCta.tsx                      — CREATE: Buy/Sell action section
│   └── SectionRenderer.tsx                   — CREATE: maps config → components
```

### Config-Driven Architecture

```
┌─────────────────────────────────────────────┐
│  itp-page-config.ts                         │
│                                             │
│  SECTION_REGISTRY = {                       │
│    'key-stats':    KeyStatsBar,             │
│    'performance':  PerformanceChart,        │
│    'holdings':     HoldingsTable,           │
│    ...                                      │
│  }                                          │
│                                             │
│  ITP_PAGE_CONFIGS = {                       │
│    'crypto-top-n': {                        │
│      sections: ['key-stats', 'performance', │
│        'holdings', 'breakdown', ...         │
│        'founders', 'defi-health', 'funding']│
│    },                                       │
│    'default': {                             │
│      sections: ['key-stats', 'performance', │
│        'holdings', 'breakdown',             │
│        'concentration', 'fund-facts', 'cta']│
│    },                                       │
│  }                                          │
│                                             │
│  getItpPageType(itpId) → config key         │
│                                             │
└─────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│  SectionRenderer.tsx                        │
│                                             │
│  config.sections.map(id => {               │
│    const Section = SECTION_REGISTRY[id]     │
│    if (!Section) return null                │
│    // Section self-gates on data presence   │
│    return <Section {...sectionProps} />      │
│  })                                         │
└─────────────────────────────────────────────┘
```

**Key principle:** Each section component receives the full props bag and decides internally whether to render or return null (e.g., FounderDemographics returns null if `enrichment.founders` is undefined). The config controls *which* sections are offered — the component controls *whether* it renders.

---

## Chunk 1: Data Layer (API Route + Types + Server Fetch)

### Task 1: Enrichment Types

**Files:**
- Create: `frontend/lib/itp-enrichment-types.ts`

- [ ] **Step 1: Create shared types file**

```typescript
// Types shared between API route, server fetch, and client components

export interface CoinMapEntry {
  id: string    // coingecko_id
  image: string // CoinGecko CDN URL
}

export interface FounderInfo {
  name: string
  role: string
  age_value?: number
  age_status?: string
  gender: string
  nationality: string
  university?: string
  linkedin?: string
}

export interface CompanyFounderData {
  name: string
  coingecko_id?: string
  launch_year?: number
  protocol_age_years?: number
  ath_price?: number
  ath_date?: string
  ath_drawdown_pct?: number
  current_market_cap?: number
  founders: FounderInfo[]
}

export interface EnrichedHolding {
  symbol: string
  name: string
  weight: number
  price: number
  image?: string         // CoinGecko logo URL
  coingecko_id?: string
  market_cap?: number
  // DeFi enrichment (optional)
  tvl?: number
  tvl_change_1d?: number
  tvl_change_7d?: number
  defi_category?: string
  // Funding enrichment (optional)
  raises?: {
    round: string
    amount_m: number
    valuation_m?: number
    date?: string
    lead_investors: string[]
  }[]
}

export interface FounderAggregates {
  total_founders: number
  total_companies_matched: number
  age_distribution: { bucket: string; count: number }[]
  gender_split: { label: string; count: number }[]
  top_nationalities: { label: string; count: number }[]
  top_universities: { label: string; count: number }[]
}

export interface DefiAggregates {
  total_tvl: number
  avg_tvl_change_7d: number
  protocols_with_data: number
  total_holdings: number
  top_by_tvl: { symbol: string; name: string; tvl: number; change_1d?: number; change_7d?: number }[]
}

export interface FundingAggregates {
  total_raised_m: number
  avg_valuation_m: number
  total_rounds: number
  top_investors: { name: string; count: number }[]
  recent_raises: { project: string; round: string; amount_m: number; lead: string; date?: string }[]
}

export interface ItpEnrichment {
  itpId: string
  holdings: EnrichedHolding[]
  founders?: FounderAggregates
  defi?: DefiAggregates
  funding?: FundingAggregates
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/itp-enrichment-types.ts
git commit -m "feat(itp-page): add shared enrichment types"
```

### Task 1b: Page Config + Section Registry

**Files:**
- Create: `frontend/lib/itp-page-config.ts`

- [ ] **Step 1: Create config file**

```typescript
// Section IDs — each maps to one React component
export type SectionId =
  | 'key-stats'
  | 'performance'
  | 'holdings'
  | 'breakdown'
  | 'concentration'
  | 'founders'
  | 'defi-health'
  | 'funding'
  | 'fund-facts'
  | 'trade-cta'

export interface ItpPageConfig {
  sections: SectionId[]
  heroStyle?: 'dark' | 'brand' | 'white'   // header accent — default 'dark'
  label?: string                             // e.g. "Crypto Index" badge text
}

// ─── ITP type configs ────────────────────────────
// Each key is a page type. Sections render top-to-bottom in array order.
// Components self-gate: if data is missing, they return null.

const CONFIGS = {
  'crypto-top-n': {
    sections: [
      'key-stats', 'performance', 'holdings', 'breakdown', 'concentration',
      'founders', 'defi-health', 'funding', 'fund-facts', 'trade-cta',
    ],
    heroStyle: 'dark',
    label: 'Crypto Index',
  },

  'defi-sector': {
    sections: [
      'key-stats', 'performance', 'holdings', 'breakdown',
      'defi-health', 'fund-facts', 'trade-cta',
    ],
    heroStyle: 'brand',
    label: 'DeFi Index',
  },

  'default': {
    sections: [
      'key-stats', 'performance', 'holdings', 'breakdown',
      'concentration', 'fund-facts', 'trade-cta',
    ],
    heroStyle: 'white',
  },
} as const satisfies Record<string, ItpPageConfig>

export type ItpPageType = keyof typeof CONFIGS

// ─── ITP ID → page type mapping ─────────────────
// Hardcoded for now. Later: read from on-chain metadata.
const ITP_TYPE_MAP: Record<string, ItpPageType> = {
  '0x0000000000000000000000000000000000000000000000000000000000000001': 'crypto-top-n',
  // Add new ITPs here as they're deployed:
  // '0x...0002': 'defi-sector',
}

export function getItpPageConfig(itpId: string): ItpPageConfig {
  const pageType = ITP_TYPE_MAP[itpId.toLowerCase()] ?? 'default'
  return CONFIGS[pageType]
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/itp-page-config.ts
git commit -m "feat(itp-page): add config-driven section registry"
```

### Task 1c: Section Renderer

**Files:**
- Create: `frontend/components/domain/itp-page/SectionRenderer.tsx`

- [ ] **Step 1: Create SectionRenderer**

This is the glue. It imports all section components lazily, maps SectionId → component, and renders the config array.

```typescript
'use client'

import type { SectionId, ItpPageConfig } from '@/lib/itp-page-config'
import type { ItpEnrichment } from '@/lib/itp-enrichment-types'
import { KeyStatsBar } from './sections/KeyStatsBar'
import { PerformanceChart } from './sections/PerformanceChart'
import { HoldingsTable } from './sections/HoldingsTable'
import { PortfolioBreakdown } from './sections/PortfolioBreakdown'
import { ConcentrationMetrics } from './sections/ConcentrationMetrics'
import { FounderDemographics } from './sections/FounderDemographics'
import { DefiHealth } from './sections/DefiHealth'
import { FundingOverview } from './sections/FundingOverview'
import { FundFacts } from './sections/FundFacts'
import { TradeCta } from './sections/TradeCta'

// Every section receives the same props bag. Each decides what it needs.
export interface SectionProps {
  itpId: string
  name: string
  symbol: string
  nav: number
  aum: number
  assetCount: number
  sinceInception: number
  enrichment: ItpEnrichment | null
}

// Registry: SectionId → component
const REGISTRY: Record<SectionId, React.ComponentType<SectionProps>> = {
  'key-stats':      KeyStatsBar,
  'performance':    PerformanceChart,
  'holdings':       HoldingsTable,
  'breakdown':      PortfolioBreakdown,
  'concentration':  ConcentrationMetrics,
  'founders':       FounderDemographics,
  'defi-health':    DefiHealth,
  'funding':        FundingOverview,
  'fund-facts':     FundFacts,
  'trade-cta':      TradeCta,
}

interface Props {
  config: ItpPageConfig
  sectionProps: SectionProps
}

export function SectionRenderer({ config, sectionProps }: Props) {
  return (
    <div className="space-y-8">
      {config.sections.map(id => {
        const Section = REGISTRY[id]
        if (!Section) return null
        return <Section key={id} {...sectionProps} />
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/domain/itp-page/SectionRenderer.tsx
git commit -m "feat(itp-page): add config-driven SectionRenderer"
```

### Task 1d: Build-Time Founders Preprocessing

**Files:**
- Create: `frontend/scripts/build-founders-lookup.ts`
- Create: `frontend/data/founders-lookup.json` (generated, gitignored)

The raw founders JSON is 7MB with LinkedIn URLs, full bios, podcast evidence etc. We only need 4 fields per founder for the ITP page. This script runs at build time and produces a ~200KB lookup.

- [ ] **Step 1: Create build script**

```typescript
// scripts/build-founders-lookup.ts
// Run: npx tsx scripts/build-founders-lookup.ts
// Output: data/founders-lookup.json

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const SOURCE = path.join(__dirname, '../../_bmad-output/youtube/video/top100cryptoage/crypto_founders_complete.json')
const OUTPUT = path.join(__dirname, '../data/founders-lookup.json')

const raw = JSON.parse(readFileSync(SOURCE, 'utf-8'))
const lookup: Record<string, { age?: number; gender: string; nationality: string; university?: string }[]> = {}

for (const company of raw.companies || []) {
  if (!company.coingecko_id || !company.founders?.length) continue
  lookup[company.coingecko_id] = company.founders.map((f: any) => ({
    age: f.age_value || undefined,
    gender: f.gender || 'unknown',
    nationality: f.nationality || 'Unknown',
    university: f.university || undefined,
  }))
}

mkdirSync(path.dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, JSON.stringify(lookup))
console.log(`Wrote ${Object.keys(lookup).length} entries to ${OUTPUT}`)
```

- [ ] **Step 2: Add to build pipeline**

Add to `frontend/package.json` scripts:
```json
"prebuild": "npx tsx scripts/build-founders-lookup.ts"
```

- [ ] **Step 3: Add data/ to .gitignore** (generated file, not source)

- [ ] **Step 4: Run and verify**

```bash
cd frontend && npx tsx scripts/build-founders-lookup.ts
ls -la data/founders-lookup.json  # Should be ~200KB, not 7MB
```

- [ ] **Step 5: Commit**

```bash
git add frontend/scripts/build-founders-lookup.ts frontend/package.json
git commit -m "feat(itp-page): add build-time founders preprocessing (7MB → 200KB)"
```

### Task 2: Enrichment API Route

**Files:**
- Create: `frontend/app/api/itp-enrichment/route.ts`

This route joins ITP holdings with coin-map.json, pre-processed founders lookup, and DeFiLlama data. All heavy data is process-cached with TTL.

- [ ] **Step 0: Validate itp_id format**

Every use of `itp_id` in the route MUST pass this validation first:

```typescript
const ITP_ID_RE = /^0x[0-9a-fA-F]{64}$/
```

- [ ] **Step 1: Create API route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { AA_DATA_NODE_URL } from '@/lib/config'
import type {
  CoinMapEntry,
  EnrichedHolding,
  FounderAggregates,
  DefiAggregates,
  FundingAggregates,
  ItpEnrichment,
} from '@/lib/itp-enrichment-types'

// Strict itp_id validation — prevents SSRF and query injection
const ITP_ID_RE = /^0x[0-9a-fA-F]{64}$/

// ─── Process-level caches (survive across requests within same lambda) ───
let coinMapCache: Record<string, CoinMapEntry> | null = null
let foundersLookupCache: Record<string, { age?: number; gender: string; nationality: string; university?: string }[]> | null = null

// DeFiLlama caches with TTL (5 min)
let defiProtocolsCache: { data: any[]; ts: number } | null = null
let defiRaisesCache: { data: any[]; ts: number } | null = null
const DEFI_CACHE_TTL = 5 * 60 * 1000

async function loadCoinMap(): Promise<Record<string, CoinMapEntry>> {
  if (coinMapCache) return coinMapCache
  const raw = await fs.readFile(path.join(process.cwd(), 'public/coin-map.json'), 'utf-8')
  coinMapCache = JSON.parse(raw)
  return coinMapCache!
}

// Loads pre-processed founders lookup (built at build time by scripts/build-founders-lookup.ts)
// ~200KB instead of 7MB — only coingecko_id → [{ age, gender, nationality, university }]
async function loadFoundersLookup(): Promise<typeof foundersLookupCache> {
  if (foundersLookupCache) return foundersLookupCache
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'data/founders-lookup.json'), 'utf-8')
    foundersLookupCache = JSON.parse(raw)
  } catch {
    foundersLookupCache = {} // File missing — degrade gracefully, no founders section
  }
  return foundersLookupCache!
}

function buildFounderAggregates(
  holdings: { symbol: string; coingecko_id?: string }[],
  lookup: Record<string, { age?: number; gender: string; nationality: string; university?: string }[]>
): FounderAggregates | undefined {
  const matchedFounders: { age?: number; gender: string; nationality: string; university?: string }[] = []
  let companiesMatched = 0

  for (const h of holdings) {
    if (!h.coingecko_id) continue
    const founders = lookup[h.coingecko_id]
    if (!founders?.length) continue
    companiesMatched++
    matchedFounders.push(...founders)
  }

  if (matchedFounders.length === 0) return undefined

  // Age distribution
  const ageBuckets: Record<string, number> = { '20-29': 0, '30-39': 0, '40-49': 0, '50-59': 0, '60+': 0 }
  for (const f of matchedFounders) {
    if (!f.age) continue
    if (f.age < 30) ageBuckets['20-29']++
    else if (f.age < 40) ageBuckets['30-39']++
    else if (f.age < 50) ageBuckets['40-49']++
    else if (f.age < 60) ageBuckets['50-59']++
    else ageBuckets['60+']++
  }

  // Gender
  const genderMap: Record<string, number> = {}
  for (const f of matchedFounders) {
    const g = f.gender === 'male' ? 'Male' : f.gender === 'female' ? 'Female' : 'Unknown'
    genderMap[g] = (genderMap[g] || 0) + 1
  }

  // Nationalities
  const natMap: Record<string, number> = {}
  for (const f of matchedFounders) {
    if (f.nationality && f.nationality !== 'Unknown') {
      natMap[f.nationality] = (natMap[f.nationality] || 0) + 1
    }
  }

  // Universities
  const uniMap: Record<string, number> = {}
  for (const f of matchedFounders) {
    if (f.university) {
      uniMap[f.university] = (uniMap[f.university] || 0) + 1
    }
  }

  const sortDesc = (m: Record<string, number>) =>
    Object.entries(m)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)

  return {
    total_founders: matchedFounders.length,
    total_companies_matched: companiesMatched,
    age_distribution: Object.entries(ageBuckets).map(([bucket, count]) => ({ bucket, count })),
    gender_split: sortDesc(genderMap),
    top_nationalities: sortDesc(natMap).slice(0, 12),
    top_universities: sortDesc(uniMap).slice(0, 10),
  }
}

async function fetchDefiProtocolsCached(): Promise<any[]> {
  if (defiProtocolsCache && Date.now() - defiProtocolsCache.ts < DEFI_CACHE_TTL) {
    return defiProtocolsCache.data
  }
  const res = await fetch(`${AA_DATA_NODE_URL}/defillama/protocols`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) return []
  const data = await res.json()
  defiProtocolsCache = { data, ts: Date.now() }
  return data
}

async function fetchDefiData(
  holdings: { symbol: string; coingecko_id?: string }[]
): Promise<DefiAggregates | undefined> {
  try {
    const protocols = await fetchDefiProtocolsCached()

    // Build lookup by gecko_id
    const protoLookup = new Map<string, any>()
    for (const p of protocols) {
      if (p.gecko_id) protoLookup.set(p.gecko_id, p)
    }

    const matched: { symbol: string; name: string; tvl: number; change_1d?: number; change_7d?: number }[] = []
    for (const h of holdings) {
      if (!h.coingecko_id) continue
      const proto = protoLookup.get(h.coingecko_id)
      if (!proto?.tvl) continue
      matched.push({
        symbol: h.symbol,
        name: proto.name || h.symbol,
        tvl: proto.tvl,
        change_1d: proto.change_1d ?? proto.tvl_change_1d,
        change_7d: proto.change_7d ?? proto.tvl_change_7d,
      })
    }

    if (matched.length === 0) return undefined

    const totalTvl = matched.reduce((s, m) => s + m.tvl, 0)
    const avgChange7d = matched.reduce((s, m) => s + (m.change_7d || 0), 0) / matched.length

    return {
      total_tvl: totalTvl,
      avg_tvl_change_7d: avgChange7d,
      protocols_with_data: matched.length,
      total_holdings: holdings.length,
      top_by_tvl: matched.sort((a, b) => b.tvl - a.tvl).slice(0, 10),
    }
  } catch {
    return undefined
  }
}

async function fetchRaisesCached(): Promise<any[]> {
  if (defiRaisesCache && Date.now() - defiRaisesCache.ts < DEFI_CACHE_TTL) {
    return defiRaisesCache.data
  }
  const res = await fetch(`${AA_DATA_NODE_URL}/defillama/raises`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) return []
  const data = await res.json()
  defiRaisesCache = { data, ts: Date.now() }
  return data
}

async function fetchFundingData(
  holdings: { symbol: string; coingecko_id?: string }[]
): Promise<FundingAggregates | undefined> {
  try {
    const raises = await fetchRaisesCached()

    // Match raises by name (defillama_id or name match)
    // Build a set of coingecko_ids from holdings
    const cgIds = new Set(holdings.map(h => h.coingecko_id).filter(Boolean))

    // Also try matching by name
    const holdingNames = new Set(holdings.map(h => h.symbol.toLowerCase()))

    const matchedRaises: any[] = []
    for (const r of raises) {
      const rid = r.defillama_id?.toLowerCase()
      const rname = r.name?.toLowerCase()
      if ((rid && cgIds.has(rid)) || (rname && holdingNames.has(rname))) {
        matchedRaises.push(r)
      }
    }

    if (matchedRaises.length === 0) return undefined

    const totalRaised = matchedRaises.reduce((s, r) => s + (r.amount_m || r.amount || 0), 0)
    const withValuation = matchedRaises.filter(r => r.valuation_m || r.valuation)
    const avgVal = withValuation.length > 0
      ? withValuation.reduce((s, r) => s + (r.valuation_m || r.valuation || 0), 0) / withValuation.length
      : 0

    // Top investors
    const investorCount: Record<string, number> = {}
    for (const r of matchedRaises) {
      for (const inv of (r.lead_investors || [])) {
        investorCount[inv] = (investorCount[inv] || 0) + 1
      }
    }

    return {
      total_raised_m: totalRaised,
      avg_valuation_m: avgVal,
      total_rounds: matchedRaises.length,
      top_investors: Object.entries(investorCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      recent_raises: matchedRaises
        .sort((a, b) => (b.date || 0) - (a.date || 0))
        .slice(0, 10)
        .map(r => ({
          project: r.name || '',
          round: r.round || '',
          amount_m: r.amount_m || r.amount || 0,
          lead: (r.lead_investors || [])[0] || '—',
          date: r.date ? new Date(r.date * 1000).toISOString().slice(0, 10) : undefined,
        })),
    }
  } catch {
    return undefined
  }
}

export async function GET(request: NextRequest) {
  const itpId = request.nextUrl.searchParams.get('itp_id')

  // ── SECURITY: strict input validation ──
  if (!itpId || !ITP_ID_RE.test(itpId)) {
    return NextResponse.json({ error: 'Invalid itp_id' }, { status: 400 })
  }

  try {
    // Fetch holdings from data-node (itp_id is validated hex, still encode for safety)
    const snapshotRes = await fetch(
      `${AA_DATA_NODE_URL}/snapshot?itp_id=${encodeURIComponent(itpId)}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!snapshotRes.ok) {
      return NextResponse.json({ error: 'ITP not found' }, { status: 404 })
    }
    const snapshot = await snapshotRes.json()
    const rawHoldings: { symbol: string; weight: number; price: number; name?: string }[] =
      (snapshot.assets || []).map((a: any) => ({
        symbol: a.symbol || '',
        weight: a.weight || 0,
        price: a.price || 0,
        name: a.name || a.symbol || '',
      }))

    // Load enrichment data in parallel (all process-cached)
    const [coinMap, foundersLookup] = await Promise.all([
      loadCoinMap(),
      loadFoundersLookup(),
    ])

    // Enrich holdings with logos + coingecko_ids
    const enrichedHoldings: EnrichedHolding[] = rawHoldings.map(h => {
      const coin = coinMap[h.symbol]
      return {
        ...h,
        image: coin?.image,
        coingecko_id: coin?.id,
      }
    })

    // Build aggregates in parallel (defi/funding fetches are also process-cached with TTL)
    const [founderAgg, defiAgg, fundingAgg] = await Promise.all([
      Promise.resolve(buildFounderAggregates(enrichedHoldings, foundersLookup || {})),
      fetchDefiData(enrichedHoldings),
      fetchFundingData(enrichedHoldings),
    ])

    const result: ItpEnrichment = {
      itpId,
      holdings: enrichedHoldings,
      founders: founderAgg,
      defi: defiAgg,
      funding: fundingAgg,
    }

    // Only cache full responses; degraded responses get short TTL
    const hasMeaningfulData = enrichedHoldings.length > 0
    const cacheHeader = hasMeaningfulData
      ? 'public, s-maxage=300, stale-while-revalidate=60'
      : 'private, no-cache'

    return NextResponse.json(result, {
      headers: { 'Cache-Control': cacheHeader },
    })
  } catch (err) {
    // SECURITY: never leak err.message (contains internal IPs, file paths)
    console.error('[itp-enrichment]', err)
    return NextResponse.json({ error: 'Enrichment unavailable' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/api/itp-enrichment/route.ts
git commit -m "feat(itp-page): add enrichment API route (founders, defi, funding)"
```

---

## Chunk 2: Page Shell + Client Wrapper + Key Stats

### Task 3: Client Wrapper Component

**Files:**
- Create: `frontend/components/domain/itp-page/ItpPageClient.tsx`

Thin wrapper: resolves live hooks, builds the props bag, delegates to SectionRenderer.

- [ ] **Step 1: Create ItpPageClient**

```typescript
'use client'

import { useItpNav } from '@/hooks/useItpNav'
import { useItpMetadata } from '@/hooks/useItpMetadata'
import { getItpPageConfig } from '@/lib/itp-page-config'
import { SectionRenderer } from './SectionRenderer'
import type { ItpEnrichment } from '@/lib/itp-enrichment-types'

interface Props {
  itpId: string
  name: string
  symbol: string
  nav: number
  aum: number
  assetCount: number
  enrichment: ItpEnrichment | null
}

export function ItpPageClient({ itpId, name, symbol, nav: serverNav, aum: serverAum, assetCount, enrichment }: Props) {
  const { navPerShare } = useItpNav(itpId)
  const { metadata } = useItpMetadata(itpId as `0x${string}`)

  const nav = navPerShare > 0 ? navPerShare : serverNav
  const sinceInception = ((nav - 1) / 1) * 100

  const config = getItpPageConfig(itpId)

  return (
    <>
      {metadata?.description && (
        <p className="text-sm text-text-secondary leading-relaxed max-w-2xl mb-8">
          {metadata.description}
        </p>
      )}
      <SectionRenderer
        config={config}
        sectionProps={{ itpId, name, symbol, nav, aum: serverAum, assetCount, sinceInception, enrichment }}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/domain/itp-page/ItpPageClient.tsx
git commit -m "feat(itp-page): add client wrapper component"
```

### Task 4: Key Stats Bar

**Files:**
- Create: `frontend/components/domain/itp-page/KeyStatsBar.tsx`

- [ ] **Step 1: Create KeyStatsBar**

4 horizontal stat cards in BlackRock style: NAV/Share, TVL, Assets, Since Inception.

```typescript
interface Props {
  nav: number
  aum: number
  assetCount: number
  sinceInception: number
}

export function KeyStatsBar({ nav, aum, assetCount, sinceInception }: Props) {
  const formatUsd = (v: number) => v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000
    ? `$${(v / 1_000).toFixed(1)}K`
    : `$${v.toFixed(2)}`

  const stats = [
    { label: 'NAV / SHARE', value: `$${nav.toFixed(4)}` },
    { label: 'TOTAL VALUE LOCKED', value: formatUsd(aum) },
    { label: 'HOLDINGS', value: `${assetCount}` },
    {
      label: 'SINCE INCEPTION',
      value: `${sinceInception >= 0 ? '+' : ''}${sinceInception.toFixed(2)}%`,
      color: sinceInception >= 0 ? 'text-color-up' : 'text-color-down',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border-light border border-border-light rounded-lg overflow-hidden">
      {stats.map((s) => (
        <div key={s.label} className="bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">
            {s.label}
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums ${s.color || 'text-text-primary'}`}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/domain/itp-page/sections/KeyStatsBar.tsx
git commit -m "feat(itp-page): add KeyStatsBar component"
```

### Task 5: Update Server Page Shell

**Files:**
- Modify: `frontend/app/[locale]/itp/[itpId]/page.tsx`

Replace the current minimal page body with the server shell that fetches enrichment data and renders ItpPageClient.

- [ ] **Step 1: Rewrite page.tsx**

Keep existing `generateMetadata` and `generateStaticParams`. Replace `ItpPage` body to:
1. Fetch enrichment data from internal API route
2. Render breadcrumbs + header (server)
3. Render `<ItpPageClient>` (client) with all data passed as props

The enrichment fetch uses `fetch()` with the internal URL to hit the API route server-side. Use `AA_DATA_NODE_URL` or the relative `/api/itp-enrichment` path.

Key: Keep breadcrumbs, JSON-LD, and `<header>` as server-rendered. Pass all data to client component.

**SECURITY FIX (JSON-LD XSS):** The existing `dangerouslySetInnerHTML` for JSON-LD is vulnerable to `</script>` injection via data-node values. When writing the JSON-LD block, escape all `<` characters:

```typescript
dangerouslySetInnerHTML={{
  __html: JSON.stringify(jsonLdData).replace(/</g, '\\u003c'),
}}
```

Apply this to both the existing JSON-LD and the BreadcrumbJsonLd component.

- [ ] **Step 2: Commit**

```bash
git add frontend/app/[locale]/itp/[itpId]/page.tsx
git commit -m "feat(itp-page): rewrite page shell with enrichment fetch + client wrapper"
```

---

## Chunk 3: Performance Chart + Holdings Table

### Task 6: Performance Chart

**Files:**
- Create: `frontend/components/domain/itp-page/PerformanceChart.tsx`

NAV line chart with timeframe tabs (1D, 7D, 90D). Uses `useItpNavSeries` hook and Recharts AreaChart.

- [ ] **Step 1: Create PerformanceChart**

Pattern reference: `frontend/components/domain/ChartModal.tsx` uses the same hook but with lightweight-charts. Here we use Recharts (already used in PortfolioSection for the value chart).

```
- Timeframe tabs: 1D (interval='5m'), 7D (interval='1h'), 90D (interval='1d')
- AreaChart with gradient fill
- Tooltip showing date + NAV value
- Responsive container
- Loading skeleton while fetching
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/domain/itp-page/sections/PerformanceChart.tsx
git commit -m "feat(itp-page): add PerformanceChart component"
```

### Task 7: Holdings Table

**Files:**
- Create: `frontend/components/domain/itp-page/HoldingsTable.tsx`

Sortable, paginated table. Columns: #, Logo, Symbol, Weight%, Price, Market Cap.

- [ ] **Step 1: Create HoldingsTable**

```
- 20 rows per page
- Click column header to sort (symbol asc, weight desc, price desc, market cap desc)
- Token logo from EnrichedHolding.image (32x32, rounded)
- Fallback: gray circle with symbol initial if no image
- Pagination controls: prev/next + "Page X of Y"
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/domain/itp-page/sections/HoldingsTable.tsx
git commit -m "feat(itp-page): add HoldingsTable component"
```

---

## Chunk 4: Portfolio Breakdown + Concentration

### Task 8: Portfolio Breakdown (Donut Chart)

**Files:**
- Create: `frontend/components/domain/itp-page/PortfolioBreakdown.tsx`

- [ ] **Step 1: Create PortfolioBreakdown**

```
- Recharts PieChart (donut via innerRadius)
- Top 10 holdings by weight + "Other" slice (sum of remaining)
- Color palette: 10 distinct colors from institutional palette
- Legend alongside: symbol + weight%
- Section header: "PORTFOLIO COMPOSITION"
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/domain/itp-page/sections/PortfolioBreakdown.tsx
git commit -m "feat(itp-page): add PortfolioBreakdown donut chart"
```

### Task 9: Concentration Metrics

**Files:**
- Create: `frontend/components/domain/itp-page/ConcentrationMetrics.tsx`

- [ ] **Step 1: Create ConcentrationMetrics**

3 stat cards:
- Top 5 Weight: sum of top 5 holdings weights
- Top 10 Weight: sum of top 10 holdings weights
- HHI: sum of (weight_i * 100)^2 for all holdings. Scale: 0 (perfectly diverse) to 10000 (single holding). Show as score with label (Low/Medium/High concentration).

```
- Sort holdings by weight descending
- top5 = sum of first 5 weights * 100
- top10 = sum of first 10 weights * 100
- HHI = sum of (w_i * 100)^2
- HHI < 1500 = "Low", 1500-2500 = "Moderate", > 2500 = "High"
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/domain/itp-page/sections/ConcentrationMetrics.tsx
git commit -m "feat(itp-page): add ConcentrationMetrics component"
```

---

## Chunk 5: Founder Demographics (Bar Charts)

### Task 10: Founder Demographics

**Files:**
- Create: `frontend/components/domain/itp-page/FounderDemographics.tsx`

- [ ] **Step 1: Create FounderDemographics**

4 horizontal bar charts in a 2x2 grid using Recharts BarChart:

1. **Age Distribution**: X = count, Y = age bucket (20-29, 30-39, etc.). Horizontal bars.
2. **Gender Split**: X = count, Y = Male/Female/Unknown. Horizontal bars.
3. **Top Nationalities**: X = count, Y = country name (top 12). Horizontal bars.
4. **Top Universities**: X = count, Y = university name (top 10). Horizontal bars.

Section header: "FOUNDER INTELLIGENCE"
Subtitle: "Based on {N} founders across {M} portfolio companies"

```
- Recharts BarChart with layout="vertical"
- XAxis type="number", YAxis type="category" dataKey="label" or "bucket"
- Bar fill: brand color (#00A36C)
- Responsive: 2 cols on desktop, 1 col on mobile
- Each chart in a card with border
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/domain/itp-page/sections/FounderDemographics.tsx
git commit -m "feat(itp-page): add FounderDemographics bar charts"
```

---

## Chunk 6: DeFi Health + Funding Overview

### Task 11: DeFi Health

**Files:**
- Create: `frontend/components/domain/itp-page/DefiHealth.tsx`

- [ ] **Step 1: Create DefiHealth**

Section header: "DEFI PROTOCOL HEALTH"

3 stat cards:
- Aggregate TVL (formatted with $M/$B)
- Avg TVL Change 7D (green/red %)
- Coverage: "{N} of {M} holdings have TVL data"

Table below: Top 10 by TVL with columns: Protocol, TVL, 1D Change, 7D Change.

- [ ] **Step 2: Commit**

```bash
git add frontend/components/domain/itp-page/sections/DefiHealth.tsx
git commit -m "feat(itp-page): add DefiHealth component"
```

### Task 12: Funding Overview

**Files:**
- Create: `frontend/components/domain/itp-page/FundingOverview.tsx`

- [ ] **Step 1: Create FundingOverview**

Section header: "FUNDING INTELLIGENCE"

3 stat cards:
- Total Raised ($M)
- Avg Valuation ($M)
- Total Rounds

Horizontal bar chart: Top 10 investors by frequency across portfolio.
Table: Recent raises (project, round, amount, lead investor, date).

- [ ] **Step 2: Commit**

```bash
git add frontend/components/domain/itp-page/sections/FundingOverview.tsx
git commit -m "feat(itp-page): add FundingOverview component"
```

---

## Chunk 7: Fund Facts + Trade CTA + Final Integration

### Task 13: Fund Facts

**Files:**
- Create: `frontend/components/domain/itp-page/FundFacts.tsx`

- [ ] **Step 1: Create FundFacts**

Section header: "FUND FACTS"

Grid of key-value pairs:
- Symbol
- Chain: Index L3 (Orbit)
- ITP ID (truncated, copy-to-clipboard button)
- Settlement info link

Copy button: `navigator.clipboard.writeText()` with brief "Copied!" feedback.

- [ ] **Step 2: Commit**

```bash
git add frontend/components/domain/itp-page/sections/FundFacts.tsx
git commit -m "feat(itp-page): add FundFacts component"
```

### Task 14: Trade CTA

**Files:**
- Create: `frontend/components/domain/itp-page/TradeCta.tsx`

- [ ] **Step 1: Create TradeCta**

Two buttons side by side:
- "Buy this Index" → links to `/#markets` with `#itp-card-{itpId}` anchor
- "Learn about ITPs" → links to `/learn/what-are-itps`

BlackRock style: primary = black bg white text, secondary = bordered.

- [ ] **Step 2: Commit**

```bash
git add frontend/components/domain/itp-page/sections/TradeCta.tsx
git commit -m "feat(itp-page): add TradeCta component"
```

### Task 15: Final Page Integration + Smoke Test

- [ ] **Step 1: Verify all components imported and rendered in ItpPageClient**

Check that `ItpPageClient.tsx` imports and renders all 10 section components in order.

- [ ] **Step 2: Verify page.tsx server shell fetches enrichment and passes to client**

Ensure the server page:
1. Calls `getItpDetail()` for core data
2. Fetches `/api/itp-enrichment?itp_id={itpId}` for enrichment
3. Passes both to `<ItpPageClient>`

- [ ] **Step 3: Test locally**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/itp/0x0000000000000000000000000000000000000000000000000000000000000001` (ITP-100).

Verify:
- Key stats bar shows NAV, TVL, Holdings count, Since Inception %
- Performance chart loads with timeframe tabs
- Holdings table shows 100 assets with logos, pagination works
- Donut chart shows top 10 + Other
- Concentration metrics show Top 5, Top 10, HHI
- Founder demographics shows 4 bar charts (if data matches)
- DeFi Health shows TVL aggregates (if data available)
- Funding shows raise data (if data available)
- Fund Facts shows ITP ID with copy button
- Trade CTA buttons link correctly

- [ ] **Step 4: Commit all remaining changes**

```bash
git add -A frontend/components/domain/itp-page/ frontend/app/[locale]/itp/
git commit -m "feat(itp-page): complete BlackRock-style ITP fund page with all sections"
```

---

## Summary

| Task | Component | Depends On |
|------|-----------|------------|
| 1a | Types | — |
| 1b | Page Config + Section Registry | — |
| 1c | SectionRenderer | 1b |
| 1d | Build-time founders preprocessing | — |
| 2 | API Route | 1a, 1d |
| 3 | ItpPageClient | 1a, 1b, 1c |
| 4 | KeyStatsBar | 1a |
| 5 | Page Shell (+ JSON-LD XSS fix) | 2, 3 |
| 6 | PerformanceChart | — |
| 7 | HoldingsTable | 1a |
| 8 | PortfolioBreakdown | 1a |
| 9 | ConcentrationMetrics | 1a |
| 10 | FounderDemographics | 1a |
| 11 | DefiHealth | 1a |
| 12 | FundingOverview | 1a |
| 13 | FundFacts | — |
| 14 | TradeCta | — |
| 15 | Integration | All above |

**Critical path:** 1a + 1d → 2 → 5 → 15

**Parallelizable:** Tasks 1b, 1c, 1d, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14 are independent — up to 6 can run in parallel.

**Adding a new ITP type:** One entry in `ITP_PAGE_CONFIGS` + one line in `ITP_TYPE_MAP`. No new files, no new components.

---

## Security Fixes Applied (from 3-reviewer consensus)

| # | Finding | Fix Applied |
|---|---------|-------------|
| 1 | SSRF via unvalidated itp_id | Strict regex `/^0x[0-9a-fA-F]{64}$/` + `encodeURIComponent()` |
| 2 | Path traversal / file absent on Vercel | Build-time preprocessing (Task 1d): 7MB → 200KB lookup in `frontend/data/` |
| 3 | Memory exhaustion on cold start | Pre-processed lookup + process-level cache with TTL for DeFi data |
| 4 | Error message leaks internal details | Generic error messages only, `console.error` server-side |
| 5 | JSON-LD XSS via `</script>` | `.replace(/</g, '\\u003c')` after JSON.stringify |
| 6 | Cache poisoning on degraded responses | Only `s-maxage` when `holdings.length > 0`, else `private, no-cache` |
| 7 | DeFi data not process-cached | Added TTL-based process-level cache (5 min) for protocols + raises |
