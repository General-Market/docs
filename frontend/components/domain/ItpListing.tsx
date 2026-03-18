'use client'

import { useState, useEffect, useMemo } from 'react'
import { formatUnits } from 'viem'
import { BuyItpModal } from './BuyItpModal'
import { SellItpModal } from './SellItpModal'
import blacklistedItps from '@/lib/config/blacklisted-itps.json'
import itpIdNames from '@/lib/itp-id-names.json'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { useSSENav, type NavSnapshot } from '@/hooks/useSSE'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'

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

  const navList = useSSENav()
  const loading = navList.length === 0
  const [buyModal, setBuyModal] = useState<string | null>(null)
  const [sellModal, setSellModal] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
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
  }, [rows, searchQuery, sortKey, sortDir])

  const PAGE_SIZE = 15
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = useMemo(() => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [sorted, page])

  // Reset to page 0 when search/sort changes
  useEffect(() => { setPage(0) }, [searchQuery, sortKey, sortDir])

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
          <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-2">
            {t('hero.label')}
          </div>
          <h2 className="text-[28px] md:text-[42px] font-black tracking-[-0.03em] text-black leading-[1.1] mb-2">
            {t('hero.title')}
          </h2>
          <p className="text-[16px] text-text-secondary max-w-[600px]">
            {t('hero.description')}
          </p>
        </div>
      </div>

      {/* Search + count bar */}
      <div className="px-6 lg:px-12 pt-6 pb-3">
        <div className="max-w-site mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="text-[13px] text-text-secondary">
            Showing <strong className="text-text-primary">{sorted.length}</strong> of {rows.length} total funds
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by fund name or ticker..."
            className="w-full max-w-[300px] border border-[#ccc] rounded px-3 py-[7px] text-[13px] text-text-primary placeholder-[#aaa] focus:outline-none focus:border-[#666] transition-colors"
          />
        </div>
      </div>

      {/* Product table */}
      <div className="px-6 lg:px-12 pb-8">
        <div className="max-w-site mx-auto">
          {loading ? (
            <div className="text-center py-20 text-text-muted text-[14px]">Loading funds...</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20 text-text-muted text-[14px]">
              {searchQuery ? 'No funds match your search.' : 'No funds available.'}
            </div>
          ) : (
            <>
            <div className="overflow-x-auto -mx-6 px-6 lg:-mx-0 lg:px-0">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f5f5] border-y border-[#ddd]">
                    <th
                      onClick={() => handleSort('ticker')}
                      className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#555] cursor-pointer select-none whitespace-nowrap hover:text-[#222]"
                    >
                      Ticker<SortArrow col="ticker" />
                    </th>
                    <th
                      onClick={() => handleSort('name')}
                      className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#555] cursor-pointer select-none whitespace-nowrap hover:text-[#222]"
                    >
                      Name<SortArrow col="name" />
                    </th>
                    <th
                      onClick={() => handleSort('nav')}
                      className="py-2.5 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-[#555] cursor-pointer select-none whitespace-nowrap hover:text-[#222]"
                    >
                      NAV<SortArrow col="nav" />
                    </th>
                    <th
                      onClick={() => handleSort('aum')}
                      className="py-2.5 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-[#555] cursor-pointer select-none whitespace-nowrap hover:text-[#222]"
                    >
                      Net Assets<SortArrow col="aum" />
                    </th>
                    <th
                      onClick={() => handleSort('shares')}
                      className="py-2.5 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-[#555] cursor-pointer select-none whitespace-nowrap hover:text-[#222]"
                    >
                      Shares Outstanding<SortArrow col="shares" />
                    </th>
                    <th className="py-2.5 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-[#555] whitespace-nowrap">
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
                          <span className="text-[13px] font-bold text-text-primary hover:text-brand transition-colors">
                            {row.symbol}
                          </span>
                        </Link>
                      </td>
                      {/* Name — brand-colored link like iShares */}
                      <td className="py-3 px-4">
                        <Link href={`/itp/${row.itpId}`}>
                          <span className="text-[13px] text-brand-dark hover:text-brand hover:underline transition-colors">
                            {row.name}
                          </span>
                        </Link>
                      </td>
                      {/* NAV */}
                      <td className="py-3 px-4 text-right">
                        <span className="text-[13px] font-mono tabular-nums text-text-primary">
                          ${row.navPerShare.toFixed(4)}
                        </span>
                      </td>
                      {/* Net Assets */}
                      <td className="py-3 px-4 text-right">
                        <span className="text-[13px] font-mono tabular-nums text-text-primary">
                          {formatNetAssets(row.aum)}
                        </span>
                      </td>
                      {/* Shares Outstanding */}
                      <td className="py-3 px-4 text-right">
                        <span className="text-[13px] font-mono tabular-nums text-[#666]">
                          {parseFloat(formatUnits(row.totalSupply, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      {/* Trade actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <WalletActionButton
                          onClick={() => setBuyModal(row.itpId)}
                          className="text-[11px] font-semibold text-brand-dark hover:text-brand transition-colors"
                        >
                          Buy
                        </WalletActionButton>
                        <span className="mx-1.5 text-[#ddd]">|</span>
                        <WalletActionButton
                          onClick={() => setSellModal(row.itpId)}
                          className="text-[11px] font-semibold text-[#666] hover:text-brand transition-colors"
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
                <span className="text-[12px] text-text-muted">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(0)}
                    disabled={page === 0}
                    className="px-2 py-1 text-[11px] border border-[#ddd] rounded hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-default"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 0}
                    className="px-2.5 py-1 text-[11px] border border-[#ddd] rounded hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-default"
                  >
                    Prev
                  </button>
                  <span className="px-3 text-[12px] text-text-primary font-medium">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-2.5 py-1 text-[11px] border border-[#ddd] rounded hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-default"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setPage(totalPages - 1)}
                    disabled={page >= totalPages - 1}
                    className="px-2 py-1 text-[11px] border border-[#ddd] rounded hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-default"
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

      {buyModal && (
        <BuyItpModal itpId={buyModal} onClose={() => setBuyModal(null)} />
      )}
      {sellModal && (
        <SellItpModal itpId={sellModal} onClose={() => setSellModal(null)} />
      )}
    </>
  )
}
