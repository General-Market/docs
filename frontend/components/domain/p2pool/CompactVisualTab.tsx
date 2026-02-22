'use client'

import { useMemo } from 'react'
import type { BatchInfo } from '@/hooks/p2pool/useBatches'
import type { BatchHistoryEntry } from '@/hooks/p2pool/useBatchHistory'

interface CompactVisualTabProps {
  batch: BatchInfo
  history: BatchHistoryEntry[]
  bets: Record<string, boolean> // marketId -> true=UP, false=DOWN
  onToggleBet: (marketId: string) => void
}

/**
 * Compact visual tab for batches with 21-100 markets.
 * Dense table rows: toggle + name + price + change% + mini sparkline + history dots.
 */
export function CompactVisualTab({ batch, history, bets, onToggleBet }: CompactVisualTabProps) {
  const marketIds = batch.marketIds

  // Latest prices from most recent tick
  const latestPrices = useMemo(() => {
    const result: Record<string, { price: number; change: number }> = {}
    if (history.length > 0) {
      const latest = history[0]
      for (const outcome of latest.marketOutcomes) {
        result[outcome.marketId] = {
          price: outcome.endPrice,
          change: outcome.pctChange,
        }
      }
    }
    return result
  }, [history])

  // Per-market win/loss history (last 6 ticks)
  const marketHistory = useMemo(() => {
    const result: Record<string, boolean[]> = {}
    const chronological = [...history].reverse()
    for (const id of marketIds) {
      result[id] = []
    }
    for (const entry of chronological) {
      for (const outcome of entry.marketOutcomes) {
        if (result[outcome.marketId]) {
          result[outcome.marketId].push(outcome.wentUp)
        }
      }
    }
    return result
  }, [marketIds, history])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-border-light text-text-muted text-left">
            <th className="py-1.5 px-2 w-10">Bet</th>
            <th className="py-1.5 px-2">Market</th>
            <th className="py-1.5 px-2 text-right">Price</th>
            <th className="py-1.5 px-2 text-right w-16">Change</th>
            <th className="py-1.5 px-2 w-20 text-center">Chart</th>
            <th className="py-1.5 px-2 w-24 text-center">History</th>
          </tr>
        </thead>
        <tbody>
          {marketIds.map(marketId => {
            const priceInfo = latestPrices[marketId]
            const mktHistory = (marketHistory[marketId] || []).slice(-6)
            const betDirection = bets[marketId]
            const isUp = betDirection === true

            return (
              <tr
                key={marketId}
                className="border-b border-border-light hover:bg-surface transition-colors"
              >
                {/* Toggle button */}
                <td className="py-1 px-2">
                  <button
                    onClick={() => onToggleBet(marketId)}
                    className={`w-7 h-7 rounded text-[10px] font-bold transition-colors ${
                      betDirection === undefined
                        ? 'bg-muted text-text-muted hover:bg-surface'
                        : isUp
                          ? 'bg-color-up text-white'
                          : 'bg-color-down text-white'
                    }`}
                  >
                    {betDirection === undefined ? '--' : isUp ? '\u25B2' : '\u25BC'}
                  </button>
                </td>

                {/* Market name */}
                <td className="py-1 px-2 text-text-primary truncate max-w-[160px]">
                  {formatMarketName(marketId)}
                </td>

                {/* Price */}
                <td className="py-1 px-2 text-right text-text-primary">
                  {priceInfo
                    ? `$${priceInfo.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                    : '--'}
                </td>

                {/* % Change */}
                <td className={`py-1 px-2 text-right ${
                  priceInfo
                    ? priceInfo.change >= 0 ? 'text-color-up' : 'text-color-down'
                    : 'text-text-muted'
                }`}>
                  {priceInfo
                    ? `${priceInfo.change >= 0 ? '+' : ''}${priceInfo.change.toFixed(2)}%`
                    : '--'}
                </td>

                {/* Mini sparkline placeholder */}
                <td className="py-1 px-2">
                  <div className="h-4 bg-surface rounded flex items-center justify-center">
                    <span className="text-[8px] text-text-muted">---</span>
                  </div>
                </td>

                {/* History dots */}
                <td className="py-1 px-2">
                  <div className="flex items-center justify-center gap-0.5">
                    {mktHistory.map((wentUp: boolean, i: number) => (
                      <span
                        key={i}
                        className={`w-3 h-3 rounded-full ${
                          wentUp ? 'bg-color-up' : 'bg-color-down'
                        }`}
                        title={wentUp ? 'UP' : 'DOWN'}
                      />
                    ))}
                    {mktHistory.length === 0 && (
                      <span className="text-text-muted text-[8px]">no data</span>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function formatMarketName(marketId: string): string {
  if (marketId.startsWith('poly_')) return marketId.slice(5).replace(/_/g, ' ')
  if (marketId.startsWith('twitch_')) return `Twitch: ${marketId.slice(7)}`
  if (marketId.startsWith('hn_')) return `HN #${marketId.slice(3)}`
  if (marketId.startsWith('weather_')) return marketId.slice(8).replace(/_/g, ' ')
  return marketId.replace(/_/g, ' ').toUpperCase()
}
