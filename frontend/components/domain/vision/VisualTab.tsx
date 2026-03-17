'use client'

import { useMemo } from 'react'
import type { BatchInfo } from '@/hooks/vision/useBatches'
import type { BatchHistoryEntry } from '@/hooks/vision/useBatchHistory'
import { formatMarketName } from '@/lib/vision/market-categories'

interface VisualTabProps {
  batch: BatchInfo
  history: BatchHistoryEntry[]
  bets: Record<string, boolean> // marketId -> true=UP, false=DOWN
  onToggleBet: (marketId: string) => void
}

/**
 * Visual tab for batches with <=20 markets.
 * Shows market cards with price, sparkline placeholder, % change, UP/DOWN toggle.
 * History row: past tick results + future bets.
 */
export function VisualTab({ batch, history, bets, onToggleBet }: VisualTabProps) {
  const marketIds = batch.marketIds

  // Build per-market history from tick results (most recent first -> reverse for chronological)
  const marketHistory = useMemo(() => {
    const result: Record<string, { pctChange: number; wentUp: boolean }[]> = {}
    for (const id of marketIds) {
      result[id] = []
    }
    // History comes newest-first from API, reverse for display left-to-right
    const chronological = [...history].reverse()
    for (const entry of chronological) {
      for (const outcome of entry.marketOutcomes) {
        if (result[outcome.marketId]) {
          result[outcome.marketId].push({
            pctChange: outcome.pctChange,
            wentUp: outcome.wentUp,
          })
        }
      }
    }
    return result
  }, [marketIds, history])

  // Get latest price/change from most recent tick
  const latestPrices = useMemo(() => {
    const result: Record<string, { price: number; change: number }> = {}
    if (history.length > 0) {
      const latest = history[0] // newest first
      for (const outcome of latest.marketOutcomes) {
        result[outcome.marketId] = {
          price: outcome.endPrice,
          change: outcome.pctChange,
        }
      }
    }
    return result
  }, [history])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 stagger">
      {marketIds.map(marketId => {
        const priceInfo = latestPrices[marketId]
        const mktHistory = marketHistory[marketId] || []
        const betDirection = bets[marketId]
        const isUp = betDirection === true
        const isDown = betDirection === false
        const hasBet = betDirection !== undefined

        return (
          <div
            key={marketId}
            className="border border-border-light rounded-card p-3 bg-white animate-fade-up hover-lift"
          >
            {/* Market header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-text-primary font-bold truncate max-w-[140px] min-w-0">
                {formatMarketName(marketId)}
              </span>
              {priceInfo && (
                <span className={`text-xs font-mono ${
                  priceInfo.change >= 0 ? 'text-color-up' : 'text-color-down'
                }`}>
                  {priceInfo.change >= 0 ? '+' : ''}{priceInfo.change.toFixed(2)}%
                </span>
              )}
            </div>

            {/* Price display */}
            <div className="mb-2">
              <span className="text-sm font-mono text-text-primary">
                {priceInfo ? `$${priceInfo.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '--'}
              </span>
            </div>

            {/* Price history bar */}
            <div className="h-8 mb-2 flex items-end gap-px">
              {(marketHistory[marketId] || []).slice(-8).map((tick: { pctChange: number; wentUp: boolean }, i: number) => (
                <div
                  key={i}
                  className={`flex-1 rounded-sm min-h-[2px] ${tick.wentUp ? 'bg-color-up/30' : 'bg-color-down/30'}`}
                  style={{ height: `${Math.min(100, Math.max(10, Math.abs(tick.pctChange) * 20))}%` }}
                />
              ))}
              {(!marketHistory[marketId] || marketHistory[marketId].length === 0) && (
                <div className="flex-1 h-full bg-surface rounded" />
              )}
            </div>

            {/* History row: past results + current bet */}
            <div className="flex items-center gap-0.5 mb-3 overflow-x-auto">
              {mktHistory.slice(-8).map((tick: { pctChange: number; wentUp: boolean }, i: number) => (
                <span
                  key={i}
                  className={`w-4 h-4 flex items-center justify-center rounded-sm text-[9px] ${
                    tick.wentUp
                      ? 'bg-surface-up text-color-up'
                      : 'bg-surface-down text-color-down'
                  }`}
                  title={`${tick.pctChange >= 0 ? '+' : ''}${tick.pctChange.toFixed(2)}%`}
                >
                  {tick.wentUp ? '\u2713' : '\u2717'}
                </span>
              ))}
              {hasBet && (
                <span
                  className={`w-4 h-4 flex items-center justify-center rounded-sm text-[9px] border ${
                    isUp
                      ? 'border-color-up text-color-up'
                      : 'border-color-down text-color-down'
                  }`}
                >
                  {isUp ? '\u25B2' : '\u25BC'}
                </span>
              )}
            </div>

            {/* Bet toggle — single button, cycles: none → UP → DOWN → none */}
            <button
              onClick={() => onToggleBet(marketId)}
              className={`w-full py-1.5 rounded-md text-xs font-bold font-mono tracking-wide transition-colors press ${
                isUp
                  ? 'bg-color-up text-white'
                  : isDown
                    ? 'bg-color-down text-white'
                    : 'bg-muted text-text-muted hover:bg-surface hover:text-text-primary border border-border-light'
              }`}
            >
              {isUp ? '\u25B2 UP' : isDown ? '\u25BC DN' : 'SET BET'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

