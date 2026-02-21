'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useMarketSnapshot,
  useMarketSnapshotMeta,
  type SnapshotPrice,
  type SourceSchedule,
} from '@/hooks/vision/useMarketSnapshot'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const VISION_API_URL = process.env.NEXT_PUBLIC_VISION_API_URL || ''

const TILE_HEIGHT = 64 // px per tile row
const SECTION_HEADER_HEIGHT = 48
const SUBHEADER_HEIGHT = 36
const COLS_BY_WIDTH: [number, number][] = [
  [1800, 22],
  [1400, 18],
  [1200, 14],
  [1000, 10],
  [768, 8],
  [0, 6],
]

// Frontend display name overrides (sourceId → display name)
const SOURCE_DISPLAY_OVERRIDES: Record<string, string> = {
  polymarket: 'Prediction Markets',
}

// Category groups — group sources into clean tabs
const CATEGORY_GROUPS: { id: string; label: string; sources: string[] }[] = [
  { id: 'crypto', label: 'Crypto', sources: ['crypto', 'bchain', 'defi'] },
  { id: 'stocks', label: 'Stocks', sources: ['stocks', 'twse', 'finra'] },
  { id: 'predictions', label: 'Predictions', sources: ['polymarket'] },
  { id: 'macro', label: 'Macro', sources: ['rates', 'bls', 'ecb', 'bonds', 'imf', 'worldbank', 'sec_13f'] },
  { id: 'commodities', label: 'Commodities', sources: ['futures', 'cftc', 'opec', 'eia', 'energy_charts', 'caiso'] },
  { id: 'weather', label: 'Weather', sources: ['weather', 'tides', 'goes_xray'] },
  { id: 'tech', label: 'Tech', sources: ['npm', 'pypi', 'crates_io', 'github', 'cloudflare', 'hackernews'] },
  { id: 'entertainment', label: 'Entertainment', sources: ['tmdb', 'anilist', 'twitch', 'steam', 'backpacktf', 'fourchan'] },
  { id: 'transport', label: 'Transport', sources: ['opensky'] },
]

// Reverse lookup: source → category (used internally for category routing)
const SOURCE_TO_CATEGORY: Record<string, string> = {}
for (const cat of CATEGORY_GROUPS) {
  for (const src of cat.sources) {
    SOURCE_TO_CATEGORY[src] = cat.id
  }
}

// Subcategory display names (keyed by derived feed type)
const FEED_TYPE_DISPLAY_NAMES: Record<string, string> = {
  // Weather metrics
  temperature_2m: 'Temperature',
  rain: 'Rainfall',
  wind_speed_10m: 'Wind Speed',
  pm2_5: 'PM2.5 Air Quality',
  ozone: 'Ozone',
  // DeFi feed types
  chain_tvl: 'Chain TVL',
  protocol_tvl: 'Protocol TVL',
  dex_volume: 'DEX Volume',
  // Polymarket derived subcategories
  poly_sports: 'Sports',
  poly_politics: 'Politics & Elections',
  poly_crypto: 'Crypto & Finance',
  poly_entertainment: 'Entertainment & Awards',
  poly_esports: 'Esports & Gaming',
  poly_science: 'Science & Tech',
  poly_other: 'Other',
}

// Derive the data feed type from a price entry's asset ID / source
function deriveFeedType(p: SnapshotPrice): string | null {
  if (p.source === 'weather') {
    // asset_id format: {city_id}:{metric} e.g. "paris-fr:temperature_2m"
    const colonIdx = p.assetId.lastIndexOf(':')
    if (colonIdx > 0) return p.assetId.slice(colonIdx + 1)
    return null
  }
  if (p.source === 'defi') {
    // asset_id prefixes: chain_, protocol_, dex_24h_, dex_30d_
    if (p.assetId.startsWith('chain_')) return 'chain_tvl'
    if (p.assetId.startsWith('protocol_')) return 'protocol_tvl'
    if (p.assetId.startsWith('dex_')) return 'dex_volume'
    return null
  }
  if (p.source === 'polymarket') {
    return classifyPolymarket(p.name)
  }
  return null
}

