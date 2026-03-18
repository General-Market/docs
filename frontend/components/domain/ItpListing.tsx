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
import { Link } from '@/i18n/routing'
import { ITP_PAGE_CONTENT } from '@/lib/itp-page-content'

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
        totalSupply: BigInt(nav.total_supply),
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
type CategoryId = 'broad-market' | 'factor' | 'income' | 'sector' | 'thematic'

const FUND_CATEGORIES: { id: CategoryId; name: string; description: string }[] = [
  { id: 'broad-market', name: 'Broad Market', description: 'Diversified exposure across crypto markets' },
  { id: 'factor', name: 'Factor', description: 'Momentum, volatility & multi-factor strategies' },
  { id: 'income', name: 'Income', description: 'Yield, lending & revenue-weighted protocols' },
  { id: 'sector', name: 'Sector', description: 'DeFi, gaming, infrastructure & real-world assets' },
  { id: 'thematic', name: 'Thematic', description: 'Founder demographics, education & background' },
]

const LABEL_TO_PRIMARY: Record<string, CategoryId> = {
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

const OVERLAP_KEYWORDS: Record<CategoryId, RegExp> = {
  'broad-market': /broad|top.?100|all.?(50|sector)|rotation|capped quarterly/i,
  factor: /momentum|mom\b|low.?vol|min.?var|dual|multi.?factor|contrarian|decoupler/i,
  income: /tvl|yield|revenue|lending|staking|fee eff/i,
  sector: /defi|dex|gaming|game|rwa|privacy|bridge|oracle|zk|modular|nft|metaverse|depin|governance|fan token|move.?to|meme|cdp|liquid/i,
  thematic: /founder|alumni|phd|ivy|stanford|harvard|mit|berkeley|cornell|immigrant|ex-\w|serial entrepreneur|no.?degree|military|faang|peak build|elder|veteran|young founder|experienced|visibility|age spread|waterloo|multinational|american|european|chinese|asian|canadian|british|australian|german|mba|stealth/i,
}

function getCategoriesForTicker(ticker: string, name: string): Set<CategoryId> {
  const cats = new Set<CategoryId>()
  const content = ITP_PAGE_CONTENT[ticker.toUpperCase()]
  if (content?.label) {
    const primary = LABEL_TO_PRIMARY[content.label]
    if (primary) cats.add(primary)
  }
  for (const [id, re] of Object.entries(OVERLAP_KEYWORDS) as [CategoryId, RegExp][]) {
    if (re.test(name) || re.test(ticker)) cats.add(id)
  }
  if (cats.size === 0) cats.add('broad-market')
  return cats
}

type SortKey = 'ticker' | 'name' | 'nav' | 'aum' | 'shares'
type SortDir = 'asc' | 'desc'

export function ItpListing({ onCreateClick, onLendingClick, onItpsLoaded }: ItpListingProps) {
  const t = useTranslations('markets')

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
      } catch {}
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

  const categoryMap = useMemo(() => {
    const map = new Map<string, Set<CategoryId>>()
    for (const row of rows) map.set(row.itpId, getCategoriesForTicker(row.symbol, row.name))
    return map
  }, [rows])

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(FUND_CATEGORIES.map(c => [c.id, 0])) as Record<CategoryId, number>
    for (const cats of categoryMap.values()) {
      for (const cat of cats) counts[cat]++
    }
    return counts
  }, [categoryMap])

  useEffect(() => {
    if (onItpsLoaded && rows.length > 0) {
      onItpsLoaded(rows.map(r => ({ itpId: r.itpId, name: r.name, symbol: r.symbol })))
    }
  }, [rows, onItpsLoaded])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'ticker' ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    let list = rows
    if (activeCategory) {
      list = list.filter(r => categoryMap.get(r.itpId)?.has(activeCategory))
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
  }, [rows, deferredSearch, activeCategory, categoryMap, sortKey, sortDir])

  const PAGE_SIZE = 15
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = useMemo(() => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [sorted, page])

  // Reset to page 0 when search/sort changes
  useEffect(() => { setPage(0) }, [deferredSearch, sortKey, sortDir, activeCategory])

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
        </div>
      </div>

      {/* Category tiles — iShares-style asset class grid */}
      <div className="px-6 lg:px-12 pt-8 pb-2">
        <div className="max-w-site mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {FUND_CATEGORIES.map(cat => {
              const count = categoryCounts[cat.id]
              const isActive = activeCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(isActive ? null : cat.id)}
                  className={`text-left py-7 px-6 border rounded-card transition-all ${
                    isActive
                      ? 'bg-black text-white border-black shadow-card-hover'
                      : 'bg-white border-[#ddd] card-interactive'
                  }`}
                >
                  <div className={`text-heading font-black leading-tight ${isActive ? '' : 'text-text-primary'}`}>
                    {cat.name}
                  </div>
                  <div className={`text-caption font-mono tabular-nums mt-1.5 ${isActive ? 'text-white/60' : 'text-text-muted'}`}>
                    {count} {count === 1 ? 'fund' : 'funds'}
                  </div>
                  <div className={`text-caption leading-snug mt-3 ${isActive ? 'text-white/75' : 'text-text-secondary'}`}>
                    {cat.description}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Filter pills + search — iShares-style bar */}
      <div className="px-6 lg:px-12 pt-5 pb-1">
        <div className="max-w-site mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveCategory(null)}
              className={`filter-pill ${!activeCategory ? 'active' : ''}`}
            >
              All funds
            </button>
            {FUND_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                className={`filter-pill ${activeCategory === cat.id ? 'active' : ''}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by fund name or ticker..."
            className="w-full max-w-[300px] border border-[#ccc] rounded px-3 py-[7px] text-caption text-text-primary placeholder-[#aaa] focus:outline-none focus:border-[#666] transition-colors"
          />
        </div>
      </div>

      {/* Result count */}
      <div className="px-6 lg:px-12 pt-2 pb-3">
        <div className="max-w-site mx-auto">
          <div className="text-caption text-text-secondary">
            Showing <strong className="text-text-primary">{sorted.length}</strong> of {rows.length} funds
          </div>
        </div>
      </div>

      {/* Product table */}
      <div className="px-6 lg:px-12 pb-8">
        <div className="max-w-site mx-auto">
          {loading ? (
            <div className="text-center py-20 text-text-muted text-body">Loading funds...</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20 text-text-muted text-body">
              {searchQuery || activeCategory ? 'No funds match your filters.' : 'No funds available.'}
            </div>
          ) : (
            <>
            <div className="overflow-x-auto -mx-6 px-6 lg:-mx-0 lg:px-0">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f5f5] border-y border-[#ddd]">
                    <th
                      onClick={() => handleSort('ticker')}
                      className="py-2.5 px-4 text-left text-label font-semibold uppercase tracking-[0.05em] text-[#555] cursor-pointer select-none whitespace-nowrap hover:text-[#222]"
                    >
                      Ticker<SortArrow col="ticker" />
                    </th>
                    <th
                      onClick={() => handleSort('name')}
                      className="py-2.5 px-4 text-left text-label font-semibold uppercase tracking-[0.05em] text-[#555] cursor-pointer select-none whitespace-nowrap hover:text-[#222]"
                    >
                      Name<SortArrow col="name" />
                    </th>
                    <th className="py-2.5 px-2 w-8"></th>
                    <th
                      onClick={() => handleSort('nav')}
                      className="py-2.5 px-4 text-right text-label font-semibold uppercase tracking-[0.05em] text-[#555] cursor-pointer select-none whitespace-nowrap hover:text-[#222]"
                    >
                      NAV<SortArrow col="nav" />
                    </th>
                    <th
                      onClick={() => handleSort('aum')}
                      className="py-2.5 px-4 text-right text-label font-semibold uppercase tracking-[0.05em] text-[#555] cursor-pointer select-none whitespace-nowrap hover:text-[#222]"
                    >
                      Net Assets<SortArrow col="aum" />
                    </th>
                    <th
                      onClick={() => handleSort('shares')}
                      className="py-2.5 px-4 text-right text-label font-semibold uppercase tracking-[0.05em] text-[#555] cursor-pointer select-none whitespace-nowrap hover:text-[#222]"
                    >
                      Shares Outstanding<SortArrow col="shares" />
                    </th>
                    <th className="py-2.5 px-4 text-right text-label font-semibold uppercase tracking-[0.05em] text-[#555] whitespace-nowrap">
                      Trade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((row, idx) => (
                    <tr
                      key={row.itpId}
                      id={`itp-card-${row.itpId}`}
                      className={`border-b border-[#eee] hover:bg-[#f0f7f4] transition-colors ${
                        idx % 2 === 1 ? 'bg-[#fafafa]' : 'bg-white'
                      }`}
                    >
                      {/* Ticker — bold, standalone */}
                      <td className="py-3 px-4">
                        <Link href={`/itp/${row.itpId}`}>
                          <span className="text-caption font-bold text-text-primary hover:text-brand transition-colors">
                            {row.symbol}
                          </span>
                        </Link>
                      </td>
                      {/* Name — brand-colored link like iShares */}
                      <td className="py-3 px-4">
                        <Link href={`/itp/${row.itpId}`}>
                          <span className="text-caption text-brand-dark hover:text-brand hover:underline transition-colors">
                            {row.name}
                          </span>
                        </Link>
                      </td>
                      {/* Chart button */}
                      <td className="py-3 px-2 w-8">
                        <button
                          onClick={() => setChartModal({ itpId: row.itpId, name: row.name })}
                          className="text-[#999] hover:text-black transition-colors"
                          title="NAV chart"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 12 4 7 8 9 11 4 15 6" />
                          </svg>
                        </button>
                      </td>
                      {/* NAV */}
                      <td className="py-3 px-4 text-right">
                        <span className="text-caption font-mono tabular-nums text-text-primary">
                          ${row.navPerShare.toFixed(4)}
                        </span>
                      </td>
                      {/* Net Assets */}
                      <td className="py-3 px-4 text-right">
                        <span className="text-caption font-mono tabular-nums text-text-primary">
                          {formatNetAssets(row.aum)}
                        </span>
                      </td>
                      {/* Shares Outstanding */}
                      <td className="py-3 px-4 text-right">
                        <span className="text-caption font-mono tabular-nums text-[#666]">
                          {parseFloat(formatUnits(row.totalSupply, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      {/* Trade actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <WalletActionButton
                          onClick={() => setBuyModal(row.itpId)}
                          className="text-label font-semibold text-brand-dark hover:text-brand transition-colors"
                        >
                          Buy
                        </WalletActionButton>
                        <span className="mx-1.5 text-[#ddd]">|</span>
                        <WalletActionButton
                          onClick={() => setSellModal(row.itpId)}
                          className="text-label font-semibold text-[#666] hover:text-brand transition-colors"
                        >
                          Sell
                        </WalletActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-1">
                <span className="text-caption text-text-muted">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(0)}
                    disabled={page === 0}
                    className="px-2 py-1 text-label border border-[#ddd] rounded hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-default"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 0}
                    className="px-2.5 py-1 text-label border border-[#ddd] rounded hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-default"
                  >
                    Prev
                  </button>
                  <span className="px-3 text-caption text-text-primary font-medium">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-2.5 py-1 text-label border border-[#ddd] rounded hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-default"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setPage(totalPages - 1)}
                    disabled={page >= totalPages - 1}
                    className="px-2 py-1 text-label border border-[#ddd] rounded hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-default"
                  >
                    Last
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
