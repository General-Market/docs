'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { formatUnits } from 'viem'
import { BuyItpModal } from './BuyItpModal'
import { SellItpModal } from './SellItpModal'
import { ChartModal } from './ChartModal'
import { RebalanceModal } from './RebalanceModal'
import { useItpNav } from '@/hooks/useItpNav'
import { useItpMetadata } from '@/hooks/useItpMetadata'
import { useDeployerName } from '@/hooks/useDeployerName'
import blacklistedItps from '@/lib/config/blacklisted-itps.json'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { indexL3 } from '@/lib/wagmi'
import { useSSENav, type NavSnapshot } from '@/hooks/useSSE'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'

interface ItpInfo {
  id: string
  itpId?: string
  nonce?: number
  admin: string
  name: string
  symbol: string
  createdAt: number
  source: 'index' | 'bridge'
  completed: boolean
  orbitItpId?: string
  settlementAddress?: string
  totalValue?: bigint
  totalSupply?: bigint
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

const PAGE_SIZE = 9

/**
 * Derive ITP number from hex itp_id (e.g. "0x000...0001" -> 1).
 */
function itpIdToNumber(itpId: string): number {
  try {
    const hex = itpId.startsWith('0x') ? itpId.slice(2) : itpId
    return parseInt(hex, 16) || 0
  } catch {
    return 0
  }
}

/**
 * Convert SSE NavSnapshot[] into ItpInfo[] for the listing.
 */
function navSnapshotsToItpInfos(navList: NavSnapshot[]): ItpInfo[] {
  const blacklistSet = new Set((blacklistedItps as string[]).map(id => id.toLowerCase()))

  const itps: ItpInfo[] = navList
    .filter(nav => !blacklistSet.has(nav.itp_id.toLowerCase()))
    // Hide ITPs stuck at exactly $1.0000 with no real AUM — these are empty test artifacts
    .filter(nav => !(Math.abs(nav.nav_per_share - 1.0) < 0.0001 && nav.aum_usd < 1))
    .map(nav => {
      const num = itpIdToNumber(nav.itp_id)
      return {
        id: nav.itp_id,
        itpId: nav.itp_id,
        admin: '',
        name: nav.name || `ITP #${num}`,
        symbol: nav.symbol || `ITP${num}`,
        createdAt: 0,
        source: 'index' as const,
        completed: true,
        settlementAddress: nav.settlement_address ?? undefined,
        totalValue: BigInt(Math.round(nav.aum_usd * 1e18)),
        totalSupply: BigInt(nav.total_supply),
      }
    })

  return itps
}

type SortMode = 'aum_desc' | 'aum_asc' | 'nav_desc' | 'name_az'
type FilterMode = 'all' | 'active' | 'pending'

export function ItpListing({ onCreateClick, onLendingClick, onItpsLoaded }: ItpListingProps) {
  const t = useTranslations('markets')
  const tc = useTranslations('common')
  const { isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  const injectedConnector = connectors.find(c => c.id === 'injected')

  const handleWalletClick = async () => {
    if (isConnected) {
      disconnect()
    } else if (injectedConnector) {
      const chainIdHex = `0x${indexL3.id.toString(16)}`
      const provider = (window as any).ethereum
      if (provider) {
        try { await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: chainIdHex, chainName: indexL3.name, nativeCurrency: indexL3.nativeCurrency, rpcUrls: [indexL3.rpcUrls.default.http[0]] }] }) } catch {}
        try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] }) } catch {}
      }
      connect({ connector: injectedConnector, chainId: indexL3.id })
    }
  }

  // ── SSE-driven ITP list ──
  const navList = useSSENav()
  const loading = navList.length === 0
  const [buyModal, setBuyModal] = useState<{ itpId: string } | null>(null)
  const [sellModal, setSellModal] = useState<{ itpId: string } | null>(null)
  const [chartModalItp, setChartModalItp] = useState<{ itpId: string; name: string } | null>(null)
  const [rebalanceModalItp, setRebalanceModalItp] = useState<{ itpId: string; name: string } | null>(null)

  // Filter / search / sort / pagination state
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('aum_desc')
  const [page, setPage] = useState(0)

  // Derive ITP list from SSE nav snapshots
  const itps = useMemo(() => navSnapshotsToItpInfos(navList), [navList])

  // Notify parent of loaded ITPs
  useEffect(() => {
    if (onItpsLoaded && itps.length > 0) {
      onItpsLoaded(
        itps
          .filter(itp => itp.itpId)
          .map(itp => ({ itpId: itp.itpId!, name: itp.name, symbol: itp.symbol }))
      )
    }
  }, [itps, onItpsLoaded])

  // Apply filters
  const filtered = useMemo(() => {
    let list = itps

    // Filter mode
    if (filterMode === 'active') {
      list = list.filter(i => i.source === 'index' || i.completed)
    } else if (filterMode === 'pending') {
      list = list.filter(i => i.source !== 'index' && !i.completed)
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.symbol.toLowerCase().includes(q)
      )
    }

    // Sort
    list = [...list].sort((a, b) => {
      switch (sortMode) {
        case 'aum_desc':
          return Number(b.totalValue || 0n) - Number(a.totalValue || 0n)
        case 'aum_asc':
          return Number(a.totalValue || 0n) - Number(b.totalValue || 0n)
        case 'nav_desc':
          return Number(b.totalValue || 0n) - Number(a.totalValue || 0n) // NAV sort uses per-card hook, approximate with AUM
        case 'name_az':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return list
  }, [itps, filterMode, searchQuery, sortMode])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [filterMode, searchQuery, sortMode])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const displayedItps = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const activeCount = itps.filter(i => i.source === 'index' || i.completed).length
  const pendingCount = itps.filter(i => i.source !== 'index' && !i.completed).length

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

      {/* Filter Bar */}
      <div className="py-5 px-6 lg:px-12 border-b border-border-light">
        <div className="max-w-site mx-auto flex items-center gap-3 flex-wrap">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-text-primary mr-1">{t('filters.label')}</span>
          <button
            onClick={() => setFilterMode('all')}
            className={`filter-pill ${filterMode === 'all' ? 'active' : ''}`}
          >
            {t('filters.all', { count: itps.length })}
          </button>
          <button
            onClick={() => setFilterMode('active')}
            className={`filter-pill ${filterMode === 'active' ? 'active' : ''}`}
          >
            {t('filters.active', { count: activeCount })}
          </button>
          <button
            onClick={() => setFilterMode('pending')}
            className={`filter-pill ${filterMode === 'pending' ? 'active' : ''}`}
          >
            {t('filters.pending', { count: pendingCount })}
          </button>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('filters.search_placeholder')}
            className="flex-1 min-w-0 md:min-w-[200px] max-w-[320px] border-2 border-border-light rounded-full px-4 py-[9px] text-[13px] text-text-primary placeholder-text-muted focus:outline-none focus:border-black transition-colors"
          />
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="ml-auto border border-border-light rounded-md px-3.5 py-2 text-[12px] font-medium text-text-secondary bg-white focus:outline-none cursor-pointer"
          >
            <option value="aum_desc">{t('filters.sort_aum_desc')}</option>
            <option value="aum_asc">{t('filters.sort_aum_asc')}</option>
            <option value="nav_desc">{t('filters.sort_newest')}</option>
            <option value="name_az">{t('filters.sort_name_az')}</option>
          </select>
        </div>
      </div>

      {/* Section Bar */}
      <div className="px-6 lg:px-12">
        <div className="max-w-site mx-auto">
          <div className="section-bar">
            <div>
              <div className="section-bar-title">{t('section_bar.title')}</div>
              <div className="section-bar-value">{t('section_bar.subtitle')}</div>
            </div>
            <div className="section-bar-right">
              {filtered.length === 0
                ? 'No results'
                : `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length}`
              }
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted">{t('itp_card.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-muted mb-4">
            {searchQuery ? 'No ITPs match your search.' : t('itp_card.no_itps')}
          </p>
        </div>
      ) : (
        <>
          {/* Fund Cards Grid */}
          <div className="px-6 lg:px-12 py-6">
            <div className="max-w-site mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border border-border-light">
                {displayedItps.map((itp, idx) => (
                  <ItpCard
                    key={itp.id}
                    itp={itp}
                    index={idx}
                    onBuy={() => {
                      if (!itp.itpId) return
                      setBuyModal({ itpId: itp.itpId })
                    }}
                    onSell={() => {
                      if (!itp.itpId) return
                      setSellModal({ itpId: itp.itpId })
                    }}
                    onChart={() => itp.itpId && setChartModalItp({ itpId: itp.itpId, name: itp.name || `ITP #${itp.nonce ?? itp.id}` })}
                    onRebalance={() => itp.itpId && setRebalanceModalItp({ itpId: itp.itpId, name: itp.name || `ITP #${itp.nonce ?? itp.id}` })}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pb-8 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 border border-border-light rounded-md text-[13px] font-medium text-text-secondary hover:border-black hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-9 h-9 rounded-md text-[13px] font-bold transition-colors ${
                    i === page
                      ? 'bg-black text-white'
                      : 'border border-border-light text-text-secondary hover:border-black hover:text-black'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 border border-border-light rounded-md text-[13px] font-medium text-text-secondary hover:border-black hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {buyModal && (
        <BuyItpModal itpId={buyModal.itpId} onClose={() => setBuyModal(null)} />
      )}
      {sellModal && (
        <SellItpModal itpId={sellModal.itpId} onClose={() => setSellModal(null)} />
      )}
      {chartModalItp && (
        <ChartModal itpId={chartModalItp.itpId} itpName={chartModalItp.name} onClose={() => setChartModalItp(null)} />
      )}
      {rebalanceModalItp && (
        <RebalanceModal itpId={rebalanceModalItp.itpId} itpName={rebalanceModalItp.name} onClose={() => setRebalanceModalItp(null)} />
      )}
    </>
  )
}

interface ItpCardProps {
  itp: ItpInfo
  index: number
  onBuy: () => void
  onSell: () => void
  onChart: () => void
  onRebalance: () => void
}

function ItpCard({ itp, index, onBuy, onSell, onChart, onRebalance }: ItpCardProps) {
  const t = useTranslations('markets')
  const tc = useTranslations('common')

  const { metadata } = useItpMetadata(itp.itpId as `0x${string}` | undefined)
  const { name: deployerName } = useDeployerName(itp.admin as `0x${string}` | undefined)
  const { navPerShare, totalAssetCount, isLoading: isNavLoading } = useItpNav(itp.itpId)

  const isActive = itp.source === 'index' || itp.completed

  return (
    <div className="relative bg-white border-r border-b border-border-light flex flex-col">
      {/* Card header — links to detail page */}
      <Link href={`/itp/${itp.itpId}`} className="block group">
        <div className="aspect-video bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex flex-col items-center justify-center px-6 text-center cursor-pointer relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <h3 className="text-[22px] font-extrabold text-white tracking-[-0.02em] leading-tight relative z-10">
            {itp.name || `ITP #${itp.nonce ?? itp.id}`}
          </h3>
          <p className="text-[13px] font-mono text-white/50 mt-1.5 relative z-10">
            ${itp.symbol || 'N/A'}
          </p>
          <span className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/40 group-hover:text-white/70 transition-colors relative z-10 flex items-center gap-1.5">
            View Details
            <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </Link>

      {/* Card body */}
      <div className="px-5 py-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-[16px] font-extrabold text-black tracking-[-0.01em]">{itp.name || `ITP #${itp.nonce ?? itp.id}`}</h3>
            {deployerName && <p className="text-[11px] text-text-muted">{t('itp_card.by', { name: deployerName })}</p>}
            <p className="text-[12px] text-text-muted font-mono font-medium">${itp.symbol || 'N/A'}</p>
            {metadata?.description && (
              <p className="text-[11px] text-text-secondary mt-1 line-clamp-2">{metadata.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className={`w-[6px] h-[6px] rounded-full ${isActive ? 'bg-color-up' : 'bg-text-muted'}`} />
            <span className={`text-[11px] font-semibold ${isActive ? 'text-color-up' : 'text-text-muted'}`}>{isActive ? tc('status.active') : tc('status.pending')}</span>
          </div>
        </div>

        {/* Metrics Row */}
        {isActive && (
          <div className="grid grid-cols-3 border-t border-b border-border-light -mx-5 px-5">
            <div className="py-2.5 pr-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">{t('itp_card.nav_per_share')}</div>
              {isNavLoading || navPerShare === 0 ? (
                <span className="text-sm text-text-muted animate-pulse">...</span>
              ) : (
                <span className="text-[15px] font-bold text-black font-mono tabular-nums">${navPerShare.toFixed(4)}</span>
              )}
            </div>
            <div className="py-2.5 px-3 border-l border-border-light">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">{t('itp_card.assets')}</div>
              <span className="text-[15px] font-bold text-black font-mono tabular-nums">{totalAssetCount || '—'}</span>
            </div>
            <div className="py-2.5 pl-3 border-l border-border-light">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">TVL</div>
              <span className="text-[15px] font-bold text-black font-mono tabular-nums">
                {itp.totalValue && itp.totalValue > 0n
                  ? `$${parseFloat(formatUnits(itp.totalValue, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '—'}
              </span>
            </div>
          </div>
        )}

        {/* Action links */}
        {itp.itpId && isActive && (
          <div className="pt-3 mt-auto flex items-center flex-wrap">
            <WalletActionButton onClick={onBuy} className="text-[12px] font-bold uppercase tracking-[0.04em] text-brand-dark hover:text-brand transition-colors py-1.5">{t('itp_card.buy')}</WalletActionButton>
            <span className="mx-2.5 text-border-light font-normal">|</span>
            <WalletActionButton onClick={onSell} className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:text-brand transition-colors py-1.5">{t('itp_card.sell')}</WalletActionButton>
            <span className="mx-2.5 text-border-light font-normal">|</span>
            <button onClick={onChart} className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:text-brand transition-colors py-1.5">{t('itp_card.chart')}</button>
            <span className="mx-2.5 text-border-light font-normal">|</span>
            <WalletActionButton onClick={onRebalance} className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:text-brand transition-colors py-1.5">{t('itp_card.rebalance')}</WalletActionButton>
          </div>
        )}

        {/* Pending status */}
        {itp.itpId && !isActive && (
          <div className="pt-2 text-[11px] text-text-muted uppercase tracking-wider">{t('itp_card.pending_fill')}</div>
        )}
      </div>
    </div>
  )
}
