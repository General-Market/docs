'use client'

import { useEffect } from 'react'
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
      <div className="bg-terminal-dark border border-white/10 rounded-lg p-6">
        <h2 className="text-lg font-bold text-white mb-4">Your Position</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-white/10 rounded w-1/2" />
          <div className="h-4 bg-white/10 rounded w-3/4" />
          <div className="h-4 bg-white/10 rounded w-2/3" />
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
  const healthColor = healthFactor >= 1.5 ? 'text-green-400' :
                      healthFactor >= 1.0 ? 'text-yellow-400' :
                      'text-red-400'

  const healthBg = healthFactor >= 1.5 ? 'bg-green-400/10 border-green-400/30' :
                   healthFactor >= 1.0 ? 'bg-yellow-400/10 border-yellow-400/30' :
                   'bg-red-400/10 border-red-400/30'

  // Format last updated time
  const timeSinceUpdate = lastUpdated
    ? Math.floor((Date.now() / 1000 - Number(lastUpdated)) / 60)
    : null

  return (
    <div className={`border rounded-lg p-6 ${healthBg}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white">Your Position</h2>
          {crisisLevel && crisisLevel !== 'Normal' && (
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
              crisisLevel === 'Emergency' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
              crisisLevel === 'Stress' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' :
              'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
            }`}>
              {crisisLevel}
            </span>
          )}
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-mono ${healthColor} ${healthBg}`}>
          Health: {healthFactor === Infinity ? '∞' : healthFactor.toFixed(2)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Collateral */}
        <div className="bg-black/30 rounded-lg p-4">
          <p className="text-white/60 text-xs mb-1">Collateral</p>
          <p className="text-white font-bold text-xl font-mono">
            {parseFloat(collateralFormatted).toFixed(4)}
          </p>
          <p className="text-white/40 text-xs">ITP</p>
        </div>

        {/* Debt */}
        <div className="bg-black/30 rounded-lg p-4">
          <p className="text-white/60 text-xs mb-1">Debt</p>
          <p className="text-white font-bold text-xl font-mono">
            {parseFloat(debtFormatted).toFixed(2)}
          </p>
          <p className="text-white/40 text-xs">USDC</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Liquidation Price */}
        {position.debtAmount > 0n && (
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">Liquidation Price</span>
            <span className="text-white font-mono">
              ${liquidationPrice.toFixed(4)}
            </span>
          </div>
        )}

        {/* Current NAV Price */}
        <div className="flex justify-between items-center">
          <span className="text-white/60 text-sm">Current NAV</span>
          <div className="flex items-center gap-2">
            <span className="text-white font-mono">
              ${priceFormatted?.toFixed(4) ?? '...'}
            </span>
            {isStale && (
              <span className="text-red-400 text-xs">(stale)</span>
            )}
          </div>
        </div>

        {/* Oracle Update Time */}
        <div className="flex justify-between items-center">
          <span className="text-white/60 text-sm">Price Updated</span>
          <span className="text-white/40 text-xs font-mono">
            {timeSinceUpdate !== null
              ? timeSinceUpdate === 0
                ? 'Just now'
                : `${timeSinceUpdate} min ago`
              : '...'}
          </span>
        </div>

        {/* Max Borrow */}
        {position.maxBorrow > 0n && (
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">Available to Borrow</span>
            <span className="text-green-400 font-mono">
              {formatUnits(position.maxBorrow, 6)} USDC
            </span>
          </div>
        )}

        {/* Max Withdraw */}
        {position.maxWithdraw > 0n && (
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">Available to Withdraw</span>
            <span className="text-green-400 font-mono">
              {parseFloat(formatUnits(position.maxWithdraw, 18)).toFixed(4)} ITP
            </span>
          </div>
        )}
      </div>

      {/* Health Factor Warning */}
      {healthFactor < 1.5 && healthFactor >= 1.0 && (
        <div className="mt-4 p-3 bg-yellow-400/10 border border-yellow-400/30 rounded-lg">
          <p className="text-yellow-400 text-sm">
            Your position is at risk of liquidation. Consider repaying debt or adding collateral.
          </p>
        </div>
      )}

      {healthFactor < 1.0 && (
        <div className="mt-4 p-3 bg-red-400/10 border border-red-400/30 rounded-lg">
          <p className="text-red-400 text-sm font-bold">
            Your position is eligible for liquidation! Repay debt immediately.
          </p>
        </div>
      )}
    </div>
  )
}
