'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useTranslations } from 'next-intl'
import { formatUnits } from 'viem'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { LendingStatsBanner } from './LendingStatsBanner'
import { MarketsTable, type EnrichedMarket } from './MarketsTable'
import { MarketActionPanel, type SelectedMarket } from './MarketActionPanel'
import { VaultSupplySection } from './VaultSupplySection'
import { useLendingData } from '@/hooks/useLendingData'
import { useMorphoPosition } from '@/hooks/useMorphoPosition'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

type FilterMode = 'all' | 'positions' | 'liquidity'

const ErrorFallback = (
  <div className="bg-surface-down border border-color-down/30 rounded-lg p-6 text-center">
    <h3 className="text-color-down font-bold mb-2">Module failed to load</h3>
    <p className="text-text-muted text-sm">Refresh the page to retry.</p>
  </div>
)

function Bone({ w = 'w-16' }: { w?: string }) {
  return <div className={`${w} h-5 bg-border-light rounded animate-pulse`} />
}

export function LendingPage() {
  const t = useTranslations('lending')
  const { isConnected } = useAccount()

  // ── Centralized data ──
  const { enrichedMarkets, eligibleCollateral, isLoading } = useLendingData()

  // ── Selection state ──
  const [selectedMarket, setSelectedMarket] = useState<MorphoMarketEntry | null>(null)
  const [selectedCollateralToken, setSelectedCollateralToken] = useState<string | null>(null)

  // ── Search + filter ──
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')

  // ── Single useMorphoPosition call for the selected market ──
  const {
    position: morphoPosition,
    isLoading: posLoading,
    refetch: refetchPosition,
  } = useMorphoPosition(selectedMarket ?? undefined)

  // ── Map hook EnrichedMarkets → table EnrichedMarkets ──
  const tableRows = useMemo<EnrichedMarket[]>(() => {
    return enrichedMarkets.map(m => {
      const collateralRaw = parseFloat(formatUnits(BigInt(m.collateralAmount), 18))
      const collateralUsd = collateralRaw * m.navPerShare
      // debtAmount from SSE is placeholder '0' — real debt only via useMorphoPosition
      const debtRaw = parseFloat(formatUnits(BigInt(m.debtAmount), 18))

      const userBalRaw = parseFloat(formatUnits(BigInt(m.userBalanceWei), 18))
      const userBalUsd = userBalRaw * m.navPerShare

      return {
        collateralToken: m.collateralToken,
        name: m.name,
        symbol: m.symbol,
        itpId: m.itpId,
        settlementAddress: m.settlementAddress,
        nav: m.navPerShare,
        borrowApy: m.borrowApy,
        available: m.available,
        lltv: m.lltv,
        collateral: collateralUsd,
        debt: debtRaw,
        userBalance: userBalUsd,
        market: m.market,
      }
    })
  }, [enrichedMarkets])

  // ── Filtered rows ──
  const filteredRows = useMemo(() => {
    let rows = tableRows

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(
        r => r.name.toLowerCase().includes(q) || r.symbol.toLowerCase().includes(q)
      )
    }

    if (filter === 'positions') {
      rows = rows.filter(r => r.collateral > 0 || r.debt > 0)
    } else if (filter === 'liquidity') {
      rows = rows.filter(r => r.available > 0)
    }

    return rows
  }, [tableRows, search, filter])

  // ── Handlers ──
  const handleSelectRow = useCallback((row: EnrichedMarket) => {
    setSelectedCollateralToken(row.collateralToken)
    setSelectedMarket(row.market)
  }, [])

  // ── Build SelectedMarket for the action panel ──
  const selectedMarketInfo = useMemo<SelectedMarket | null>(() => {
    if (!selectedCollateralToken || !selectedMarket) return null
    const row = tableRows.find(
      r => r.collateralToken.toLowerCase() === selectedCollateralToken.toLowerCase()
    )
    if (!row) return null
    return {
      name: row.name,
      symbol: row.symbol,
      itpId: row.itpId,
      collateralToken: row.collateralToken,
      market: row.market,
    }
  }, [selectedCollateralToken, selectedMarket, tableRows])

  // ── Aggregate position stats for the dashboard ──
  const positionStats = useMemo(() => {
    const withPositions = enrichedMarkets.filter(m => m.hasPosition)
    if (withPositions.length === 0) return null

    let totalCollateralUsd = 0
    let weightedBorrowApy = 0
    let posWithDebt = 0
    let lowestHealth = Infinity

    for (const m of withPositions) {
      const collateral = parseFloat(formatUnits(BigInt(m.collateralAmount), 18))
      totalCollateralUsd += collateral * m.navPerShare

      const borrowShares = BigInt(m.borrowShares)
      if (borrowShares > 0n) {
        weightedBorrowApy += m.borrowApy
        posWithDebt += 1
      }

      if (m.healthFactor < lowestHealth) {
        lowestHealth = m.healthFactor
      }
    }

    const avgBorrowApy = posWithDebt > 0 ? weightedBorrowApy / posWithDebt : 0

    return {
      totalCollateralUsd,
      avgBorrowApy,
      lowestHealthFactor: lowestHealth,
      positionCount: withPositions.length,
    }
  }, [enrichedMarkets])

  const hasPositions = isConnected && positionStats !== null

  // ── Filter chip ──
  const FilterChip = useCallback(
    ({ mode, label }: { mode: FilterMode; label: string }) => (
      <button
        type="button"
        onClick={() => setFilter(mode)}
        className={`px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors ${
          filter === mode
            ? 'bg-zinc-900 text-white'
            : 'bg-muted text-text-muted hover:text-text-primary'
        }`}
      >
        {label}
      </button>
    ),
    [filter]
  )

  return (
    <div className="space-y-6">
      {/* [A] Page Header */}
      <div className="pt-10 mb-2">
        <p className="text-label font-semibold tracking-[0.08em] uppercase text-text-muted mb-1.5">
          {t('heading.label')}
        </p>
        <h2 className="text-display font-black text-black">{t('heading.title')}</h2>
        <p className="text-body text-text-secondary mt-1.5">{t('heading.description')}</p>
      </div>

      <ErrorBoundary fallback={ErrorFallback}>
        {/* [B] PositionDashboard — conditional on connection + position state */}
        {hasPositions ? (
          <div className="section-bar">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              <div className="flex flex-col gap-0.5">
                <span className="section-bar-title">Total Collateral</span>
                <span className="section-bar-value">
                  ${positionStats!.totalCollateralUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="section-bar-title">Total Debt</span>
                <span className="section-bar-value">
                  &mdash;
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="section-bar-title">Avg Borrow APY</span>
                <span className="section-bar-value">
                  {positionStats!.avgBorrowApy.toFixed(2)}%
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="section-bar-title">Health Factor</span>
                <span
                  className={`section-bar-value ${
                    positionStats!.lowestHealthFactor >= 1.5
                      ? 'text-green-400'
                      : positionStats!.lowestHealthFactor >= 1.0
                        ? 'text-yellow-400'
                        : 'text-red-400'
                  }`}
                >
                  {positionStats!.lowestHealthFactor === Infinity
                    ? '\u221e'
                    : positionStats!.lowestHealthFactor.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <LendingStatsBanner />
        )}

        {/* [C] Two-Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
          {/* [C.L] Left column — search + filters + table */}
          <div className="space-y-3 min-w-0 overflow-hidden">
            {/* Search bar + filter chips */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search markets..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border-light bg-white focus:outline-none focus:border-black transition-colors placeholder:text-text-muted"
                />
              </div>

              <div className="flex flex-wrap gap-1 shrink-0">
                <FilterChip mode="all" label="All" />
                {isConnected && <FilterChip mode="positions" label="Your positions" />}
                <FilterChip mode="liquidity" label="Has liquidity" />
              </div>
            </div>

            {/* Markets table — scrollable container */}
            <div className="max-h-[600px] overflow-y-auto border border-border-light">
              <MarketsTable
                rows={filteredRows}
                selectedCollateralToken={selectedCollateralToken}
                onSelectRow={handleSelectRow}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* [C.R] Right column — sticky action panel */}
          <div className="xl:sticky xl:top-6 xl:self-start">
            {isConnected ? (
              <MarketActionPanel
                selectedMarket={selectedMarketInfo}
                position={morphoPosition ?? null}
                positionLoading={posLoading}
                onSuccess={refetchPosition}
              />
            ) : (
              <div className="border border-border-light bg-white p-6 text-center">
                <p className="text-text-secondary text-sm">Connect wallet to borrow</p>
                <p className="text-text-muted text-xs mt-1">
                  Deposit ITP shares as collateral, borrow USDC
                </p>
              </div>
            )}
          </div>
        </div>

        {/* [D] VaultSupplySection — full width */}
        <VaultSupplySection />
      </ErrorBoundary>
    </div>
  )
}
