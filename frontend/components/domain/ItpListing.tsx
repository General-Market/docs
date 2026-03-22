'use client'

import { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { formatUnits } from 'viem'
import { BuyItpModal } from './BuyItpModal'
import { SellItpModal } from './SellItpModal'
import { ChartModal } from './ChartModal'
import blacklistedItps from '@/lib/config/blacklisted-itps.json'
import itpIdNames from '@/lib/itp-id-names.json'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { useSSENav, type NavSnapshot } from '@/hooks/useSSE'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { ITP_PAGE_CONTENT } from '@/lib/itp-page-content'
import { SpringNumber } from '@/components/ui/spring'
import { motion, useReducedMotion } from 'framer-motion'
import { useItpCreators } from '@/hooks/useItpCreators'
import { useItpNames } from '@/hooks/useItpNames'

const PROTOCOL_DEPLOYER = '0xc0d3ca67da45613e7c5b2d55f09b00b3c99721f4'

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

interface ItpRow {
  itpId: string
  name: string
  symbol: string
  navPerShare: number
  aum: number
  totalSupply: bigint
}

export interface DeployedItpRef {
  itpId: string
  name: string
  symbol: string
}

interface ItpListingProps {
  onCreateClick?: () => void
  onLendingClick?: () => void
  onItpsLoaded?: (itps: DeployedItpRef[]) => void
}

function itpIdToNumber(itpId: string): number {
  try {
    const hex = itpId.startsWith('0x') ? itpId.slice(2) : itpId
    return parseInt(hex, 16) || 0
  } catch {
    return 0
  }
}

function navSnapshotsToRows(navList: NavSnapshot[]): ItpRow[] {
  const blacklistSet = new Set((blacklistedItps as string[]).map(id => id.toLowerCase()))
  return navList
    .filter(nav => !blacklistSet.has(nav.itp_id.toLowerCase()))
    .map(nav => {
      const num = itpIdToNumber(nav.itp_id)
      const override = (itpIdNames as Record<string, { name: string; ticker: string }>)[nav.itp_id.toLowerCase()]
      return {
        itpId: nav.itp_id,
        name: override?.name || nav.name || `ITP #${num}`,
        symbol: override?.ticker || nav.symbol || `ITP${num}`,
        navPerShare: nav.nav_per_share,
        aum: nav.aum_usd,
        totalSupply: (() => { try { return BigInt(nav.total_supply ?? '0') } catch { return 0n } })(),
      }
    })
}

function formatNetAssets(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(2)}K`
  if (usd >= 0.01) return `$${usd.toFixed(2)}`
  return '—'
}

/* ── Category taxonomy — iShares-style asset class grouping, with overlap ── */
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

type SortKey = 'ticker' | 'name' | 'nav' | 'aum' | 'shares'
type SortDir = 'asc' | 'desc'

export function ItpListing({ onCreateClick, onLendingClick, onItpsLoaded }: ItpListingProps) {
  const t = useTranslations('markets')
  const router = useRouter()

  const sseNavList = useSSENav()
  const [restNavList, setRestNavList] = useState<NavSnapshot[]>([])

  // Always fetch REST immediately for fast initial render, SSE takes over when connected
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/dn/aum-ranking')
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0 && !cancelled) {
          setRestNavList(data.map((d: any) => ({
            itp_id: d.itp_id || '',
            name: d.name || '',
            symbol: d.symbol || '',
            nav_per_share: d.nav_per_share || 0,
            total_supply: d.total_supply || '0',
            aum_usd: d.aum_usd || 0,
            settlement_address: d.settlement_address || null,
          })))
        }
      } catch (e) { console.error('[ItpListing] REST nav fetch failed:', e) }
    })()
    return () => { cancelled = true }
  }, []) // Run once on mount

  const navList = sseNavList.length > 0 && sseNavList.some(n => (n.nav_per_share ?? 0) > 0)
    ? sseNavList
    : restNavList
  const loading = navList.length === 0
  const [buyModal, setBuyModal] = useState<string | null>(null)
  const [sellModal, setSellModal] = useState<string | null>(null)
  const [chartModal, setChartModal] = useState<{ itpId: string; name: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)
  const [sortKey, setSortKey] = useState<SortKey>('aum')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null)

  const rows = useMemo(() => navSnapshotsToRows(navList), [navList])
  const totalAum = useMemo(() => rows.reduce((sum, r) => sum + r.aum, 0), [rows])

  // Batch-read creators for all ITPs to distinguish official vs unofficial
  const itpIds = useMemo(() => rows.map(r => r.itpId), [rows])
  const { creators } = useItpCreators(itpIds)

  // Fetch on-chain names for ITPs not in the static mapping
  const unknownItpIds = useMemo(() =>
    rows
      .filter(r => r.name.startsWith('ITP #') || r.name.startsWith('ITP#'))
      .map(r => r.itpId),
    [rows]
  )
  const onChainNames = useItpNames(unknownItpIds)

  // Merge on-chain names into rows
  const namedRows = useMemo(() => {
    if (onChainNames.size === 0) return rows
    return rows.map(r => {
      const resolved = onChainNames.get(r.itpId.toLowerCase())
      if (resolved && (r.name.startsWith('ITP #') || r.name.startsWith('ITP#'))) {
        return { ...r, name: resolved.name || r.name, symbol: resolved.symbol || r.symbol }
      }
      return r
    })
  }, [rows, onChainNames])

  const unofficialCount = useMemo(() => {
    let count = 0
    for (const row of namedRows) {
      const creator = creators.get(row.itpId)
      if (creator && creator !== PROTOCOL_DEPLOYER) count++
    }
    return count
  }, [namedRows, creators])

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

  useEffect(() => {
    if (onItpsLoaded && namedRows.length > 0) {
      onItpsLoaded(namedRows.map(r => ({ itpId: r.itpId, name: r.name, symbol: r.symbol })))
    }
  }, [namedRows, onItpsLoaded])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'ticker' ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    let list = namedRows
    if (activeCategory === 'unofficial') {
      list = list.filter(r => {
        const creator = creators.get(r.itpId)
        return creator && creator !== PROTOCOL_DEPLOYER
      })
    } else if (activeCategory) {
      list = list.filter(r => categoryMap.get(r.itpId)?.has(activeCategory as FundCategoryId))
    }
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase().trim()
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.symbol.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'ticker': cmp = a.symbol.localeCompare(b.symbol); break
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'nav': cmp = a.navPerShare - b.navPerShare; break
        case 'aum': cmp = a.aum - b.aum; break
        case 'shares': cmp = Number(a.totalSupply - b.totalSupply); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, deferredSearch, activeCategory, categoryMap, creators, sortKey, sortDir])

  const PAGE_SIZE = 15
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = useMemo(() => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [sorted, page])

  // Reset to page 0 when search/sort changes
  useEffect(() => { setPage(0) }, [deferredSearch, sortKey, sortDir, activeCategory])

  const reduced = useReducedMotion()
  const staggerKey = `${activeCategory}-${sortKey}-${sortDir}-${page}-${deferredSearch}`

  const SortArrow = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null
    return (
      <svg className="w-2.5 h-2.5 inline-block ml-1" viewBox="0 0 10 10" fill="currentColor">
        {sortDir === 'asc'
          ? <path d="M5 2l4 6H1z" />
          : <path d="M5 8l4-6H1z" />
        }
      </svg>
    )
  }

  return (
    <>
      {/* Hero Band */}
      <div className="hero-band">
        <div className="hero-band-inner">
          <div className="text-label font-semibold tracking-[0.08em] uppercase text-text-muted mb-2">
            {t('hero.label')}
          </div>
          <h2 className="text-display md:text-[42px] font-black tracking-tight text-black leading-[1.1] mb-2">
            {t('hero.title')}
          </h2>
          <p className="text-subhead text-text-secondary max-w-[600px]">
            {t('hero.description')}
          </p>
          {rows.length > 0 && (
            <div className="flex gap-10 mt-5 pt-5 border-t border-border-light">
              <div>
                <div className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">{t('listing.total_net_assets')}</div>
                <SpringNumber
                  value={totalAum}
                  format={formatNetAssets}
                  className="text-heading font-black font-mono tabular-nums text-black"
                />
              </div>
              <div>
                <div className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">{t('listing.funds_label')}</div>
                <div className="text-heading font-black font-mono tabular-nums text-black">{rows.length}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category tabs + search — single bar */}
      <div className="px-6 lg:px-12 pt-8 pb-3">
        <div className="max-w-site mx-auto">
          <div className="flex items-end justify-between gap-4 flex-wrap border-b border-[#e0e0e0]">
            <div className="flex items-stretch gap-0 -mb-px">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-5 py-3 text-[14px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  !activeCategory
                    ? 'border-black text-black'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-[#ccc]'
                }`}
              >
                {t('listing.category_all')}
                <span className="ml-1.5 text-[12px] font-mono tabular-nums text-text-muted">{rows.length}</span>
              </button>
              {FUND_CATEGORY_IDS.map(catId => {
                const count = categoryCounts[catId]
                const isActive = activeCategory === catId
                const catKey = catId.replace('-', '_')
                return (
                  <button
                    key={catId}
                    onClick={() => setActiveCategory(isActive ? null : catId)}
                    className={`px-5 py-3 text-[14px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-black text-black'
                        : 'border-transparent text-text-secondary hover:text-text-primary hover:border-[#ccc]'
                    }`}
                  >
                    {t(`listing.category_${catKey}`)}
                    <span className="ml-1.5 text-[12px] font-mono tabular-nums text-text-muted">{count}</span>
                  </button>
                )
              })}
              {unofficialCount > 0 && (
                <button
                  onClick={() => setActiveCategory(activeCategory === 'unofficial' ? null : 'unofficial')}
                  className={`px-5 py-3 text-[14px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    activeCategory === 'unofficial'
                      ? 'border-black text-black'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:border-[#ccc]'
                  }`}
                >
                  {t('listing.category_unofficial')}
                  <span className="ml-1.5 text-[12px] font-mono tabular-nums text-text-muted">{unofficialCount}</span>
                </button>
              )}
            </div>
            <div className="pb-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('filters.search_placeholder')}
                className="w-full max-w-[300px] border border-[#ccc] rounded px-3 py-[7px] text-caption text-text-primary placeholder-[#aaa] focus:outline-none focus:border-[#666] transition-colors"
              />
            </div>
          </div>
          <div className="text-caption text-text-secondary mt-2">
            {t('section_bar.showing_partial', { shown: sorted.length, total: rows.length })}
          </div>
        </div>
      </div>

      {/* Product table */}
      <div className="px-6 lg:px-12 pb-8">
        <div className="max-w-site mx-auto">
          {loading ? (
            <div className="text-center py-20 text-text-muted text-body">{t('listing.loading_funds')}</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20 text-text-muted text-body">
              {searchQuery || activeCategory ? t('listing.no_funds_filtered') : t('listing.no_funds')}
            </div>
          ) : (
            <>
            <div className="overflow-x-auto -mx-6 px-6 lg:-mx-0 lg:px-0">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-[3px] border-black">
                    <th
                      onClick={() => handleSort('ticker')}
                      className="py-3 px-4 text-left text-label font-bold uppercase tracking-[0.08em] text-text-secondary cursor-pointer select-none whitespace-nowrap hover:text-text-primary transition-colors"
                    >
                      {t('listing.table.ticker')}<SortArrow col="ticker" />
                    </th>
                    <th
                      onClick={() => handleSort('name')}
                      className="py-3 px-4 text-left text-label font-bold uppercase tracking-[0.08em] text-text-secondary cursor-pointer select-none whitespace-nowrap hover:text-text-primary transition-colors"
                    >
                      {t('listing.table.name')}<SortArrow col="name" />
                    </th>
                    <th className="py-3 px-2 w-8"></th>
                    <th
                      onClick={() => handleSort('nav')}
                      className="py-3 px-4 text-right text-label font-bold uppercase tracking-[0.08em] text-text-secondary cursor-pointer select-none whitespace-nowrap hover:text-text-primary transition-colors"
                    >
                      {t('listing.table.nav')}<SortArrow col="nav" />
                    </th>
                    <th
                      onClick={() => handleSort('aum')}
                      className="py-3 px-4 text-right text-label font-bold uppercase tracking-[0.08em] text-text-secondary cursor-pointer select-none whitespace-nowrap hover:text-text-primary transition-colors"
                    >
                      {t('listing.table.net_assets')}<SortArrow col="aum" />
                    </th>
                    <th
                      onClick={() => handleSort('shares')}
                      className="py-3 px-4 text-right text-label font-bold uppercase tracking-[0.08em] text-text-secondary cursor-pointer select-none whitespace-nowrap hover:text-text-primary transition-colors"
                    >
                      {t('listing.table.shares_outstanding')}<SortArrow col="shares" />
                    </th>
                    <th className="py-3 px-4 text-right text-label font-bold uppercase tracking-[0.08em] text-text-secondary whitespace-nowrap">
                      {t('listing.table.trade')}
                    </th>
                  </tr>
                </thead>
                <tbody key={staggerKey}>
                  {paginated.map((row, idx) => (
                    <motion.tr
                      key={row.itpId}
                      id={`itp-card-${row.itpId}`}
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={reduced ? { duration: 0 } : { duration: 0.4, delay: idx * 0.03, ease: [0.22, 1, 0.36, 1] }}
                      onClick={() => router.push(`/itp/${row.itpId}`)}
                      className={`border-b border-[#eee] hover:bg-[#f0f7f4] transition-colors cursor-pointer ${
                        idx % 2 === 1 ? 'bg-[#fafafa]' : 'bg-white'
                      }`}
                    >
                      {/* Ticker — bold, standalone */}
                      <td className="py-3 px-4">
                        <span className="text-caption font-bold text-text-primary">
                          {row.symbol}
                        </span>
                      </td>
                      {/* Name — brand-colored like iShares */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-caption text-brand-dark">
                            {row.name}
                          </span>
                          {(() => {
                            const creator = creators.get(row.itpId)
                            if (!creator || creator === PROTOCOL_DEPLOYER) return null
                            return (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#7c6f3e] bg-[#f5f0e0] px-1.5 py-0.5 rounded">
                                {t('listing.community_badge')}
                              </span>
                            )
                          })()}
                        </div>
                        {(() => {
                          const creator = creators.get(row.itpId)
                          if (!creator || creator === PROTOCOL_DEPLOYER) return null
                          return (
                            <div className="text-[11px] font-mono text-text-muted mt-0.5">
                              {truncateAddress(creator)}
                            </div>
                          )
                        })()}
                      </td>
                      {/* Chart button */}
                      <td className="py-3 px-2 w-8">
                        <button
                          onClick={(e) => { e.stopPropagation(); setChartModal({ itpId: row.itpId, name: row.name }) }}
                          className="text-[#999] hover:text-black transition-colors"
                          title={t('chart.nav_ohlc')}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 12 4 7 8 9 11 4 15 6" />
                          </svg>
                        </button>
                      </td>
                      {/* NAV */}
                      <td className="py-3 px-4 text-right">
                        <SpringNumber
                          value={row.navPerShare}
                          format={n => `$${n.toFixed(4)}`}
                          className="text-caption font-mono tabular-nums text-text-primary"
                        />
                      </td>
                      {/* Net Assets */}
                      <td className="py-3 px-4 text-right">
                        <SpringNumber
                          value={row.aum}
                          format={formatNetAssets}
                          className="text-caption font-mono tabular-nums text-text-primary"
                        />
                      </td>
                      {/* Shares Outstanding */}
                      <td className="py-3 px-4 text-right">
                        <span className="text-caption font-mono tabular-nums text-[#666]">
                          {parseFloat(formatUnits(row.totalSupply, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      {/* Trade actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <WalletActionButton
                          onClick={() => setBuyModal(row.itpId)}
                          className="text-label font-semibold text-brand-dark hover:text-brand transition-colors"
                        >
                          {t('listing.table.buy')}
                        </WalletActionButton>
                        <span className="mx-1.5 text-[#ddd]">|</span>
                        <WalletActionButton
                          onClick={() => setSellModal(row.itpId)}
                          className="text-label font-semibold text-[#666] hover:text-brand transition-colors"
                        >
                          {t('listing.table.sell')}
                        </WalletActionButton>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-1">
                <span className="text-caption text-text-muted">
                  {t('listing.pagination.range', { start: page * PAGE_SIZE + 1, end: Math.min((page + 1) * PAGE_SIZE, sorted.length), total: sorted.length })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(0)}
                    disabled={page === 0}
                    className="px-2 py-1 text-label border border-[#ddd] rounded hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-default"
                  >
                    {t('listing.pagination.first')}
                  </button>
                  <button
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 0}
                    className="px-2.5 py-1 text-label border border-[#ddd] rounded hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-default"
                  >
                    {t('listing.pagination.prev')}
                  </button>
                  <span className="px-3 text-caption text-text-primary font-medium">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-2.5 py-1 text-label border border-[#ddd] rounded hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-default"
                  >
                    {t('listing.pagination.next')}
                  </button>
                  <button
                    onClick={() => setPage(totalPages - 1)}
                    disabled={page >= totalPages - 1}
                    className="px-2 py-1 text-label border border-[#ddd] rounded hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-default"
                  >
                    {t('listing.pagination.last')}
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      {chartModal && (
        <ChartModal
          itpId={chartModal.itpId}
          itpName={chartModal.name}
          onClose={() => setChartModal(null)}
        />
      )}
      {buyModal && (
        <BuyItpModal itpId={buyModal} onClose={() => setBuyModal(null)} />
      )}
      {sellModal && (
        <SellItpModal itpId={sellModal} onClose={() => setSellModal(null)} />
      )}
    </>
  )
}
