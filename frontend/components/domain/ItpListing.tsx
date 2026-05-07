'use client'

import { useState, useEffect, useMemo, useDeferredValue, type CSSProperties } from 'react'
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
        name: override?.name || nav.name || `DTF #${num}`,
        symbol: override?.ticker || nav.symbol || `DTF${num}`,
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

// ── Apple style atoms ────────────────────────────────────────────────────────
const colHeader: CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-loose)',
  textTransform: 'uppercase',
  color: 'var(--apple-text-tertiary)',
  padding: '14px 16px',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  background: 'transparent',
  borderBottom: '1px solid var(--apple-line)',
}

const cellBase: CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 14,
  letterSpacing: 'var(--apple-track-tight)',
  color: 'var(--apple-text)',
  padding: '14px 16px',
  borderBottom: '1px solid var(--apple-line)',
  verticalAlign: 'middle',
}

const symbolPill: CSSProperties = {
  display: 'inline-block',
  padding: '3px 8px',
  background: 'var(--apple-text)',
  color: '#ffffff',
  borderRadius: 6,
  fontFamily: '"SF Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-loose)',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
}

const ctaPrimary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px 14px',
  background: '#0071e3',
  color: '#ffffff',
  fontFamily: 'var(--apple-font-text)',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-tight)',
  borderRadius: 980,
  border: 'none',
  cursor: 'pointer',
  transition: 'background 200ms var(--apple-ease-default), opacity 200ms var(--apple-ease-default)',
}

const ctaSecondary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px 14px',
  background: 'var(--apple-panel)',
  color: 'var(--apple-text)',
  fontFamily: 'var(--apple-font-text)',
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: 'var(--apple-track-tight)',
  borderRadius: 980,
  border: '1px solid var(--apple-line)',
  cursor: 'pointer',
  transition: 'background 200ms var(--apple-ease-default)',
}