// Keyword-based classification for Polymarket assets
function classifyPolymarket(name: string): string {
  const n = name.toLowerCase()
  if (
    /\b(nba|nfl|nhl|mlb|mls|ufc|atp|wta|epl|premier league|serie a|la liga|bundesliga|ligue 1|eredivisie|championship)\b/.test(n) ||
    /\bvs\.\s/.test(n) ||
    /\bo\/u\b/.test(n) ||
    /\bover\/under\b/.test(n) ||
    /\bgame handicap\b/.test(n) ||
    /\b(win on 20|draw\?|relegated|promotion|champion)\b/.test(n) ||
    /\b(total kills|total maps|total rounds|map winner)\b/.test(n) ||
    /\b(fc:|fc\b.*win|score|goal scorer)\b/.test(n)
  ) return 'poly_sports'
  if (
    /\b(democratic|republican|party.*win|election|senate|congress|house seat|president|governor|mayor|parliament|prime minister|political|legislation|bill\s|vote)\b/.test(n)
  ) return 'poly_politics'
  if (
    /\b(btc|eth|xrp|sol|bitcoin|ethereum|solana|dogecoin|crypto|token|fdv|market cap|price.*\$|reach \$|above \$|below \$|s&p 500|nasdaq|dow jones|stock|trading|bull|bear)\b/.test(n) ||
    /\bup or down\b/.test(n)
  ) return 'poly_crypto'
  if (
    /\b(oscar|emmy|grammy|award|best director|best picture|best actor|best actress|snl|golden globe|bafta|tony award|razzie|box office)\b/.test(n)
  ) return 'poly_entertainment'
  if (
    /\b(esport|league of legends|dota|counter-strike|valorant|overwatch|csgo|lol\b|lgd|fnatic|cloud9|faze|navi|g2)\b/.test(n) ||
    /\b(kills|map\s\d|game\s\d.*winner)\b/.test(n)
  ) return 'poly_esports'
  if (
    /\b(ai model|artificial intelligence|space|nasa|spacex|climate|weather|science|tech|quantum|fusion|chatbot arena)\b/.test(n)
  ) return 'poly_science'
  return 'poly_other'
}

// Sources that should show subcategories (by data feed type)
const SUBCATEGORIZED_SOURCES = new Set(['weather', 'polymarket', 'defi'])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(v: number, source: string, assetId?: string): string {
  if (source === 'rates' || source === 'bls' || source === 'bonds') return `${v.toFixed(2)}%`
  if (source === 'ecb') return v.toFixed(4)
  if (source === 'weather') {
    if (assetId) {
      const metric = assetId.split(':')[1]
      if (metric === 'temperature_2m') return `${v.toFixed(1)}°C`
      if (metric === 'rain') return `${v.toFixed(1)}mm`
      if (metric === 'wind_speed_10m') return `${v.toFixed(1)}km/h`
      if (metric === 'pm2_5') return `${v.toFixed(1)}µg/m³`
      if (metric === 'ozone') return `${v.toFixed(1)}µg/m³`
    }
    return v.toFixed(1)
  }
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  if (v >= 1) return `$${v.toFixed(2)}`
  if (v >= 0.01) return `$${v.toFixed(4)}`
  return `$${v.toFixed(6)}`
}

function formatMarketCap(mc: string | null | undefined): string {
  if (!mc) return ''
  const v = parseFloat(mc)
  if (v >= 1e12) return `MCap: $${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `MCap: $${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `MCap: $${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `MCap: $${(v / 1e3).toFixed(0)}K`
  return `MCap: $${v.toFixed(0)}`
}

function relativeTime(iso: string | null): string {
  if (!iso) return '-'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) {
    const abs = Math.abs(diff)
    if (abs < 60_000) return `in ${Math.round(abs / 1000)}s`
    if (abs < 3_600_000) return `in ${Math.round(abs / 60_000)}m`
    return `in ${Math.round(abs / 3_600_000)}h`
  }
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`
  return `${Math.round(diff / 86_400_000)}d ago`
}

function humanInterval(secs: number): string {
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.round(secs / 60)}m`
  if (secs < 86400) return `${Math.round(secs / 3600)}h`
  return `${Math.round(secs / 86400)}d`
}

const STATUS_COLORS: Record<string, string> = {
  healthy: 'bg-green-500',
  stale: 'bg-yellow-500',
  pending: 'bg-blue-500',
  disabled: 'bg-zinc-300',
}

function useColumnCount() {
  const [cols, setCols] = useState(10)
  useEffect(() => {
    function update() {
      const w = window.innerWidth
      for (const [breakpoint, c] of COLS_BY_WIDTH) {
        if (w >= breakpoint) { setCols(c); return }
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return cols
}

// ---------------------------------------------------------------------------
// Row types for virtualizer
// ---------------------------------------------------------------------------

type VirtualRow =
  | { type: 'header'; source: SourceSchedule; count: number }
  | { type: 'subheader'; label: string; count: number }
  | { type: 'tiles'; prices: SnapshotPrice[] }

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CryptoLogo({ assetId, symbol, size = 16 }: { assetId: string; symbol: string; size?: number }) {
  const [hasError, setHasError] = useState(false)

  // Fallback: letter avatar — shown immediately on error or when logo unavailable
  if (hasError) {
    return (
      <div
        className="rounded-full bg-surface flex items-center justify-center text-text-muted font-bold"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        {symbol.charAt(0).toUpperCase()}
      </div>
    )
  }

  // Use plain <img> — no next/image dependency on AA-specific /logos/crypto/ path
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/logos/crypto/${assetId}.png`}
      alt={symbol}
      width={size}
      height={size}
      className="rounded-full"
      onError={() => setHasError(true)}
    />
  )
}

