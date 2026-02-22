'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import type { BatchInfo } from '@/hooks/p2pool/useBatches'
import { useBatchHistory } from '@/hooks/p2pool/useBatchHistory'
import { useBatchMetadata } from '@/hooks/p2pool/useBatchMetadata'
import { useVisionDeployerName } from '@/hooks/p2pool/useVisionDeployerName'
import { usePlayerPosition } from '@/hooks/p2pool/usePlayerPosition'
import { saveBets, getStoredBets, computeHitRate } from '@/lib/p2pool/bitmap-store'
import { VisualTab } from './VisualTab'
import { MarketAccordion } from './MarketAccordion'
import { ScriptTab } from './ScriptTab'
import { DepositModal } from './DepositModal'
import { WithdrawModal } from './WithdrawModal'

type TabType = 'VISUAL' | 'SCRIPT'

interface ExpandedBatchProps {
  batchId: number
  batch: BatchInfo
}

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/
  )
  return match?.[1] ?? null
}

export function ExpandedBatch({ batchId, batch }: ExpandedBatchProps) {
  const t = useTranslations('p2pool')
  const marketCount = batch.marketCount || batch.marketIds.length
  const defaultTab: TabType = marketCount > 100 ? 'SCRIPT' : 'VISUAL'
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)

  const { address: connectedAddress } = useAccount()
  const { metadata } = useBatchMetadata(batchId)
  const { name: deployerName } = useVisionDeployerName(
    batch.creator ? (batch.creator as `0x${string}`) : undefined
  )
  const ytId = metadata?.videoUrl ? getYouTubeId(metadata.videoUrl) : null

  // On-chain player position
  const { position, isJoined } = usePlayerPosition(batchId)

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

  // Bulk actions (global)
  const handleAllUp = useCallback(() => {
    const newBets: Record<string, boolean> = {}
    for (const id of batch.marketIds) newBets[id] = true
    setBets(newBets)
  }, [batch.marketIds])

  const handleAllDown = useCallback(() => {
    const newBets: Record<string, boolean> = {}
    for (const id of batch.marketIds) newBets[id] = false
    setBets(newBets)
  }, [batch.marketIds])

  // Per-category bulk actions (used by MarketAccordion)
  const handleBulkBet = useCallback((marketIds: string[], direction: boolean) => {
    setBets(prev => {
      const next = { ...prev }
      for (const id of marketIds) next[id] = direction
      return next
    })
  }, [])

  // Handle bitmap from script tab
  const handleBitmapGenerated = useCallback((bitmap: Record<string, boolean>) => {
    setBets(bitmap)
  }, [])

  // Save bets to localStorage on SUBMIT (for hit rate tracking)
  const handleSubmit = useCallback(() => {
    if (!connectedAddress || Object.keys(bets).length === 0) return
    // Save for hit rate computation
    saveBets(connectedAddress, batchId, batch.currentTick, bets)
    // TODO: wire to useJoinBatch / useSubmitBitmap for actual on-chain submission
  }, [connectedAddress, batchId, batch.currentTick, bets])

  // Compute hit rate from locally stored bitmaps
  const hitRate = useMemo(() => {
    if (!connectedAddress || !history?.length) return null
    const stored = getStoredBets(connectedAddress, batchId)
    if (stored.length === 0) return null
    return computeHitRate(stored, history)
  }, [connectedAddress, batchId, history])

  // Live stats from on-chain position
  const totalBets = Object.keys(bets).length
  const stats = useMemo(() => {
    if (!position) {
      return {
        balance: '--',
        stake: '--',
        pnl: '--',
        pnlClass: 'text-text-primary',
        multiplier: '--',
        winRate: hitRate ? `${hitRate.hitRate.toFixed(1)}%` : '--',
      }
    }

    const pnl = position.balance - position.totalDeposited + position.totalClaimed
    const pnlNum = parseFloat(formatUnits(pnl, 6))
    const multiplier = position.totalDeposited > 0n
      ? Number(((position.balance + position.totalClaimed) * 10000n) / position.totalDeposited) / 10000
      : 0

    return {
      balance: `$${parseFloat(formatUnits(position.balance, 6)).toFixed(2)}`,
      stake: `$${parseFloat(formatUnits(position.stakePerTick, 6)).toFixed(2)}`,
      pnl: `${pnlNum >= 0 ? '+' : ''}$${pnlNum.toFixed(2)}`,
      pnlClass: pnlNum >= 0 ? 'text-color-up' : 'text-color-down',
      multiplier: `${multiplier.toFixed(2)}x`,
      winRate: hitRate ? `${hitRate.hitRate.toFixed(1)}%` : '--',
    }
  }, [position, hitRate])

  return (
    <div className="space-y-4">
      {/* Metadata header */}
      {metadata && (
        <div className="space-y-3">
          {ytId && (
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${ytId}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {metadata.description && (
            <p className="text-sm text-text-secondary">{metadata.description}</p>
          )}
          {metadata.websiteUrl && (
            <a
              href={metadata.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-terminal hover:underline font-mono"
            >
              {metadata.websiteUrl.replace(/^https?:\/\//, '')}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      )}

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
            {t('expanded_batch.tabs.visual')}
          </button>
          <button
            onClick={() => setActiveTab('SCRIPT')}
            className={`px-3 py-1.5 rounded-card text-xs font-bold font-mono transition-colors ${
              activeTab === 'SCRIPT'
                ? 'bg-terminal text-text-inverse'
                : 'bg-muted text-text-muted hover:text-text-primary'
            }`}
          >
            {t('expanded_batch.tabs.script')}
          </button>
        </div>
        <span className="text-xs text-text-muted font-mono">
          {t('expanded_batch.tick_info', { tick: batch.currentTick, minutes: batch.tickDuration / 60 })}
        </span>
      </div>

      {/* Tab content */}
      {historyLoading ? (
        <div className="py-8 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-border-medium border-t-terminal rounded-full animate-spin" />
        </div>
      ) : activeTab === 'VISUAL' ? (
        // <=5 markets: card layout (VisualTab)
        // 6+ markets: accordion grouped by category (MarketAccordion)
        marketCount <= 5 ? (
          <VisualTab
            batch={batch}
            history={history || []}
            bets={bets}
            onToggleBet={handleToggleBet}
          />
        ) : (
          <MarketAccordion
            batch={batch}
            history={history || []}
            bets={bets}
            onToggleBet={handleToggleBet}
            onBulkBet={handleBulkBet}
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
          <span className="text-[10px] text-text-muted font-mono block">{t('expanded_batch.player_stats.bets_set')}</span>
          <span className="text-sm font-mono font-bold text-text-primary">
            {totalBets}/{marketCount}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-text-muted font-mono block">{t('expanded_batch.player_stats.win_rate')}</span>
          <span className="text-sm font-mono font-bold text-text-primary">
            {stats.winRate}
            {hitRate && hitRate.ticksAnalyzed > 0 && (
              <span className="text-[9px] text-text-muted ml-1">({hitRate.ticksAnalyzed}t)</span>
            )}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-text-muted font-mono block">{t('expanded_batch.player_stats.balance')}</span>
          <span className="text-sm font-mono font-bold text-text-primary">{stats.balance}</span>
        </div>
        <div>
          <span className="text-[10px] text-text-muted font-mono block">{t('expanded_batch.player_stats.pnl')}</span>
          <span className={`text-sm font-mono font-bold ${stats.pnlClass}`}>{stats.pnl}</span>
        </div>
        <div>
          <span className="text-[10px] text-text-muted font-mono block">{t('expanded_batch.player_stats.stake_per_tick')}</span>
          <span className="text-sm font-mono font-bold text-text-primary">{stats.stake}</span>
        </div>
        <div>
          <span className="text-[10px] text-text-muted font-mono block">{t('expanded_batch.player_stats.multiplier')}</span>
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
          {t('expanded_batch.actions.all_up')}
        </button>
        <button
          onClick={handleAllDown}
          className="bg-color-down text-white px-3 py-2 rounded-card text-xs font-bold
                     hover:brightness-110 transition-all"
        >
          {t('expanded_batch.actions.all_down')}
        </button>
        <button
          onClick={() => setShowDepositModal(true)}
          className="bg-muted text-text-secondary px-3 py-2 rounded-card text-xs font-bold
                     hover:bg-surface transition-colors border border-border-light"
        >
          {t('expanded_batch.actions.deposit')}
        </button>
        <button
          onClick={() => setShowWithdrawModal(true)}
          className="bg-muted text-text-secondary px-3 py-2 rounded-card text-xs font-bold
                     hover:bg-surface transition-colors border border-border-light"
        >
          {t('expanded_batch.actions.withdraw')}
        </button>
        <button
          onClick={handleSubmit}
          className="bg-terminal text-text-inverse px-4 py-2 rounded-card text-xs font-bold
                     hover:opacity-90 transition-opacity ml-auto"
          disabled={totalBets === 0}
        >
          {t('expanded_batch.actions.submit')}
        </button>
      </div>

      {/* Modals */}
      {showDepositModal && (
        <DepositModal
          batchId={batchId}
          onClose={() => setShowDepositModal(false)}
        />
      )}
      {showWithdrawModal && (
        <WithdrawModal
          batchId={batchId}
          onClose={() => setShowWithdrawModal(false)}
        />
      )}
    </div>
  )
}