const pagerBtn: CSSProperties = {
  padding: '6px 12px',
  background: 'var(--apple-panel)',
  color: 'var(--apple-text)',
  fontFamily: 'var(--apple-font-text)',
  fontSize: 13,
  letterSpacing: 'var(--apple-track-tight)',
  borderRadius: 8,
  border: '1px solid var(--apple-line)',
  cursor: 'pointer',
  transition: 'background 200ms var(--apple-ease-default)',
}

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
            vault_address: d.vault_address || null,
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
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)

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
      <svg
        width="9"
        height="9"
        viewBox="0 0 10 10"
        fill="currentColor"
        style={{ display: 'inline-block', marginLeft: 4, verticalAlign: 'baseline' }}
      >
        {sortDir === 'asc'
          ? <path d="M5 2l4 6H1z" />
          : <path d="M5 8l4-6H1z" />
        }
      </svg>
    )
  }

  const sortableHeader = (key: SortKey, align: 'left' | 'right' = 'left'): CSSProperties => ({
    ...colHeader,
    textAlign: align,
    cursor: 'pointer',
    color: sortKey === key ? 'var(--apple-text-secondary)' : 'var(--apple-text-tertiary)',
  })

  return (
    <>
      {/* Hero Band — kept as the global hero-band class, retypeset with Apple tokens */}
      <div className="hero-band">
        <div className="hero-band-inner">
          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-loose)',
              textTransform: 'uppercase',
              color: 'var(--apple-text-tertiary)',
              marginBottom: 8,
            }}
          >
            {t('hero.label')}
          </div>
          <h2
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 'clamp(32px, 5vw, 48px)',
              lineHeight: 1.0714,
              letterSpacing: 'var(--apple-track-tighter)',
              fontWeight: 600,
              color: 'var(--apple-text)',
              margin: '0 0 12px',
            }}
          >
            {t('hero.title')}
          </h2>
          <p
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 'var(--apple-fs-21)',
              lineHeight: 1.1904,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text-secondary)',
              maxWidth: 600,
              margin: 0,
            }}
          >
            {t('hero.description')}
          </p>
        </div>
      </div>

      {/* Search + count bar */}
      <div className="px-6 lg:px-12 pt-6 pb-3">
        <div className="max-w-site mx-auto">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              padding: '14px 16px',
              background: 'var(--apple-panel)',
              border: '1px solid var(--apple-line)',
              borderRadius: 12,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 13,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text-secondary)',
              }}
            >
              Showing{' '}
              <strong style={{ color: 'var(--apple-text)', fontWeight: 600 }}>{sorted.length}</strong>{' '}
              of {rows.length} total funds
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search by fund name or ticker..."
              style={{
                width: '100%',
                maxWidth: 320,
                padding: '8px 12px',
                fontFamily: 'var(--apple-font-text)',
                fontSize: 14,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text)',
                background: 'var(--apple-panel)',
                border: `1px solid ${searchFocused ? '#0071e3' : 'var(--apple-line)'}`,
                borderRadius: 12,
                outline: 'none',
                boxShadow: searchFocused ? '0 0 0 3px rgba(0,113,227,0.16)' : 'none',
                transition: 'border-color 200ms var(--apple-ease-default), box-shadow 200ms var(--apple-ease-default)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Product table */}
      <div className="px-6 lg:px-12 pb-8">
        <div className="max-w-site mx-auto">
          {loading ? (
            <div
              style={{
                background: 'var(--apple-panel)',
                border: '1px solid var(--apple-line)',
                borderRadius: 12,
                padding: '80px 24px',
                textAlign: 'center',
                fontFamily: 'var(--apple-font-text)',
                fontSize: 14,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text-tertiary)',
              }}
            >
              Loading funds...
            </div>
          ) : sorted.length === 0 ? (
            <div
              style={{
                background: 'var(--apple-panel)',
                border: '1px solid var(--apple-line)',
                borderRadius: 12,
                padding: '80px 24px',
                textAlign: 'center',
                fontFamily: 'var(--apple-font-text)',
                fontSize: 14,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text-tertiary)',
              }}
            >
              {searchQuery ? 'No funds match your search.' : 'No funds available.'}
            </div>
          ) : (
            <>
              <div
                style={{
                  background: 'var(--apple-panel)',
                  border: '1px solid var(--apple-line)',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <div className="overflow-x-auto">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th onClick={() => handleSort('ticker')} style={sortableHeader('ticker', 'left')}>
                          Ticker<SortArrow col="ticker" />
                        </th>
                        <th onClick={() => handleSort('name')} style={sortableHeader('name', 'left')}>
                          Name<SortArrow col="name" />
                        </th>
                        <th style={{ ...colHeader, padding: '14px 4px', width: 32 }}></th>
                        <th onClick={() => handleSort('nav')} style={sortableHeader('nav', 'right')}>
                          NAV<SortArrow col="nav" />
                        </th>
                        <th onClick={() => handleSort('aum')} style={sortableHeader('aum', 'right')}>
                          Net Assets<SortArrow col="aum" />
                        </th>
                        <th onClick={() => handleSort('shares')} style={sortableHeader('shares', 'right')}>
                          Shares Outstanding<SortArrow col="shares" />
                        </th>
                        <th style={{ ...colHeader, textAlign: 'right' }}>
                          Trade
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((row, idx) => {
                        const isLast = idx === paginated.length - 1
                        const isHover = hoveredRow === row.itpId
                        const rowBg = isHover ? 'rgba(0,0,0,0.03)' : 'transparent'
                        const cellWithBg = (extra?: CSSProperties): CSSProperties => ({
                          ...cellBase,
                          background: rowBg,
                          borderBottom: isLast ? 'none' : '1px solid var(--apple-line)',
                          transition: 'background 160ms var(--apple-ease-default)',
                          ...extra,
                        })
                        const numericCellWithBg = (extra?: CSSProperties): CSSProperties => ({
                          ...cellWithBg(),
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          ...extra,
                        })
                        return (
                          <tr
                            key={row.itpId}
                            id={`itp-card-${row.itpId}`}
                            onMouseEnter={() => setHoveredRow(row.itpId)}
                            onMouseLeave={() => setHoveredRow(null)}
                          >
                            {/* Ticker pill */}
                            <td style={cellWithBg()}>
                              <Link href={`/itp/${row.itpId}`} style={{ textDecoration: 'none' }}>
                                <span style={symbolPill}>{row.symbol}</span>
                              </Link>
                            </td>
                            {/* Name — Apple blue link */}
                            <td style={cellWithBg()}>
                              <Link href={`/itp/${row.itpId}`} style={{ textDecoration: 'none' }}>
                                <span
                                  style={{
                                    fontFamily: 'var(--apple-font-text)',
                                    fontSize: 14,
                                    letterSpacing: 'var(--apple-track-tight)',
                                    color: '#0071e3',
                                    transition: 'color 160ms var(--apple-ease-default)',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = '#0066cc' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = '#0071e3' }}
                                >
                                  {row.name}
                                </span>
                              </Link>
                            </td>
                            {/* Chart button — Apple blue sparkline icon */}
                            <td style={cellWithBg({ padding: '14px 4px', width: 32 })}>
                              <button
                                onClick={() => setChartModal({ itpId: row.itpId, name: row.name })}
                                title="NAV chart"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  padding: 4,
                                  cursor: 'pointer',
                                  color: 'var(--apple-text-tertiary)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: 6,
                                  transition: 'color 160ms var(--apple-ease-default), background 160ms var(--apple-ease-default)',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = '#0071e3' }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--apple-text-tertiary)' }}
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="1 12 4 7 8 9 11 4 15 6" />
                                </svg>
                              </button>
                            </td>
                            {/* NAV */}
                            <td style={numericCellWithBg()}>
                              ${row.navPerShare.toFixed(4)}
                            </td>
                            {/* Net Assets */}
                            <td style={numericCellWithBg()}>
                              {formatNetAssets(row.aum)}
                            </td>
                            {/* Shares Outstanding */}
                            <td style={numericCellWithBg({ color: 'var(--apple-text-secondary)' })}>
                              {parseFloat(formatUnits(row.totalSupply, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                            {/* Trade actions */}
                            <td style={numericCellWithBg({ whiteSpace: 'nowrap' })}>
                              <span style={{ display: 'inline-flex', gap: 8, justifyContent: 'flex-end' }}>
                                <WalletActionButton
                                  onClick={() => setBuyModal(row.itpId)}
                                  style={ctaPrimary}
                                >
                                  Buy
                                </WalletActionButton>
                                <WalletActionButton
                                  onClick={() => setSellModal(row.itpId)}
                                  style={ctaSecondary}
                                >
                                  Sell
                                </WalletActionButton>
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 16,
                    padding: '0 4px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--apple-font-text)',
                      fontSize: 12,
                      letterSpacing: 'var(--apple-track-tight)',
                      color: 'var(--apple-text-tertiary)',
                    }}
                  >
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => setPage(0)}
                      disabled={page === 0}
                      style={{ ...pagerBtn, opacity: page === 0 ? 0.3 : 1, cursor: page === 0 ? 'default' : 'pointer' }}
                    >
                      First
                    </button>
                    <button
                      onClick={() => setPage(p => p - 1)}
                      disabled={page === 0}
                      style={{ ...pagerBtn, opacity: page === 0 ? 0.3 : 1, cursor: page === 0 ? 'default' : 'pointer' }}
                    >
                      Prev
                    </button>
                    <span
                      style={{
                        padding: '0 10px',
                        fontFamily: 'var(--apple-font-text)',
                        fontSize: 13,
                        letterSpacing: 'var(--apple-track-tight)',
                        color: 'var(--apple-text)',
                        fontWeight: 500,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {page + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= totalPages - 1}
                      style={{ ...pagerBtn, opacity: page >= totalPages - 1 ? 0.3 : 1, cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setPage(totalPages - 1)}
                      disabled={page >= totalPages - 1}
                      style={{ ...pagerBtn, opacity: page >= totalPages - 1 ? 0.3 : 1, cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}
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