function SourceCard({ source, assetCount }: { source: SourceSchedule; assetCount: number }) {
  const displayName = SOURCE_DISPLAY_OVERRIDES[source.sourceId] || source.displayName
  return (
    <div className="border border-border-light bg-white p-3 min-w-[160px] flex-shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[source.status] || 'bg-zinc-300'}`} />
        <span className="font-mono text-[11px] font-bold text-text-primary uppercase tracking-wide">{displayName}</span>
      </div>
      <div className="space-y-0.5 font-mono text-[10px] text-text-muted">
        <div className="flex justify-between">
          <span>Assets</span>
          <span className="text-text-secondary font-semibold">{assetCount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Last sync</span>
          <span className="text-text-secondary">{relativeTime(source.lastSync)}</span>
        </div>
        <div className="flex justify-between">
          <span>Next</span>
          <span className="text-text-secondary">{relativeTime(source.estimatedNextUpdate)}</span>
        </div>
        <div className="flex justify-between">
          <span>Interval</span>
          <span className="text-text-secondary">every {humanInterval(source.syncIntervalSecs)}</span>
        </div>
      </div>
    </div>
  )
}

function heatClass(changePct: number | null): string {
  if (changePct === null) return ''
  const abs = Math.abs(changePct)
  if (changePct >= 0) {
    if (abs >= 10) return 'heat-up-4'
    if (abs >= 5) return 'heat-up-3'
    if (abs >= 2) return 'heat-up-2'
    if (abs > 0) return 'heat-up-1'
  } else {
    if (abs >= 10) return 'heat-down-4'
    if (abs >= 5) return 'heat-down-3'
    if (abs >= 2) return 'heat-down-2'
    if (abs > 0) return 'heat-down-1'
  }
  return ''
}

function PriceTileInline({ price }: { price: SnapshotPrice }) {
  const value = parseFloat(price.value)
  const changePct = price.changePct ? parseFloat(price.changePct) : null
  const isUp = changePct !== null && changePct >= 0
  const isDown = changePct !== null && changePct < 0
  const hasCryptoLogo = price.source === 'crypto'

  let displaySymbol =
    !price.symbol || price.symbol === '-'
      ? price.name.replace(' TVL', '').slice(0, 10)
      : price.symbol
  // Weather: show city name (strip metric suffix from name like "Paris Temperature")
  if (price.source === 'weather') {
    const parts = price.name.split(' ')
    displaySymbol = parts.length > 1 ? parts.slice(0, -1).join(' ') : price.name
    if (displaySymbol.length > 14) displaySymbol = displaySymbol.slice(0, 12) + '..'
  }

  return (
    <div
      className={`p-2 border border-border-light cursor-default hover:outline hover:outline-2 hover:outline-black hover:-outline-offset-2 transition-[outline] ${heatClass(changePct)}`}
      title={`${price.name}\n${formatValue(value, price.source, price.assetId)}${changePct !== null ? `\n24h: ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : ''}${price.marketCap ? `\n${formatMarketCap(price.marketCap)}` : ''}`}
    >
      <div className="flex items-center gap-1.5">
        {hasCryptoLogo && <CryptoLogo assetId={price.assetId} symbol={price.symbol} size={16} />}
        <div className="font-mono text-xs font-bold text-text-primary truncate">{displaySymbol}</div>
      </div>
      <div className="font-mono text-[10px] text-text-muted truncate">
        {formatValue(value, price.source, price.assetId)}
      </div>
      {changePct !== null && (
        <div className={`font-mono text-[10px] font-semibold ${isUp ? 'text-color-up' : 'text-color-down'}`}>
          {isUp ? '\u2191' : '\u2193'}{Math.abs(changePct).toFixed(1)}%
        </div>
      )}
    </div>
  )
}

function SectionHeader({ source, count }: { source: SourceSchedule; count: number }) {
  const displayName = SOURCE_DISPLAY_OVERRIDES[source.sourceId] || source.displayName
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-black text-white sticky top-0 z-10">
      <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[source.status] || 'bg-zinc-500'}`} />
      <span className="font-mono text-[12px] font-bold uppercase tracking-wider">{displayName}</span>
      <span className="font-mono text-[11px] text-white/60">{count.toLocaleString()} assets</span>
      <span className="font-mono text-[11px] text-white/40">
        synced {relativeTime(source.lastSync)} &middot; every {humanInterval(source.syncIntervalSecs)}
      </span>
    </div>
  )
}

function SubSectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-surface border-b border-border-light">
      <span className="font-mono text-[11px] font-semibold text-text-secondary uppercase tracking-wide">{label}</span>
      <span className="font-mono text-[10px] text-text-muted">{count.toLocaleString()}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VisionMarketsGrid() {
  // Progressive loading: meta loads instantly (~1KB), full snapshot loads in background (~3MB)
  const { data: meta, isLoading: metaLoading } = useMarketSnapshotMeta()
  const { data, isLoading: snapshotLoading, isError, error } = useMarketSnapshot()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cols = useColumnCount()

  // Use meta for instant display, full data once loaded
  const totalAssets = data?.totalAssets ?? meta?.totalAssets ?? 0
  const sources = data?.sources ?? meta?.sources ?? []
  const generatedAtRaw = data?.generatedAt ?? meta?.generatedAt ?? null
  const pricesLoaded = !!data?.prices?.length

  // Source schedule map for quick lookup
  const sourceMap = useMemo(() => {
    return new Map(sources.map((s) => [s.sourceId, s]))
  }, [sources])

  // Count assets per source — from full data if available, else from meta counts
  const assetCountBySource = useMemo(() => {
    if (data?.prices) {
      const counts: Record<string, number> = {}
      for (const p of data.prices) {
        counts[p.source] = (counts[p.source] || 0) + 1
      }
      return counts
    }
    return (meta?.assetCounts ?? {}) as Record<string, number>
  }, [data?.prices, meta?.assetCounts])

  // Enabled sources — hide sources with 0 assets
  const enabledSources = useMemo(() => {
    return sources.filter((s) => s.enabled && (assetCountBySource[s.sourceId] ?? 0) > 0)
  }, [sources, assetCountBySource])

  // Category tabs with counts — only show categories that have active sources
  const enabledCategories = useMemo(() => {
    return CATEGORY_GROUPS
      .map((cat) => {
        const count = cat.sources.reduce(
          (sum, src) => sum + (assetCountBySource[src] || 0),
          0,
        )
        return { ...cat, count }
      })
      .filter((cat) => cat.count > 0)
  }, [assetCountBySource])

  // Sources in the selected category (or all if no category selected)
  const selectedSourceIds = useMemo(() => {
    if (!selectedCategory) return null
    const cat = CATEGORY_GROUPS.find((c) => c.id === selectedCategory)
    return cat ? new Set(cat.sources) : null
  }, [selectedCategory])

  // Derive feed-type subcategories for sources that support them
  const enrichedPrices = useMemo(() => {
    if (!data?.prices) return []
    return data.prices.map((p) => {
      if (SUBCATEGORIZED_SOURCES.has(p.source)) {
        const feedType = deriveFeedType(p)
        if (feedType) return { ...p, category: feedType }
      }
      return p
    })
  }, [data?.prices])

  // Group, filter, sort prices into sections → flat virtual rows
  const { virtualRows, totalFiltered } = useMemo(() => {
    if (!enrichedPrices.length) return { virtualRows: [] as VirtualRow[], totalFiltered: 0 }

    // Filter
    let prices = enrichedPrices
    if (selectedSourceIds) {
      prices = prices.filter((p) => selectedSourceIds.has(p.source))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      prices = prices.filter(
        (p) =>
          p.symbol.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q),
      )
    }

    const totalFiltered = prices.length

    // Group by source
    const grouped = new Map<string, SnapshotPrice[]>()
    for (const p of prices) {
      const list = grouped.get(p.source) || []
      list.push(p)
      grouped.set(p.source, list)
    }

    // Sort each group by marketCap desc
    for (const [, list] of grouped) {
      list.sort((a, b) => {
        const mcA = a.marketCap ? parseFloat(a.marketCap) : parseFloat(a.value)
        const mcB = b.marketCap ? parseFloat(b.marketCap) : parseFloat(b.value)
        return mcB - mcA
      })
    }

    // Build flat virtual rows: header + (optional subcategories) + tile rows per source
    const rows: VirtualRow[] = []
    const sourceOrder = enabledSources.map((s) => s.sourceId)

    for (const sourceId of sourceOrder) {
      const list = grouped.get(sourceId)
      if (!list || list.length === 0) continue
      const schedule = sourceMap.get(sourceId)
      if (!schedule) continue

      rows.push({ type: 'header', source: schedule, count: list.length })

      // Check if this source should have subcategories
      const hasCategories = SUBCATEGORIZED_SOURCES.has(sourceId) &&
        list.some((p) => p.category && p.category !== 'null')

      if (hasCategories) {
        // Group by category within source
        const catGrouped = new Map<string, SnapshotPrice[]>()
        for (const p of list) {
          const cat = p.category || 'uncategorized'
          const catList = catGrouped.get(cat) || []
          catList.push(p)
          catGrouped.set(cat, catList)
        }

        // Sort categories: known feed types first (by count desc), then unknowns
        const catEntries = Array.from(catGrouped.entries()).sort(([a, aList], [b, bList]) => {
          const aKnown = a in FEED_TYPE_DISPLAY_NAMES
          const bKnown = b in FEED_TYPE_DISPLAY_NAMES
          if (aKnown && !bKnown) return -1
          if (!aKnown && bKnown) return 1
          return bList.length - aList.length
        })

        for (const [cat, catPrices] of catEntries) {
          const label = FEED_TYPE_DISPLAY_NAMES[cat] || cat
          rows.push({ type: 'subheader', label, count: catPrices.length })
          for (let i = 0; i < catPrices.length; i += cols) {
            rows.push({ type: 'tiles', prices: catPrices.slice(i, i + cols) })
          }
        }
      } else {
        // No subcategories — flat tile rows
        for (let i = 0; i < list.length; i += cols) {
          rows.push({ type: 'tiles', prices: list.slice(i, i + cols) })
        }
      }
    }

    return { virtualRows: rows, totalFiltered }
  }, [enrichedPrices, selectedSourceIds, search, cols, enabledSources, sourceMap])

  // Virtual scrolling
  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: useCallback(
      (index: number) => {
        const row = virtualRows[index]
        if (row?.type === 'header') return SECTION_HEADER_HEIGHT
        if (row?.type === 'subheader') return SUBHEADER_HEIGHT
        return TILE_HEIGHT
      },
      [virtualRows],
    ),
    overscan: 10,
  })

  const generatedAt = generatedAtRaw
    ? new Date(generatedAtRaw).toLocaleTimeString()
    : '-'

  return (
    <div className="flex flex-col h-full">
      {/* Compact stats row */}
      <div className="flex items-center gap-6 mb-4 flex-shrink-0 text-xs font-mono text-text-muted">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Total Assets</span>
          <span className="ml-2 text-text-primary font-bold">{totalAssets.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Sources</span>
          <span className="ml-2 text-text-primary font-bold">{enabledSources.length}</span>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Last Sync</span>
          <span className="ml-2 text-text-secondary">{generatedAt}</span>
        </div>
        {metaLoading && (
          <span className="text-text-muted animate-pulse">Connecting...</span>
        )}
      </div>

      {/* Source schedule cards — show from meta (instant) or full data */}
      {enabledSources.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 flex-shrink-0">
          {enabledSources.map((source) => (
            <SourceCard
              key={source.sourceId}
              source={source}
              assetCount={assetCountBySource[source.sourceId] || 0}
            />
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0 flex-wrap">
        <input
          type="text"
          placeholder="Search symbol or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border-2 border-zinc-900 text-text-primary font-mono text-sm px-4 py-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-black/10 w-64"
        />
        <div className="flex gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`filter-pill ${selectedCategory === null ? 'active' : ''}`}
          >
            All ({totalAssets.toLocaleString()})
          </button>
          {enabledCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`filter-pill ${selectedCategory === cat.id ? 'active' : ''}`}
            >
              {cat.label} ({cat.count.toLocaleString()})
            </button>
          ))}
        </div>
      </div>

      {/* Virtualized grid */}
      <div className="flex-1 border border-border-light bg-card overflow-hidden min-h-0">
        {isError ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-20">
            <div className="text-center font-mono">
              <p className="text-xl text-color-down/80 mb-2">Data Node Unavailable</p>
              <p className="text-sm text-text-secondary mb-4 max-w-md">
                The market data node is not responding. This usually means the snapshot service needs a restart.
              </p>
              <p className="text-xs text-text-muted mb-6">{error?.message}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-brand/10 border border-brand/30 text-brand font-mono text-sm hover:bg-brand/20 transition-all rounded-md"
              >
                Retry
              </button>
            </div>
            {/* Still show meta info if available */}
            {enabledSources.length > 0 && (
              <div className="mt-4 text-center">
                <p className="text-xs text-text-muted font-mono mb-3">
                  Last known: {totalAssets.toLocaleString()} assets across {enabledSources.length} sources
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {enabledSources.map((s) => {
                    const count = assetCountBySource[s.sourceId] || 0
                    return (
                      <span key={s.sourceId} className="px-2 py-1 bg-muted border border-border-light font-mono text-xs text-text-muted">
                        {SOURCE_DISPLAY_OVERRIDES[s.sourceId] || s.displayName}: {count.toLocaleString()}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : !pricesLoaded ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            {/* Animated loading indicator */}
            <div className="relative">
              <div className="w-16 h-16 border-2 border-border-light rounded-full" />
              <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-brand rounded-full animate-spin" />
            </div>
            <div className="text-center font-mono">
              <p className="text-lg text-text-secondary mb-1">
                Loading {totalAssets > 0 ? totalAssets.toLocaleString() : '50,000+'} markets
              </p>
              <p className="text-sm text-text-muted">
                {enabledSources.length > 0
                  ? `${enabledSources.length} sources across stocks, crypto, DeFi, weather, and more`
                  : 'Fetching market data from data node...'}
              </p>
            </div>
            {/* Mini source breakdown while loading */}
            {enabledSources.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {enabledSources.map((s) => {
                  const count = assetCountBySource[s.sourceId] || 0
                  return (
                    <span key={s.sourceId} className="px-2 py-1 bg-muted border border-border-light font-mono text-xs text-text-muted">
                      {SOURCE_DISPLAY_OVERRIDES[s.sourceId] || s.displayName}: {count.toLocaleString()}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        ) : virtualRows.length > 0 ? (
          <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden">
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const row = virtualRows[virtualItem.index]
                if (row.type === 'header') {
                  return (
                    <div
                      key={virtualItem.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <SectionHeader source={row.source} count={row.count} />
                    </div>
                  )
                }
                if (row.type === 'subheader') {
                  return (
                    <div
                      key={virtualItem.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <SubSectionHeader label={row.label} count={row.count} />
                    </div>
                  )
                }
                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                      display: 'grid',
                      gridTemplateColumns: `repeat(${cols}, 1fr)`,
                      gap: '1px',
                    }}
                  >
                    {row.prices.map((price) => (
                      <PriceTileInline
                        key={`${price.source}-${price.assetId}`}
                        price={price}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-text-muted font-mono">
            <p className="text-lg mb-2">No data found</p>
            <p className="text-sm">
              {search ? 'Try a different search term' : 'Data sync may be in progress'}
            </p>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex justify-between items-center mt-2 text-xs font-mono text-text-muted flex-shrink-0">
        <span>
          {pricesLoaded
            ? <>
                {totalFiltered.toLocaleString()} assets
                {totalFiltered < totalAssets && ` of ${totalAssets.toLocaleString()}`}
              </>
            : <>{totalAssets.toLocaleString()} assets</>
          }
          {' '}&middot; Auto-refreshes every 30s
        </span>
        <span>
          {pricesLoaded
            ? `Virtual scroll \u00B7 ${virtualRows.length.toLocaleString()} rows`
            : snapshotLoading ? 'Loading prices...' : ''
          }
        </span>
      </div>
    </div>
  )
}
