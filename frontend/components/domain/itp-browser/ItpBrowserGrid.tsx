'use client'

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { useSSENav, type NavSnapshot } from '@/hooks/useSSE'
import { useItpCreators } from '@/hooks/useItpCreators'
import { useItpNames } from '@/hooks/useItpNames'
import { ITP_PAGE_CONTENT } from '@/lib/itp-page-content'
import { BuyItpModal } from '@/components/domain/BuyItpModal'
import { SellItpModal } from '@/components/domain/SellItpModal'
import { ItpBrowserCard } from './ItpBrowserCard'
import blacklistedItps from '@/lib/config/blacklisted-itps.json'
import itpIdNames from '@/lib/itp-id-names.json'

const PROTOCOL_DEPLOYER = '0xc0d3ca67da45613e7c5b2d55f09b00b3c99721f4'

// On-chain name resolution costs one RPC roundtrip per ITP. Cap it to the
// top N by AUM so the page can mount in O(1) instead of O(itps).
const MAX_NAME_RESOLUTIONS = 200

// ── Category taxonomy (mirrored from ItpListing) ──

type FundCategoryId = 'broad-market' | 'factor' | 'income' | 'sector' | 'thematic'
type CategoryId = FundCategoryId | 'unofficial'

const FUND_CATEGORY_IDS: FundCategoryId[] = ['broad-market', 'factor', 'income', 'sector', 'thematic']

const LABEL_TO_PRIMARY: Record<string, FundCategoryId> = {
  'Macro Index': 'broad-market',
  'Crypto Index': 'broad-market',
  'Momentum Index': 'factor',
  'Risk Index': 'factor',
  'Contrarian Index': 'factor',
  'Yield Index': 'income',
  'TradFi Index': 'sector',
  'Tech Index': 'sector',
  'Culture Index': 'sector',
  'DeFi Index': 'sector',
  'Founder Index': 'thematic',
}

const OVERLAP_KEYWORDS: Record<FundCategoryId, RegExp> = {
  'broad-market': /broad|top.?100|all.?(50|sector)|rotation|capped quarterly/i,
  factor: /momentum|mom\b|low.?vol|min.?var|dual|multi.?factor|contrarian|decoupler/i,
  income: /tvl|yield|revenue|lending|staking|fee eff/i,
  sector: /defi|dex|gaming|game|rwa|privacy|bridge|oracle|zk|modular|nft|metaverse|depin|governance|fan token|move.?to|meme|cdp|liquid/i,
  thematic: /founder|alumni|phd|ivy|stanford|harvard|mit|berkeley|cornell|immigrant|ex-\w|serial entrepreneur|no.?degree|military|faang|peak build|elder|veteran|young founder|experienced|visibility|age spread|waterloo|multinational|american|european|chinese|asian|canadian|british|australian|german|mba|stealth/i,
}

const CATEGORY_LABELS: Record<FundCategoryId, string> = {
  'broad-market': 'Broad Market',
  factor: 'Factor',
  income: 'Income',
  sector: 'Sector',
  thematic: 'Thematic',
}

function getCategoriesForTicker(ticker: string, name: string): Set<FundCategoryId> {
  const cats = new Set<FundCategoryId>()
  const content = ITP_PAGE_CONTENT[ticker.toUpperCase()]
  if (content?.label) {
    const primary = LABEL_TO_PRIMARY[content.label]
    if (primary) cats.add(primary)
  }
  for (const [id, re] of Object.entries(OVERLAP_KEYWORDS) as [FundCategoryId, RegExp][]) {
    if (re.test(name) || re.test(ticker)) cats.add(id)
  }
  if (cats.size === 0) cats.add('broad-market')
  return cats
}

function getPrimaryCategory(cats: Set<FundCategoryId>): FundCategoryId {
  for (const c of FUND_CATEGORY_IDS) {
    if (cats.has(c)) return c
  }
  return 'broad-market'
}

// ── Data transforms ──

interface ItpRow {
  itpId: string
  name: string
  symbol: string
  navPerShare: number
  aum: number
  totalSupply: bigint
}

