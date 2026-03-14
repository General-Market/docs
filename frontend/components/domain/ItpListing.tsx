'use client'

import { useState, useEffect, useMemo } from 'react'
import { formatUnits } from 'viem'
import { BuyItpModal } from './BuyItpModal'
import { SellItpModal } from './SellItpModal'
import blacklistedItps from '@/lib/config/blacklisted-itps.json'
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
  assetCount: number
  active: boolean
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
    .filter(nav => !(Math.abs(nav.nav_per_share - 1.0) < 0.0001 && nav.aum_usd < 1))
    .map(nav => {
      const num = itpIdToNumber(nav.itp_id)
      return {
        itpId: nav.itp_id,
        name: nav.name || `ITP #${num}`,
        symbol: nav.symbol || `ITP${num}`,
        navPerShare: nav.nav_per_share,
        aum: nav.aum_usd,
        totalSupply: BigInt(nav.total_supply),
        assetCount: 0, // filled by SSE snapshot if available
        active: true,
      }
    })
}

function formatAum(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(2)}K`
  if (usd >= 1) return `$${usd.toFixed(2)}`
  return '—'
}

type SortKey = 'name' | 'symbol' | 'nav' | 'aum'
type SortDir = 'asc' | 'desc'

export function ItpListing({ onCreateClick, onLendingClick, onItpsLoaded }: ItpListingProps) {
  const t = useTranslations('markets')
  const tc = useTranslations('common')

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
      setSortDir(key === 'name' || key === 'symbol' ? 'asc' : 'desc')
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
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break
        case 'nav': cmp = a.navPerShare - b.navPerShare; break
        case 'aum': cmp = a.aum - b.aum; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, searchQuery, sortKey, sortDir])

  const SortHeader = ({ label, col, className }: { label: string; col: SortKey; className?: string }) => (
    <th
      onClick={() => handleSort(col)}
      className={`cursor-pointer select-none hover:text-black transition-colors ${className || ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === col && (
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
            {sortDir === 'asc'
              ? <path d="M6 3l4 5H2z" />
              : <path d="M6 9l4-5H2z" />
            }
          </svg>
        )}
      </span>
    </th>
  )

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

      {/* Toolbar */}
      <div className="py-4 px-6 lg:px-12 border-b border-border-light">
        <div className="max-w-site mx-auto flex items-center gap-4 flex-wrap">
          <span className="text-[13px] font-bold text-text-primary">
            {rows.length} {rows.length === 1 ? 'Fund' : 'Funds'}
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('filters.search_placeholder')}
            className="flex-1 min-w-0 md:min-w-[200px] max-w-[360px] border border-border-light rounded-md px-3.5 py-2 text-[13px] text-text-primary placeholder-text-muted focus:outline-none focus:border-black transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="px-6 lg:px-12 py-4">
        <div className="max-w-site mx-auto">
          {loading ? (
            <div className="text-center py-16 text-text-muted">{t('itp_card.loading')}</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 text-text-muted">
              {searchQuery ? 'No funds match your search.' : t('itp_card.no_itps')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted border-b-2 border-black">
                    <th className="py-3 pr-4 w-10 text-right">#</th>
                    <SortHeader label="Fund Name" col="name" className="py-3 pr-4" />
                    <SortHeader label="Ticker" col="symbol" className="py-3 pr-4" />
                    <SortHeader label="NAV" col="nav" className="py-3 pr-4 text-right" />
                    <SortHeader label="AUM" col="aum" className="py-3 pr-4 text-right" />
                    <th className="py-3 pr-4 text-right">Shares</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, idx) => (
                    <tr
                      key={row.itpId}
                      className="border-b border-border-light hover:bg-zinc-50 transition-colors group"
                    >
                      <td className="py-3.5 pr-4 text-right text-[12px] text-text-muted font-mono tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 pr-4">
                        <Link
                          href={`/itp/${row.itpId}`}
                          className="group-hover:text-brand transition-colors"
                        >
                          <span className="text-[14px] font-bold text-text-primary group-hover:text-brand">
                            {row.name}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="text-[13px] font-mono font-medium text-text-secondary">
                          ${row.symbol}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right">
                        <span className="text-[14px] font-bold font-mono tabular-nums text-text-primary">
                          ${row.navPerShare.toFixed(4)}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right">
                        <span className="text-[14px] font-bold font-mono tabular-nums text-text-primary">
                          {formatAum(row.aum)}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right">
                        <span className="text-[13px] font-mono tabular-nums text-text-secondary">
                          {parseFloat(formatUnits(row.totalSupply, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <WalletActionButton
                            onClick={() => setBuyModal(row.itpId)}
                            className="text-[11px] font-bold uppercase tracking-[0.04em] text-brand-dark hover:text-brand transition-colors"
                          >
                            Buy
                          </WalletActionButton>
                          <span className="text-border-light">|</span>
                          <WalletActionButton
                            onClick={() => setSellModal(row.itpId)}
                            className="text-[11px] font-bold uppercase tracking-[0.04em] text-text-secondary hover:text-brand transition-colors"
                          >
                            Sell
                          </WalletActionButton>
                          <span className="text-border-light">|</span>
                          <Link
                            href={`/itp/${row.itpId}`}
                            className="text-[11px] font-bold uppercase tracking-[0.04em] text-text-secondary hover:text-brand transition-colors"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
