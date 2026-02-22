'use client'

import { useState, useMemo } from 'react'
import type { BatchInfo } from '@/hooks/p2pool/useBatches'
import type { BatchHistoryEntry, MarketOutcome } from '@/hooks/p2pool/useBatchHistory'

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
            className="border border-border-light rounded-card p-3 bg-white"
          >
            {/* Market header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-text-primary font-bold truncate max-w-[140px]">
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

            {/* Sparkline placeholder */}
            <div className="h-8 bg-surface rounded mb-2 flex items-center justify-center">
              <span className="text-[10px] text-text-muted font-mono">sparkline</span>
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

            {/* UP / DOWN toggle buttons */}
            <div className="flex gap-1">
              <button
                onClick={() => onToggleBet(marketId)}
                className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${
                  isUp
                    ? 'bg-color-up text-white'
                    : 'bg-surface-up text-color-up hover:bg-color-up/20'
                }`}
              >
                {'\u25B2'} UP
              </button>
              <button
                onClick={() => onToggleBet(marketId)}
                className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${
                  isDown
                    ? 'bg-color-down text-white'
                    : 'bg-surface-down text-color-down hover:bg-color-down/20'
                }`}
              >
                {'\u25BC'} DOWN
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Format market ID into a readable name */
function formatMarketName(marketId: string): string {
  // Handle known prefixes: poly_, twitch_, hn_, weather_
  if (marketId.startsWith('poly_')) return marketId.slice(5).replace(/_/g, ' ')
  if (marketId.startsWith('twitch_')) return `Twitch: ${marketId.slice(7)}`
  if (marketId.startsWith('hn_')) return `HN #${marketId.slice(3)}`
  if (marketId.startsWith('weather_')) return marketId.slice(8).replace(/_/g, ' ')
  // Default: replace underscores, uppercase first segment
  return marketId.replace(/_/g, ' ').toUpperCase()
}
