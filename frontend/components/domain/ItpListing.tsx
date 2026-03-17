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
import { PageSection } from '@/components/layout/PageSection'

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

  const navList = sseNavList.length > 0 ? sseNavList : restNavList
  const loading = navList.length === 0
  const [buyModal, setBuyModal] = useState<string | null>(null)
  const [sellModal, setSellModal] = useState<string | null>(null)
  const [chartModal, setChartModal] = useState<{ itpId: string; name: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)
  const [sortKey, setSortKey] = useState<SortKey>('aum')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const rows = useMemo(() => navSnapshotsToRows(navList), [navList])

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
  }, [rows, deferredSearch, sortKey, sortDir])

  const PAGE_SIZE = 15
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = useMemo(() => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [sorted, page])

  // Reset to page 0 when search/sort changes
  useEffect(() => { setPage(0) }, [deferredSearch, sortKey, sortDir])

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
          <h2 className="text-display md:text-hero font-black text-black mb-2">
            {t('hero.title')}
          </h2>
          <p className="text-subhead text-text-secondary max-w-[600px]">
            {t('hero.description')}
          </p>
        </div>
      </div>

      {/* Search + count bar */}
      <PageSection as="div" className="pt-6 pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-caption text-text-secondary">
            {t('itp_listing.showing', { count: sorted.length, total: rows.length })}
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('itp_listing.search_placeholder')}
            className="w-full max-w-[300px] border border-border-light rounded px-3 py-[7px] text-caption text-text-primary placeholder-text-muted focus:outline-none focus:border-text-secondary transition-colors input-animate"
          />
        </div>
      </PageSection>

      {/* Product table */}
      <PageSection as="div" className="pb-8">
          {loading ? (
            <div className="text-center py-20 text-text-muted text-body">{t('itp_listing.loading')}</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20 text-text-muted text-body">
              {searchQuery ? t('itp_listing.no_match') : t('itp_listing.no_funds')}
            </div>
          ) : (
            <>
            <div className="overflow-x-auto -mx-6 px-6 lg:-mx-0 lg:px-0">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface border-y border-border-light">
                    <th
                      onClick={() => handleSort('ticker')}
                      className="py-2.5 px-4 text-left text-label font-semibold uppercase tracking-[0.08em] text-text-secondary cursor-pointer select-none whitespace-nowrap hover:text-text-primary"
                    >
                      {t('itp_listing.ticker')}<SortArrow col="ticker" />
                    </th>
                    <th
                      onClick={() => handleSort('name')}
                      className="py-2.5 px-4 text-left text-label font-semibold uppercase tracking-[0.08em] text-text-secondary cursor-pointer select-none whitespace-nowrap hover:text-text-primary"
                    >
                      {t('itp_listing.fund')}<SortArrow col="name" />
                    </th>
                    <th className="py-2.5 px-2 w-8"></th>
                    <th
                      onClick={() => handleSort('nav')}
                      className="py-2.5 px-4 text-right text-label font-semibold uppercase tracking-[0.08em] text-text-secondary cursor-pointer select-none whitespace-nowrap hover:text-text-primary"
                    >
                      {t('itp_listing.nav')}<SortArrow col="nav" />
                    </th>
                    <th
                      onClick={() => handleSort('aum')}
                      className="py-2.5 px-4 text-right text-label font-semibold uppercase tracking-[0.08em] text-text-secondary cursor-pointer select-none whitespace-nowrap hover:text-text-primary"
                    >
                      {t('itp_listing.net_assets')}<SortArrow col="aum" />
                    </th>
                    <th
                      onClick={() => handleSort('shares')}
                      className="py-2.5 px-4 text-right text-label font-semibold uppercase tracking-[0.08em] text-text-secondary cursor-pointer select-none whitespace-nowrap hover:text-text-primary"
                    >
                      {t('itp_listing.shares_outstanding')}<SortArrow col="shares" />
                    </th>
                    <th className="py-2.5 px-4 text-right text-label font-semibold uppercase tracking-[0.08em] text-text-secondary whitespace-nowrap">
                      {t('itp_listing.trade')}
                    </th>
                  </tr>
                </thead>
                <tbody className="stagger">
                  {paginated.map((row, idx) => (
                    <tr
                      key={row.itpId}
                      id={`itp-card-${row.itpId}`}
                      className={`border-b border-border-light hover:bg-surface transition-colors animate-fade-up ${
                        idx % 2 === 1 ? 'bg-surface' : 'bg-white'
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
                      <td className="py-3 px-4 max-w-[240px] min-w-0 overflow-hidden">
                        <Link href={`/itp/${row.itpId}`}>
                          <span className="text-caption text-brand-dark hover:text-brand hover:underline transition-colors block truncate">
                            {row.name}
                          </span>
                        </Link>
                      </td>
                      {/* Chart button */}
                      <td className="py-3 px-2 w-8">
                        <button
                          onClick={() => setChartModal({ itpId: row.itpId, name: row.name })}
                          className="text-text-muted hover:text-text-primary transition-colors"
                          title={t('itp_listing.nav_chart')}
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
                        <span className="text-caption font-mono tabular-nums text-text-secondary">
                          {parseFloat(formatUnits(row.totalSupply, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      {/* Trade actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <WalletActionButton
                          onClick={() => setBuyModal(row.itpId)}
                          className="text-label font-semibold text-brand-dark hover:text-brand transition-colors press"
                        >
                          {t('itp_listing.buy')}
                        </WalletActionButton>
                        <span className="mx-1.5 text-border-light">|</span>
                        <WalletActionButton
                          onClick={() => setSellModal(row.itpId)}
                          className="text-label font-semibold text-text-secondary hover:text-brand transition-colors press"
                        >
                          {t('itp_listing.sell')}
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
                  {t('itp_listing.page_range', { start: page * PAGE_SIZE + 1, end: Math.min((page + 1) * PAGE_SIZE, sorted.length), total: sorted.length })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(0)}
                    disabled={page === 0}
                    className="px-2 py-1 text-label border border-border-light rounded hover:bg-surface disabled:opacity-30 disabled:cursor-default"
                  >
                    {t('itp_listing.first')}
                  </button>
                  <button
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 0}
                    className="px-2.5 py-1 text-label border border-border-light rounded hover:bg-surface disabled:opacity-30 disabled:cursor-default"
                  >
                    {t('itp_listing.prev')}
                  </button>
                  <span className="px-3 text-caption text-text-primary font-medium">
                    {t('itp_listing.page_info', { page: page + 1, total: totalPages })}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-2.5 py-1 text-label border border-border-light rounded hover:bg-surface disabled:opacity-30 disabled:cursor-default"
                  >
                    {t('itp_listing.next')}
                  </button>
                  <button
                    onClick={() => setPage(totalPages - 1)}
                    disabled={page >= totalPages - 1}
                    className="px-2 py-1 text-label border border-border-light rounded hover:bg-surface disabled:opacity-30 disabled:cursor-default"
                  >
                    {t('itp_listing.last')}
                  </button>
                </div>
              </div>
            )}
            </>
          )}
      </PageSection>

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
