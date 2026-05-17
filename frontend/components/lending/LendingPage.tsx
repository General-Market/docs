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
  <div
    className="p-6 text-center"
    style={{
      background: '#fdecec',
      border: '1px solid #f5b8b8',
      borderRadius: 12,
      color: '#a8071a',
      fontFamily: 'var(--apple-font-text)',
      letterSpacing: 'var(--apple-track-tight)',
    }}
  >
    <h3 className="font-bold mb-2" style={{ fontSize: 17 }}>Module failed to load</h3>
    <p style={{ fontSize: 14, color: 'var(--apple-text-secondary)' }}>Refresh the page to retry.</p>
  </div>
)

function Bone({ w = 'w-16' }: { w?: string }) {
  return (
    <div
      className={`${w} h-5 rounded animate-pulse`}
      style={{ background: 'var(--apple-line)' }}
    />
  )
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
      rows = rows.filter(r => r.available > 0 || r.userBalance > 0)
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
      borrowApy: row.borrowApy,
      lltv: row.lltv,
      available: row.available,
      market: row.market,
    }
  }, [selectedCollateralToken, selectedMarket, tableRows])

  // ── Aggregate position stats for the dashboard ──
  const positionStats = useMemo(() => {
    const withPositions = enrichedMarkets.filter(m => m.hasPosition)
    if (withPositions.length === 0) return null

    let totalCollateralUsd = 0
    let totalDebtUsd = 0
    let weightedBorrowApy = 0
    let totalDebtFloat = 0
    let lowestHealth = Infinity

    for (const m of withPositions) {
      const collateral = parseFloat(formatUnits(BigInt(m.collateralAmount), 18))
      totalCollateralUsd += collateral * m.navPerShare

      const debtFloat = parseFloat(formatUnits(BigInt(m.debtAmount), 18))
      totalDebtUsd += debtFloat

      if (debtFloat > 0) {
        weightedBorrowApy += m.borrowApy * debtFloat
        totalDebtFloat += debtFloat
      }

      if (m.healthFactor < lowestHealth) {
        lowestHealth = m.healthFactor
      }
    }

    const avgBorrowApy = totalDebtFloat > 0 ? weightedBorrowApy / totalDebtFloat : 0

    return {
      totalCollateralUsd,
      totalDebtUsd,
      avgBorrowApy,
      lowestHealthFactor: lowestHealth,
      positionCount: withPositions.length,
    }
  }, [enrichedMarkets])

  const hasPositions = isConnected && positionStats !== null

  // ── Filter chip — Apple segmented control ──
  const FilterChip = useCallback(
    ({ mode, label, hint }: { mode: FilterMode; label: string; hint?: string }) => {
      const active = filter === mode
      return (
        <button
          type="button"
          onClick={() => setFilter(mode)}
          title={hint}
          style={{
            padding: '6px 14px',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            fontWeight: active ? 600 : 500,
            letterSpacing: 'var(--apple-track-tight)',
            color: active ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
            background: active ? 'var(--apple-panel)' : 'transparent',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.04)' : 'none',
            transition: 'background 200ms var(--apple-ease-default), color 200ms var(--apple-ease-default)',
          }}
        >
          {label}
        </button>
      )
    },
    [filter]
  )

  const healthColor =
    positionStats && positionStats.lowestHealthFactor >= 1.5
      ? '#16a34a'
      : positionStats && positionStats.lowestHealthFactor >= 1.0
        ? '#b45309'
        : '#dc2626'

  return (
    <div className="space-y-6">
      {/* [A] Page Header */}
      <div className="pt-10 mb-2">
        <p
          className="mb-1.5"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-loose)',
            textTransform: 'uppercase',
            color: 'var(--apple-text-tertiary)',
          }}
        >
          {t('heading.label')}
        </p>
        <h2
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'clamp(32px, 4vw, 48px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tighter)',
            lineHeight: 1.0714,
            color: 'var(--apple-text)',
            margin: 0,
          }}
        >
          {t('heading.title')}
        </h2>
        <p
          className="mt-1.5"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-21)',
            lineHeight: 1.1904,
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text-secondary)',
            margin: 0,
          }}
        >
          {t('heading.description')}
        </p>
      </div>

      <ErrorBoundary fallback={ErrorFallback}>
        {/* [B] PositionDashboard — conditional on connection + position state */}
        {hasPositions ? (
          <div
            data-testid="lending-position-stats"
            style={{
              background: 'var(--apple-panel)',
              border: '1px solid var(--apple-line)',
              borderRadius: 12,
              padding: '20px 24px',
            }}
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              <div className="flex flex-col gap-1">
                <span
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-loose)',
                    textTransform: 'uppercase',
                    color: 'var(--apple-text-tertiary)',
                  }}
                >
                  Total Collateral
                </span>
                <span
                  data-testid="lending-total-collateral"
                  style={{
                    fontFamily: 'var(--apple-font-display)',
                    fontSize: 'var(--apple-fs-24)',
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-tighter)',
                    color: 'var(--apple-text)',
                  }}
                >
                  ${positionStats!.totalCollateralUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-loose)',
                    textTransform: 'uppercase',
                    color: 'var(--apple-text-tertiary)',
                  }}
                >
                  Total Debt
                </span>
                <span
                  data-testid="lending-total-debt"
                  style={{
                    fontFamily: 'var(--apple-font-display)',
                    fontSize: 'var(--apple-fs-24)',
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-tighter)',
                    color: 'var(--apple-text)',
                  }}
                >
                  {positionStats!.totalDebtUsd > 0
                    ? `$${positionStats!.totalDebtUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : '\u2014'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-loose)',
                    textTransform: 'uppercase',
                    color: 'var(--apple-text-tertiary)',
                  }}
                >
                  Avg Borrow APY
                </span>
                <span
                  data-testid="lending-avg-borrow-apy"
                  style={{
                    fontFamily: 'var(--apple-font-display)',
                    fontSize: 'var(--apple-fs-24)',
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-tighter)',
                    color: 'var(--apple-text)',
                  }}
                >
                  {positionStats!.avgBorrowApy.toFixed(2)}%
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-loose)',
                    textTransform: 'uppercase',
                    color: 'var(--apple-text-tertiary)',
                  }}
                >
                  Health Factor
                </span>
                <span
                  data-testid="lending-health-factor"
                  style={{
                    fontFamily: 'var(--apple-font-display)',
                    fontSize: 'var(--apple-fs-24)',
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-tighter)',
                    color: healthColor,
                  }}
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
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  style={{ color: 'var(--apple-text-tertiary)' }}
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
                  className="w-full"
                  style={{
                    paddingLeft: 36,
                    paddingRight: 14,
                    paddingTop: 10,
                    paddingBottom: 10,
                    fontSize: 14,
                    fontFamily: 'var(--apple-font-text)',
                    letterSpacing: 'var(--apple-track-tight)',
                    color: 'var(--apple-text)',
                    background: 'var(--apple-panel)',
                    border: '1px solid var(--apple-line)',
                    borderRadius: 12,
                    outline: 'none',
                    transition: 'border-color 200ms var(--apple-ease-default), box-shadow 200ms var(--apple-ease-default)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#0071e3'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.18)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'var(--apple-line)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </div>

              <div
                className="flex flex-wrap shrink-0"
                style={{
                  background: 'var(--apple-surface)',
                  borderRadius: 10,
                  padding: 3,
                  gap: 2,
                }}
              >
                <FilterChip mode="all" label="All" hint={t('tooltips.all')} />
                {isConnected && <FilterChip mode="positions" label="Your positions" hint={t('tooltips.positions')} />}
                <FilterChip mode="liquidity" label="Has Liquidity" hint={t('tooltips.has_liquidity')} />
              </div>
            </div>

            {/* Markets table — scrollable container */}
            <div
              className="max-h-[600px] overflow-y-auto"
              style={{
                background: 'var(--apple-panel)',
                border: '1px solid var(--apple-line)',
                borderRadius: 12,
              }}
            >
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
              <div
                className="p-6 text-center"
                style={{
                  background: 'var(--apple-panel)',
                  border: '1px solid var(--apple-line)',
                  borderRadius: 12,
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 14,
                    letterSpacing: 'var(--apple-track-tight)',
                    color: 'var(--apple-text)',
                  }}
                >
                  Connect wallet to borrow
                </p>
                <p
                  className="mt-1"
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 12,
                    letterSpacing: 'var(--apple-track-tight)',
                    color: 'var(--apple-text-secondary)',
                  }}
                >
                  Deposit DTF shares as collateral, borrow USDC
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