function itpIdToNumber(itpId: string): number {
  try {
    const hex = itpId.startsWith('0x') ? itpId.slice(2) : itpId
    return parseInt(hex, 16) || 0
  } catch { return 0 }
}

// Mirrors the filtering in data-node `compute_aum_ranking_json`: drop ITPs
// with no resolved NAV (broken or no oracle prices), then dedupe by display
// name keeping the highest AUM. The SSE `nav` topic doesn't apply these,
// so we replay them client-side. Without this the grid fills with thousands
// of permissionlessly-deployed empty ITPs.
function navSnapshotsToRows(navList: NavSnapshot[]): ItpRow[] {
  const blacklistSet = new Set((blacklistedItps as string[]).map(id => id.toLowerCase()))
  const rows: ItpRow[] = []
  for (const nav of navList) {
    if (blacklistSet.has(nav.itp_id.toLowerCase())) continue
    if (!(nav.nav_per_share > 0)) continue
    const num = itpIdToNumber(nav.itp_id)
    const override = (itpIdNames as Record<string, { name: string; ticker: string }>)[nav.itp_id.toLowerCase()]
    rows.push({
      itpId: nav.itp_id,
      name: override?.name || nav.name || `DTF #${num}`,
      symbol: override?.ticker || nav.symbol || `DTF${num}`,
      navPerShare: nav.nav_per_share,
      aum: nav.aum_usd,
      totalSupply: (() => { try { return BigInt(nav.total_supply ?? '0') } catch { return 0n } })(),
    })
  }
  // Dedupe by name — keep highest AUM
  rows.sort((a, b) => b.aum - a.aum)
  const seen = new Set<string>()
  const deduped: ItpRow[] = []
  for (const r of rows) {
    const key = r.name.trim().toLowerCase()
    if (!key) { deduped.push(r); continue }
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(r)
  }
  return deduped
}

// ── Responsive column count ──

function useColumnCount(): number {
  const [cols, setCols] = useState<number>(2)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mqlXl = window.matchMedia('(min-width: 1280px)')
    const mqlLg = window.matchMedia('(min-width: 1024px)')
    const update = () => {
      if (mqlXl.matches) setCols(4)
      else if (mqlLg.matches) setCols(3)
      else setCols(2)
    }
    update()
    mqlXl.addEventListener('change', update)
    mqlLg.addEventListener('change', update)
    return () => {
      mqlXl.removeEventListener('change', update)
      mqlLg.removeEventListener('change', update)
    }
  }, [])
  return cols
}

// ── Component ──

