'use client'

import { useState, useMemo, useCallback } from 'react'
import type { BatchInfo } from '@/hooks/p2pool/useBatches'
import type { BatchHistoryEntry } from '@/hooks/p2pool/useBatchHistory'
import { categorizeMarkets, formatMarketName, type MarketCategory } from '@/lib/p2pool/market-categories'

interface MarketAccordionProps {
  batch: BatchInfo
  history: BatchHistoryEntry[]
  bets: Record<string, boolean>
  onToggleBet: (marketId: string) => void
  onBulkBet: (marketIds: string[], direction: boolean) => void
}

/**
 * Accordion component for batches with 6+ markets.
 * Groups markets by category (crypto, stocks, etc.).
 * Only one category expanded at a time.
 * Each category bar has per-category ALL UP / ALL DOWN buttons.
 */
export function MarketAccordion({ batch, history, bets, onToggleBet, onBulkBet }: MarketAccordionProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const categories = useMemo(() => categorizeMarkets(batch.marketIds), [batch.marketIds])

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

  // Per-market win/loss history (last 6 ticks, chronological)
  const marketHistory = useMemo(() => {
    const result: Record<string, boolean[]> = {}
    const chronological = [...history].reverse()
    for (const id of batch.marketIds) {
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
  }, [batch.marketIds, history])

  const toggleCategory = useCallback((key: string) => {
    setExpandedCategory(prev => prev === key ? null : key)
  }, [])

  return (
    <div className="space-y-1">
      {categories.map(cat => {
        const isExpanded = expandedCategory === cat.key
        const betsInCat = cat.markets.filter(id => bets[id] !== undefined).length

        return (
          <div key={cat.key}>
            <CategoryBar
              category={cat}
              isExpanded={isExpanded}
              betsSet={betsInCat}
              onToggle={() => toggleCategory(cat.key)}
              onAllUp={() => onBulkBet(cat.markets, true)}
              onAllDown={() => onBulkBet(cat.markets, false)}
            />
            {isExpanded && (
              <CategoryContent
                markets={cat.markets}
                bets={bets}
                latestPrices={latestPrices}
                marketHistory={marketHistory}
                onToggleBet={onToggleBet}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Category Bar ──────────────────────────────────────────────────

function CategoryBar({
  category,
  isExpanded,
  betsSet,
  onToggle,
  onAllUp,
  onAllDown,
}: {
  category: MarketCategory
  isExpanded: boolean
  betsSet: number
  onToggle: () => void
  onAllUp: () => void
  onAllDown: () => void
}) {
  return (
    <div className={`flex items-center rounded-lg transition-colors ${
      isExpanded ? 'bg-terminal' : 'bg-muted hover:bg-surface'
    }`}>
      {/* Main clickable area */}
      <button
        onClick={onToggle}
        className="flex-1 flex items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className={`text-[10px] transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''} ${
          isExpanded ? 'text-text-inverse' : 'text-text-muted'
        }`}>
          {'\u25B6'}
        </span>
        <span className={`text-xs font-bold ${isExpanded ? 'text-text-inverse' : 'text-text-primary'}`}>
          {category.label}
        </span>
        <span className={`text-[10px] font-mono ${isExpanded ? 'text-text-inverse/60' : 'text-text-muted'}`}>
          {category.markets.length}
        </span>
        {betsSet > 0 && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            isExpanded ? 'bg-white/20 text-white' : 'bg-terminal/10 text-terminal'
          }`}>
            {betsSet}/{category.markets.length}
          </span>
        )}
      </button>

      {/* Per-category bulk actions (visible when expanded) */}
      {isExpanded && (
        <div className="flex items-center gap-1 pr-2">
          <button
            onClick={(e) => { e.stopPropagation(); onAllUp() }}
            className="px-2 py-1 rounded text-[10px] font-bold bg-color-up/20 text-white hover:bg-color-up/40 transition-colors"
            title={`All ${category.label} UP`}
          >
            {'\u25B2'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAllDown() }}
            className="px-2 py-1 rounded text-[10px] font-bold bg-color-down/20 text-white hover:bg-color-down/40 transition-colors"
            title={`All ${category.label} DOWN`}
          >
            {'\u25BC'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Category Content (market list) ─────────────────────────────────

function CategoryContent({
  markets,
  bets,
  latestPrices,
  marketHistory,
  onToggleBet,
}: {
  markets: string[]
  bets: Record<string, boolean>
  latestPrices: Record<string, { price: number; change: number }>
  marketHistory: Record<string, boolean[]>
  onToggleBet: (marketId: string) => void
}) {
  return (
    <div className="mt-0.5 mb-1.5 border border-border-light rounded-lg overflow-hidden">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="bg-muted text-text-muted text-left">
            <th className="py-1.5 px-2 w-9">Bet</th>
            <th className="py-1.5 px-2">Market</th>
            <th className="py-1.5 px-2 text-right">Price</th>
            <th className="py-1.5 px-2 text-right w-16">Chg%</th>
            <th className="py-1.5 px-2 w-24 text-center">History</th>
          </tr>
        </thead>
        <tbody>
          {markets.map(marketId => {
            const priceInfo = latestPrices[marketId]
            const mktHistory = (marketHistory[marketId] || []).slice(-6)
            const bet = bets[marketId]
            const isUp = bet === true

            return (
              <tr
                key={marketId}
                className="border-t border-border-light hover:bg-surface transition-colors"
              >
                {/* Toggle */}
                <td className="py-1 px-2">
                  <button
                    onClick={() => onToggleBet(marketId)}
                    className={`w-7 h-7 rounded text-[10px] font-bold transition-colors ${
                      bet === undefined
                        ? 'bg-muted text-text-muted hover:bg-surface'
                        : isUp
                          ? 'bg-color-up text-white'
                          : 'bg-color-down text-white'
                    }`}
                  >
                    {bet === undefined ? '--' : isUp ? '\u25B2' : '\u25BC'}
                  </button>
                </td>

                {/* Name */}
                <td className="py-1 px-2 text-text-primary truncate max-w-[160px]">
                  {formatMarketName(marketId)}
                </td>

                {/* Price */}
                <td className="py-1 px-2 text-right text-text-primary tabular-nums">
                  {priceInfo
                    ? `$${priceInfo.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                    : '--'}
                </td>

                {/* % Change */}
                <td className={`py-1 px-2 text-right tabular-nums ${
                  priceInfo
                    ? priceInfo.change >= 0 ? 'text-color-up' : 'text-color-down'
                    : 'text-text-muted'
                }`}>
                  {priceInfo
                    ? `${priceInfo.change >= 0 ? '+' : ''}${priceInfo.change.toFixed(2)}%`
                    : '--'}
                </td>

                {/* History dots */}
                <td className="py-1 px-2">
                  <div className="flex items-center justify-center gap-0.5">
                    {mktHistory.map((wentUp, i) => (
                      <span
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full ${
                          wentUp ? 'bg-color-up' : 'bg-color-down'
                        }`}
                      />
                    ))}
                    {mktHistory.length === 0 && (
                      <span className="text-text-muted text-[8px]">--</span>
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
