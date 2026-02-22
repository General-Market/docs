'use client'

import { useState, useMemo, useCallback } from 'react'
import type { BatchInfo } from '@/hooks/p2pool/useBatches'
import { useBatchHistory } from '@/hooks/p2pool/useBatchHistory'
import { VisualTab } from './VisualTab'
import { CompactVisualTab } from './CompactVisualTab'
import { ScriptTab } from './ScriptTab'

type TabType = 'VISUAL' | 'SCRIPT'

interface ExpandedBatchProps {
  batchId: number
  batch: BatchInfo
}

/**
 * Expanded batch view with VISUAL / SCRIPT tab switching.
 * Auto-selects tab based on market count:
 *   <=20 markets: VISUAL (card layout)
 *   21-100 markets: VISUAL (compact table rows)
 *   100+ markets: SCRIPT (Python editor)
 *
 * Includes player stats footer and action buttons row.
 */
export function ExpandedBatch({ batchId, batch }: ExpandedBatchProps) {
  const marketCount = batch.marketIds.length
  const defaultTab: TabType = marketCount > 100 ? 'SCRIPT' : 'VISUAL'
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab)

  // Fetch tick history for this batch
  const { data: history, isLoading: historyLoading } = useBatchHistory(batchId)

  // Per-market bets state: marketId -> true=UP, false=DOWN, undefined=not set
  const [bets, setBets] = useState<Record<string, boolean>>({})

  // Toggle a single market bet: unset -> UP -> DOWN -> UP -> ...
  const handleToggleBet = useCallback((marketId: string) => {
    setBets((prev: Record<string, boolean>) => {
      const current = prev[marketId]
      if (current === undefined) return { ...prev, [marketId]: true }
      if (current === true) return { ...prev, [marketId]: false }
      return { ...prev, [marketId]: true }
    })
  }, [])

  // Bulk actions
  const handleAllUp = useCallback(() => {
    const newBets: Record<string, boolean> = {}
    for (const id of batch.marketIds) {
      newBets[id] = true
    }
    setBets(newBets)
  }, [batch.marketIds])

  const handleAllDown = useCallback(() => {
    const newBets: Record<string, boolean> = {}
    for (const id of batch.marketIds) {
      newBets[id] = false
    }
    setBets(newBets)
  }, [batch.marketIds])

  // Handle bitmap from script tab
  const handleBitmapGenerated = useCallback((bitmap: Record<string, boolean>) => {
    setBets(bitmap)
  }, [])

  // Player stats (mock for now -- will be wired to real data in Task 4.4/4.6)
  const stats = useMemo(() => {
    const totalBets = Object.keys(bets).length
    return {
      betsSet: totalBets,
      totalMarkets: marketCount,
      winRate: '--',
      balance: '--',
      stake: '--',
      multiplier: '--',
    }
  }, [bets, marketCount])

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('VISUAL')}
            className={`px-3 py-1.5 rounded-card text-xs font-bold font-mono transition-colors ${
              activeTab === 'VISUAL'
                ? 'bg-terminal text-text-inverse'
                : 'bg-muted text-text-muted hover:text-text-primary'
            }`}
          >
            VISUAL
          </button>
          <button
            onClick={() => setActiveTab('SCRIPT')}
            className={`px-3 py-1.5 rounded-card text-xs font-bold font-mono transition-colors ${
              activeTab === 'SCRIPT'
                ? 'bg-terminal text-text-inverse'
                : 'bg-muted text-text-muted hover:text-text-primary'
            }`}
          >
            SCRIPT
          </button>
        </div>
        <span className="text-xs text-text-muted font-mono">
          Tick #{batch.currentTick} &middot; {batch.tickDuration / 60}min intervals
        </span>
      </div>

      {/* Tab content */}
      {historyLoading ? (
        <div className="py-8 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-border-medium border-t-terminal rounded-full animate-spin" />
        </div>
      ) : activeTab === 'VISUAL' ? (
        // Choose card vs compact layout based on market count
        marketCount <= 20 ? (
          <VisualTab
            batch={batch}
            history={history || []}
            bets={bets}
            onToggleBet={handleToggleBet}
          />
        ) : (
          <CompactVisualTab
            batch={batch}
            history={history || []}
            bets={bets}
            onToggleBet={handleToggleBet}
          />
        )
      ) : (
        <ScriptTab
          batch={batch}
          onBitmapGenerated={handleBitmapGenerated}
        />
      )}

      {/* Player stats footer */}
      <div className="flex flex-wrap gap-4 py-3 px-4 bg-muted rounded-card border border-border-light">
        <div>
          <span className="text-[10px] text-text-muted font-mono block">Bets Set</span>
          <span className="text-sm font-mono font-bold text-text-primary">
            {stats.betsSet}/{stats.totalMarkets}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-text-muted font-mono block">Win Rate</span>
          <span className="text-sm font-mono font-bold text-text-primary">{stats.winRate}</span>
        </div>
        <div>
          <span className="text-[10px] text-text-muted font-mono block">Balance</span>
          <span className="text-sm font-mono font-bold text-text-primary">{stats.balance}</span>
        </div>
        <div>
          <span className="text-[10px] text-text-muted font-mono block">Stake/Tick</span>
          <span className="text-sm font-mono font-bold text-text-primary">{stats.stake}</span>
        </div>
        <div>
          <span className="text-[10px] text-text-muted font-mono block">Multiplier</span>
          <span className="text-sm font-mono font-bold text-text-primary">{stats.multiplier}</span>
        </div>
      </div>

      {/* Action buttons row */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleAllUp}
          className="bg-color-up text-white px-3 py-2 rounded-card text-xs font-bold
                     hover:brightness-110 transition-all"
        >
          ALL {'\u25B2'}
        </button>
        <button
          onClick={handleAllDown}
          className="bg-color-down text-white px-3 py-2 rounded-card text-xs font-bold
                     hover:brightness-110 transition-all"
        >
          ALL {'\u25BC'}
        </button>
        <button
          className="bg-muted text-text-secondary px-3 py-2 rounded-card text-xs font-bold
                     hover:bg-surface transition-colors border border-border-light"
        >
          DEPOSIT
        </button>
        <button
          className="bg-muted text-text-secondary px-3 py-2 rounded-card text-xs font-bold
                     hover:bg-surface transition-colors border border-border-light"
        >
          WITHDRAW
        </button>
        <button
          className="bg-terminal text-text-inverse px-4 py-2 rounded-card text-xs font-bold
                     hover:opacity-90 transition-opacity ml-auto"
          disabled={stats.betsSet === 0}
        >
          SUBMIT
        </button>
      </div>
    </div>
  )
}