export function ItpBrowserGrid() {
  const t = useTranslations('markets')
  const router = useRouter()

  // Data: SSE primary, REST fallback
  const sseNavList = useSSENav()
  const [restNavList, setRestNavList] = useState<NavSnapshot[]>([])
  const [restFetched, setRestFetched] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchRanking = async () => {
      try {
        const res = await fetch('/api/dn/aum-ranking', { signal: AbortSignal.timeout(15_000) })
        if (cancelled) return
        if (!res.ok) { if (!cancelled) setRestFetched(true); return }
        const data = await res.json()
        const items = Array.isArray(data) ? data : (data?.snapshots ?? [])
        if (!cancelled && items.length > 0) {
          setRestNavList(items.map((d: any) => ({
            itp_id: d.itp_id || '',
            name: d.name || d.label || '',
            symbol: d.symbol || '',
            nav_per_share: d.nav_per_share || 0,
            total_supply: d.total_supply || '0',
            aum_usd: d.aum_usd || 0,
            settlement_address: d.settlement_address || null,
            vault_address: d.vault_address || null,
          })))
        }
        if (!cancelled) setRestFetched(true)
      } catch {
        if (!cancelled) setRestFetched(true)
      }
    }
    fetchRanking()
    const interval = setInterval(fetchRanking, 30_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const navList = sseNavList.length > 0 && sseNavList.some(n => (n.nav_per_share ?? 0) > 0)
    ? sseNavList : restNavList
  const loading = navList.length === 0 && !restFetched

  // Modals
  const [buyModal, setBuyModal] = useState<string | null>(null)
  const [sellModal, setSellModal] = useState<string | null>(null)

  // Filtering
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null)

  const rows = useMemo(() => navSnapshotsToRows(navList), [navList])
  // Creator detection for official vs community
  const itpIds = useMemo(() => rows.map(r => r.itpId), [rows])
  const { creators } = useItpCreators(itpIds)

  // On-chain names — capped to the top N by AUM. Resolving names for all
  // ~4000 ITPs would saturate the RPC for minutes. The remainder fall back
  // to "DTF #N" until they earn the visibility.
  const unknownItpIds = useMemo(() => {
    const unknown = rows.filter(r => r.name.startsWith('DTF #') || r.name.startsWith('DTF#'))
    unknown.sort((a, b) => b.aum - a.aum)
    return unknown.slice(0, MAX_NAME_RESOLUTIONS).map(r => r.itpId)
  }, [rows])
  const onChainNames = useItpNames(unknownItpIds)

  const namedRows = useMemo(() => {
    if (onChainNames.size === 0) return rows
    return rows.map(r => {
      const resolved = onChainNames.get(r.itpId.toLowerCase())
      if (resolved && (r.name.startsWith('DTF #') || r.name.startsWith('DTF#'))) {
        return { ...r, name: resolved.name || r.name, symbol: resolved.symbol || r.symbol }
      }
      return r
    })
  }, [rows, onChainNames])

  // Categories
  const categoryMap = useMemo(() => {
    const map = new Map<string, Set<FundCategoryId>>()
    for (const row of namedRows) map.set(row.itpId, getCategoriesForTicker(row.symbol, row.name))
    return map
  }, [namedRows])

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(FUND_CATEGORY_IDS.map(c => [c, 0])) as Record<FundCategoryId, number>
    for (const cats of categoryMap.values()) {
      for (const cat of cats) counts[cat]++
    }
    return counts
  }, [categoryMap])

  const unofficialCount = useMemo(() => {
    let count = 0
    for (const row of namedRows) {
      const creator = creators.get(row.itpId)
      if (creator && creator !== PROTOCOL_DEPLOYER) count++
    }
    return count
  }, [namedRows, creators])

  // Filter + sort
  const filtered = useMemo(() => {
    let list = namedRows
    if (activeCategory === 'unofficial') {
      list = list.filter(r => {
        const creator = creators.get(r.itpId)
        return creator && creator !== PROTOCOL_DEPLOYER
      })
    } else if (activeCategory) {
      list = list.filter(r => categoryMap.get(r.itpId)?.has(activeCategory as FundCategoryId))
    }
    return [...list].sort((a, b) => b.aum - a.aum)
  }, [namedRows, activeCategory, categoryMap, creators])

  // ── Virtualization ──

  const cols = useColumnCount()
  const gridRef = useRef<HTMLDivElement>(null)
  const [rowHeight, setRowHeight] = useState(280)
  const [scrollMargin, setScrollMargin] = useState(0)

  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    const recompute = () => {
      const w = el.clientWidth
      if (w > 0) setRowHeight(Math.floor(w / cols))
      const rect = el.getBoundingClientRect()
      setScrollMargin(rect.top + window.scrollY)
    }
    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(el)
    if (document.body) ro.observe(document.body)
    return () => ro.disconnect()
  }, [cols])

  const rowCount = Math.ceil(filtered.length / cols)
  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => rowHeight,
    overscan: 4,
    scrollMargin,
  })

  return (
    <div className="flex flex-col">
      {/* Category navigation */}
      <div className="border-b border-border-light bg-white">
        <div className="px-6 lg:px-12">
          <div
            className="max-w-site mx-auto flex items-end gap-0 overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <button
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 px-4 py-3 text-caption border-b-2 transition-colors whitespace-nowrap ${
                !activeCategory
                  ? 'text-black font-bold border-black'
                  : 'text-text-muted font-medium border-transparent hover:text-black hover:border-zinc-300'
              }`}
            >
              {t('listing.category_all')}
              <span className={`text-label font-mono tabular-nums ml-1.5 ${!activeCategory ? 'text-zinc-500' : 'text-text-muted/50'}`}>{namedRows.length}</span>
            </button>
            {FUND_CATEGORY_IDS.map(catId => {
              const count = categoryCounts[catId]
              const isActive = activeCategory === catId
              const catKey = catId.replace('-', '_')
              return (
                <button
                  key={catId}
                  onClick={() => setActiveCategory(isActive ? null : catId)}
                  className={`shrink-0 px-4 py-3 text-caption border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'text-black font-bold border-black'
                      : 'text-text-muted font-medium border-transparent hover:text-black hover:border-zinc-300'
                  }`}
                >
                  {t(`listing.category_${catKey}`)}
                  <span className={`text-label font-mono tabular-nums ml-1.5 ${isActive ? 'text-zinc-500' : 'text-text-muted/50'}`}>{count}</span>
                </button>
              )
            })}
            {unofficialCount > 0 && (
              <button
                onClick={() => setActiveCategory(activeCategory === 'unofficial' ? null : 'unofficial')}
                className={`shrink-0 px-4 py-3 text-caption border-b-2 transition-colors whitespace-nowrap ${
                  activeCategory === 'unofficial'
                    ? 'text-black font-bold border-black'
                    : 'text-text-muted font-medium border-transparent hover:text-black hover:border-zinc-300'
                }`}
              >
                {t('listing.category_unofficial')}
                <span className={`text-label font-mono tabular-nums ml-1.5 ${activeCategory === 'unofficial' ? 'text-zinc-500' : 'text-text-muted/50'}`}>{unofficialCount}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="px-6 lg:px-12 py-6">
        <div className="max-w-site mx-auto">
          {loading ? (
            <div
              className="grid border border-border-light"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: cols * 2 }).map((_, i) => (
                <div key={i} className="border-r border-b border-border-light p-4 animate-pulse aspect-square">
                  <div className="bg-zinc-100 rounded h-[100px] mb-3" />
                  <div className="bg-zinc-100 rounded h-4 w-1/3 mb-2" />
                  <div className="bg-zinc-100 rounded h-3 w-2/3 mb-3" />
                  <div className="flex gap-2">
                    <div className="flex-1 bg-zinc-100 rounded h-8" />
                    <div className="flex-1 bg-zinc-100 rounded h-8" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-text-muted text-body">
              {activeCategory ? t('listing.no_funds_filtered') : t('listing.no_funds')}
            </div>
          ) : (
            <div
              ref={gridRef}
              className="relative border border-border-light"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const startIdx = virtualRow.index * cols
                const rowItems = filtered.slice(startIdx, startIdx + cols)
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    className="absolute top-0 left-0 w-full grid"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowItems.map((row, i) => {
                      const idx = startIdx + i
                      const cats = categoryMap.get(row.itpId) ?? new Set<FundCategoryId>()
                      const primaryCat = getPrimaryCategory(cats)
                      const creator = creators.get(row.itpId)
                      const isCommunity = !!creator && creator !== PROTOCOL_DEPLOYER
                      return (
                        <ItpBrowserCard
                          key={row.itpId}
                          itpId={row.itpId}
                          name={row.name}
                          symbol={row.symbol}
                          navPerShare={row.navPerShare}
                          aum={row.aum}
                          description={ITP_PAGE_CONTENT[row.symbol.toUpperCase()]?.objective}
                          categoryLabel={CATEGORY_LABELS[primaryCat]}
                          isCommunity={isCommunity}
                          onBuy={setBuyModal}
                          onSell={setSellModal}
                          onNavigate={(id) => router.push(`/itp/${id}`)}
                          index={idx}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {buyModal && <BuyItpModal itpId={buyModal} onClose={() => setBuyModal(null)} />}
      {sellModal && <SellItpModal itpId={sellModal} onClose={() => setSellModal(null)} />}
    </div>
  )
}
