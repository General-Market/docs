'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { formatUnits } from 'viem'
import { useMorphoPosition } from '@/hooks/useMorphoPosition'
import { useOraclePrice } from '@/hooks/useOraclePrice'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

import type { CrisisLevel } from '@/lib/types/lending-quote'

interface PositionCardProps {
  market?: MorphoMarketEntry
  crisisLevel?: CrisisLevel
}

/**
 * PositionCard component (AC4)
 *
 * Displays user's lending position:
 * - Collateral amount (ITP)
 * - Debt amount (USDC)
 * - Health factor (color-coded)
 * - Liquidation price
 * - Current NAV price from oracle
 * - Accrued interest
 *
 * Auto-refreshes every 15 seconds.
 */
export function PositionCard({ market, crisisLevel }: PositionCardProps) {
  const t = useTranslations('lending')
  const { position, isLoading, refetch } = useMorphoPosition(market)
  const { priceFormatted, lastUpdated, isStale } = useOraclePrice(market?.oracle)

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch()
    }, 15000)
    return () => clearInterval(interval)
  }, [refetch])

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-card border border-border-light p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4">Your Position</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
      </div>
    )
  }

  if (!position || (position.collateralAmount === 0n && position.debtAmount === 0n)) {
    return null
  }

  const collateralFormatted = formatUnits(position.collateralAmount, 18)
  const debtFormatted = formatUnits(position.debtAmount, 6)
  const healthFactor = position.healthFactor
  const liquidationPrice = position.liquidationPrice

  // Health factor color coding
  const healthColor = healthFactor >= 1.5 ? 'text-color-up' :
                      healthFactor >= 1.0 ? 'text-color-warning' :
                      'text-color-down'

  const healthBg = healthFactor >= 1.5 ? 'bg-surface-up border-green-200' :
                   healthFactor >= 1.0 ? 'bg-surface-warning border-yellow-200' :
                   'bg-surface-down border-red-200'

  // Format last updated time
  const timeSinceUpdate = lastUpdated
    ? Math.floor((Date.now() / 1000 - Number(lastUpdated)) / 60)
    : null

  return (
    <div className={`border rounded-xl p-6 ${healthBg}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-text-primary">{t('position_card.title')}</h2>
          {crisisLevel && crisisLevel !== 'Normal' && (
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
              crisisLevel === 'Emergency' ? 'bg-surface-down text-color-down border border-red-300' :
              crisisLevel === 'Stress' ? 'bg-orange-50 text-orange-700 border border-orange-300' :
              'bg-surface-warning text-color-warning border border-yellow-300'
            }`}>
              {crisisLevel}
            </span>
          )}
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-mono tabular-nums ${healthColor} ${healthBg}`}>
          {t('position_card.health_label', { value: healthFactor === Infinity ? '∞' : healthFactor.toFixed(2) })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Collateral */}
        <div className="bg-white/60 rounded-xl p-4">
          <p className="text-text-muted text-xs mb-1">{t('position_card.collateral')}</p>
          <p className="text-text-primary font-bold text-xl font-mono tabular-nums">
            {parseFloat(collateralFormatted).toFixed(4)}
          </p>
          <p className="text-text-muted text-xs">ITP</p>
        </div>

        {/* Debt */}
        <div className="bg-white/60 rounded-xl p-4">
          <p className="text-text-muted text-xs mb-1">{t('position_card.debt')}</p>
          <p className="text-text-primary font-bold text-xl font-mono tabular-nums">
            {parseFloat(debtFormatted).toFixed(2)}
          </p>
          <p className="text-text-muted text-xs">USDC</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Liquidation Price */}
        {position.debtAmount > 0n && (
          <div className="flex justify-between items-center">
            <span className="text-text-secondary text-sm">{t('position_card.liquidation_price')}</span>
            <span className="text-text-primary font-mono tabular-nums">
              ${liquidationPrice.toFixed(4)}
            </span>
          </div>
        )}

        {/* Current NAV Price */}
        <div className="flex justify-between items-center">
          <span className="text-text-secondary text-sm">{t('position_card.current_nav')}</span>
          <div className="flex items-center gap-2">
            <span className="text-text-primary font-mono tabular-nums">
              ${priceFormatted?.toFixed(4) ?? '...'}
            </span>
            {isStale && (
              <span className="text-color-down text-xs">{t('position_card.stale')}</span>
            )}
          </div>
        </div>

        {/* Oracle Update Time */}
        <div className="flex justify-between items-center">
          <span className="text-text-secondary text-sm">{t('position_card.price_updated')}</span>
          <span className="text-text-muted text-xs font-mono tabular-nums">
            {timeSinceUpdate !== null
              ? timeSinceUpdate === 0
                ? t('position_card.just_now')
                : t('position_card.min_ago', { minutes: timeSinceUpdate })
              : '...'}
          </span>
        </div>

        {/* Max Borrow */}
        {position.maxBorrow > 0n && (
          <div className="flex justify-between items-center">
            <span className="text-text-secondary text-sm">{t('position_card.available_to_borrow')}</span>
            <span className="text-color-up font-mono tabular-nums">
              {formatUnits(position.maxBorrow, 6)} USDC
            </span>
          </div>
        )}

        {/* Max Withdraw */}
        {position.maxWithdraw > 0n && (
          <div className="flex justify-between items-center">
            <span className="text-text-secondary text-sm">{t('position_card.available_to_withdraw')}</span>
            <span className="text-color-up font-mono tabular-nums">
              {parseFloat(formatUnits(position.maxWithdraw, 18)).toFixed(4)} ITP
            </span>
          </div>
        )}
      </div>

      {/* Health Factor Warning */}
      {healthFactor < 1.5 && healthFactor >= 1.0 && (
        <div className="mt-4 p-3 bg-surface-warning border border-yellow-200 rounded-xl">
          <p className="text-color-warning text-sm">
            {t('position_card.health_warning')}
          </p>
        </div>
      )}

      {healthFactor < 1.0 && (
        <div className="mt-4 p-3 bg-surface-down border border-red-200 rounded-xl">
          <p className="text-color-down text-sm font-bold">
            {t('position_card.health_danger')}
          </p>
        </div>
      )}
    </div>
  )
}
