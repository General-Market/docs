'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useSharedCountdown } from '@/hooks/useSharedCountdown'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { useRounds, type RoundInfo } from '@/hooks/vision/useRounds'
import { usePlayerProfile } from '@/hooks/usePlayerProfile'
import { useTranslations } from 'next-intl'

interface SourceBatch {
  batchId: number
  status: 'open' | 'settled'
  playerCount: number
  totalPool: number
  avgPnl: number
  /** Top earner's net P&L (signed). */
  topEarnerPnl?: number
  /** Largest gross payout in the round (>= 0). */
  topPayout?: number
  topEarnerAddress?: string | null
  timestamp: string
  bettingStart?: string | null
  bettingEnd?: string | null
  settledAt?: string | null
  marketCount?: number | null
}

interface HistoryResponse {
  batches: SourceBatch[]
  page: number
  perPage: number
  totalSettled: number
  totalPages: number
}

async function fetchSourceHistory(sourceId: string, page: number): Promise<HistoryResponse> {
  const res = await fetch(`/api/vision/source/${encodeURIComponent(sourceId)}/history?page=${page}&per_page=10`)
  if (!res.ok) return { batches: [], page: 1, perPage: 10, totalSettled: 0, totalPages: 0 }
  return res.json()
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'now'
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function useCountdown(target: string | null) {
  return useSharedCountdown(target)
}

function formatTimer(secs: number) {
  if (secs <= 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Locks bettingEnd per batchId AND retains rounds through their settlement
 * window, even after the oracle stops returning them.
 *
 * When the oracle advances current_tick, it returns a NEW batchId. The old
 * round vanishes from the API. Without retention the UI jumps from "Open"
 * to nothing. This hook keeps the old round locally until bettingEnd +
 * tickDuration expires, giving the row time to show CLOSED / Settle X:XX.
 */
interface LockedRound {
  batchId: number
  bettingEnd: string
  timeframeSecs: number
  playerCount: number
  tvl: string
}

function useLockedRounds(
  oracleRounds: RoundInfo[],
  fallbackBettingEnd?: string | null,
) {
  const lockedRef = useRef<Map<number, LockedRound>>(new Map())

  for (const round of oracleRounds) {
    const raw = round.bettingEnd ?? fallbackBettingEnd ?? null
    if (raw) {
      const existing = lockedRef.current.get(round.batchId)
      if (!existing) {
        // First time seeing this round, lock bettingEnd and timeframe
        lockedRef.current.set(round.batchId, {
          batchId: round.batchId,
          bettingEnd: raw,
          timeframeSecs: round.timeframeSecs ?? 300,
          playerCount: round.playerCount ?? 0,
          tvl: round.tvl ?? '0',
        })
      } else {
        // Round already locked, update mutable fields (playerCount, tvl)
        // but keep bettingEnd and timeframeSecs frozen (they must not drift)
        existing.playerCount = round.playerCount ?? existing.playerCount
        existing.tvl = round.tvl ?? existing.tvl
      }
    }
  }

  const now = Date.now()
  for (const [id, locked] of lockedRef.current) {
    const settlementEnd = new Date(locked.bettingEnd).getTime() + locked.timeframeSecs * 1000
    if (settlementEnd < now) {
      lockedRef.current.delete(id)
    }
  }

  const oracleBatchIds = new Set(oracleRounds.map(r => r.batchId))

  const getLockedBettingEnd = useCallback((batchId: number): string | null => {
    return lockedRef.current.get(batchId)?.bettingEnd ?? null
  }, [])

  const retainedRounds: LockedRound[] = []
  for (const [id, locked] of lockedRef.current) {
    if (!oracleBatchIds.has(id)) {
      retainedRounds.push(locked)
    }
  }

  return { getLockedBettingEnd, retainedRounds }
}

/** Format an ISO timestamp for display in tooltips */
function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

/** Truncate an address: 0x029...abc */
function truncAddr(addr: string): string {
  if (addr.length < 10) return addr
  return `${addr.slice(0, 5)}...${addr.slice(-3)}`
}

/** Renders the timer cell for an active round showing close + settle phases */
function ActiveTimers({ bettingEnd, settlementEnd, playerCount }: { bettingEnd: string | null; settlementEnd: string | null; playerCount?: number }) {
  const t = useTranslations('vision')
  const closeRemaining = useCountdown(bettingEnd)
  const settleRemaining = useCountdown(settlementEnd)

  // Phase 1: Betting open, show both timers
  if (closeRemaining > 0) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className={`font-mono text-[10px] tabular-nums ${closeRemaining < 60 ? 'text-color-down font-bold' : 'text-text-secondary'}`}>
          <span className="text-text-muted">{t('batch_detail.close')}</span> {formatTimer(closeRemaining)}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-text-muted">
          {t('batch_detail.settle')} {formatTimer(settleRemaining)}
        </span>
      </div>
    )
  }

  // Phase 2: Betting closed, waiting for settlement, show only settle timer
  if (settleRemaining > 0) {
    // Empty rounds (0 players) will never settle on-chain, oracle skips them.
    // Show "No players" instead of a countdown to nowhere.
    if (playerCount === 0) {
      return (
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-mono text-[10px] text-text-muted">{t('batch_detail.closed')}</span>
          <span className="font-mono text-[10px] text-text-muted">{t('batch_detail.no_players')}</span>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-mono text-[10px] text-color-warning font-bold">{t('batch_detail.closed')}</span>
        <span className={`font-mono text-[10px] tabular-nums ${settleRemaining < 30 ? 'text-color-down font-bold' : 'text-text-secondary'}`}>
          {t('batch_detail.settle')} {formatTimer(settleRemaining)}
        </span>
      </div>
    )
  }

  // Phase 3: Both expired, empty rounds just vanish, populated rounds show settling
  if (playerCount === 0) {
    return <span className="font-mono text-[10px] text-text-muted">{t('batch_detail.skipped')}</span>
  }
  return (
    <span className="font-mono text-[10px] text-text-muted">{t('batch_detail.settling')}</span>
  )
}

/** Status badge for active rounds */
function ActiveStatus({ bettingEnd }: { bettingEnd: string | null }) {
  const t = useTranslations('vision')
  const closeRemaining = useCountdown(bettingEnd)
  if (closeRemaining > 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-color-up opacity-50" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-color-up" />
        </span>
        <span className="text-[10px] font-bold text-color-up uppercase tracking-wider">{t('batch_detail.open')}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-color-warning" />
      </span>
      <span className="text-[10px] font-bold text-color-warning uppercase tracking-wider">{t('batch_detail.closed')}</span>
    </div>
  )
}

// Grid: Round | Status | Players | Pool | Result | Time
// Use minmax with fr units so columns breathe on narrow screens
const GRID_COLS = 'grid-cols-[minmax(48px,0.7fr)_minmax(52px,0.8fr)_minmax(40px,0.6fr)_minmax(48px,0.7fr)_minmax(80px,1.4fr)_minmax(56px,0.8fr)]'

interface BatchHistoryProps {
  sourceId: string
  activeBatchId?: number
  bettingEnd?: string | null
  playerCount?: number
  tvl?: string
  tickDuration?: number
  /** On-chain confirmation that the connected wallet is in the active batch.
   *  When true and oracle playerCount is 0, we floor at 1. Chain wins over API lag. */
  isJoinedOnChain?: boolean
}

export function BatchHistory({ sourceId, activeBatchId, bettingEnd, playerCount, tvl, tickDuration, isJoinedOnChain }: BatchHistoryProps) {
  const t = useTranslations('vision')
  const [page, setPage] = useState(1)
  const { address } = useAccount()
  const { profile } = usePlayerProfile(address ?? '')

  // Map: batchId → { pnl, deposited } for rounds the connected wallet participated in
  const participatedBatches = useMemo(() => {
    if (!profile?.batches) return new Map<number, { pnl: number; deposited: number }>()
    const map = new Map<number, { pnl: number; deposited: number }>()
    for (const b of profile.batches) {
      map.set(b.batchId, { pnl: b.balance - b.deposited, deposited: b.deposited })
    }
    return map
  }, [profile?.batches])

  // Live rounds data, polls every 5s for real-time player counts
  const { data: rounds } = useRounds(sourceId)
  // Only show the LATEST active round (highest batchId that's still betting/settling).
  // Old stale rounds with expired bettingEnd used to leak through, now we pick one.
  const activeRounds = useMemo(() => {
    if (!rounds || rounds.length === 0) return []
    const candidates = rounds.filter(
      r => r.status === 'betting' || r.status === 'settling'
    )
    if (candidates.length === 0) return []
    // Highest batchId = newest round
    const latest = candidates.reduce((a, b) => (b.batchId > a.batchId ? b : a))
    return [latest]
  }, [rounds])
  const liveRound = activeRounds[0] ?? null

  // Lock bettingEnd per batchId and retain rounds through settlement window.
  // When the oracle advances current_tick and stops returning the old batchId,
  // retainedRounds keeps it alive so the UI shows "CLOSED / Settle X:XX".
  const { getLockedBettingEnd, retainedRounds } = useLockedRounds(activeRounds, bettingEnd)

  // Prefer live round data over props for player count and pool.
  // When on-chain says "joined" but oracle says 0, floor at 1, chain is truth.
  const rawPlayerCount = liveRound?.playerCount ?? playerCount ?? 0
  const livePlayerCount = isJoinedOnChain ? Math.max(rawPlayerCount, 1) : rawPlayerCount
  const livePool = liveRound?.tvl ?? tvl
  const liveTickDuration = tickDuration ?? liveRound?.timeframeSecs ?? 0

  const { data, isLoading } = useQuery({
    queryKey: ['source-history', sourceId, page],
    queryFn: () => fetchSourceHistory(sourceId, page),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  // Build active batch entry from live data
  const activeBatch: SourceBatch | null = activeBatchId ? {
    batchId: activeBatchId,
    status: 'open',
    playerCount: livePlayerCount,
    totalPool: livePool ? parseFloat(livePool) / 1e18 : 0,
    avgPnl: 0,
    timestamp: bettingEnd ?? new Date().toISOString(),
    bettingEnd,
  } : null

  // Settlement time = bettingEnd + tickDuration
  const settlementTime = bettingEnd && liveTickDuration
    ? new Date(new Date(bettingEnd).getTime() + liveTickDuration * 1000).toISOString()
    : null

  const settled = data?.batches?.filter(b => b.status === 'settled') ?? []
  const totalPages = data?.totalPages ?? 0
  const totalSettled = data?.totalSettled ?? 0

  // Nothing to show
  if (!activeBatch && retainedRounds.length === 0 && settled.length === 0 && !isLoading) return null

  return (
    <div className="mt-6">
      <div className="section-bar">
        <div>
          <div className="section-bar-title">{t('batch_detail.round_history')}</div>
          <div className="section-bar-value">
            {t('batch_detail.settled_count', { count: totalSettled })}{activeBatch ? ` \u00b7 ${t('batch_detail.open_count', { count: 1 })}` : ''}
          </div>
        </div>
      </div>

      <div className="bg-white border border-t-0 border-border-light overflow-hidden">
        {/* Header */}
        <div className={`grid ${GRID_COLS} items-center px-4 py-2 border-b border-border-light text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted`}>
          <div>{t('batch_detail.round')}</div>
          <div>{t('batch_detail.status')}</div>
          <div className="text-right">{t('batch_detail.players')}</div>
          <div className="text-right">{t('batch_detail.pool')}</div>
          <div className="text-right">{t('batch_detail.result')}</div>
          <div className="text-right">{t('batch_detail.time')}</div>
        </div>

        {/* ── Current round: single row that transitions through phases ──
            Open → Close countdown → Settle countdown → next round.
            No duplicate rows, no flicker. The latest active round is always
            shown. When it closes, the retained round shows settlement.
            When the next round opens, it seamlessly replaces it. */}
        {page === 1 && (() => {
          // Pick what to show: live round first, then retained, then props fallback
          const live = activeRounds[0] ?? null
          const retained = retainedRounds[0] ?? null

          // Determine the "current" display round, the one actively counting down.
          // If a live round exists (betting phase), show it.
          // If only a retained round exists (settling phase), show that.
          // If neither, fall back to activeBatch from props.
          const displayRound = live ?? retained
          if (!displayRound && !activeBatch) return null

          const batchId = displayRound
            ? ('batchId' in displayRound ? displayRound.batchId : 0)
            : activeBatch!.batchId
          const roundBettingEnd = displayRound
            ? (live ? getLockedBettingEnd(live.batchId) : (retained?.bettingEnd ?? null))
            : bettingEnd ?? null
          const roundTickDuration = displayRound
            ? ('timeframeSecs' in displayRound ? displayRound.timeframeSecs : liveTickDuration)
            : liveTickDuration
          const roundSettlementEnd = roundBettingEnd && roundTickDuration
            ? new Date(new Date(roundBettingEnd).getTime() + roundTickDuration * 1000).toISOString()
            : null
          const rawPool = displayRound
            ? parseFloat(('tvl' in displayRound ? displayRound.tvl : '0') || '0') / 1e18
            : activeBatch?.totalPool ?? 0
          const participated = participatedBatches.has(batchId)
          const knownJoined = participated || (isJoinedOnChain && batchId === activeBatchId)
          const userEntry = participatedBatches.get(batchId)
          const rawPlayers = displayRound
            ? ('playerCount' in displayRound ? displayRound.playerCount : 0)
            : activeBatch?.playerCount ?? 0
          const players = knownJoined ? Math.max(rawPlayers, 1) : rawPlayers
          const pool = participated && userEntry ? Math.max(rawPool, userEntry.deposited) : rawPool

          return (
            <div
              key={batchId}
              className={`grid ${GRID_COLS} items-center px-4 py-2.5 border-b border-border-light ${
                participated ? 'bg-white' : 'bg-surface/60'
              }`}
            >
              <div className="font-mono text-[12px] tabular-nums font-bold text-black">
                #{batchId}
              </div>
              <ActiveStatus bettingEnd={roundBettingEnd} />
              <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
                {players}
              </div>
              <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
                ${pool < 0.01 ? '0' : pool.toFixed(2)}
              </div>
              <div className="text-right font-mono text-[10px] tabular-nums text-text-muted">{'\u2014'}</div>
              <div className="text-right">
                <ActiveTimers bettingEnd={roundBettingEnd} settlementEnd={roundSettlementEnd} playerCount={players} />
              </div>
            </div>
          )
        })()}
        {/* (legacy fallback removed, single current round IIFE handles all states) */}

        {/* Settled rows */}
        {settled.map((batch) => {
          const participated = participatedBatches.has(batch.batchId)
          const topPnl = batch.topEarnerPnl ?? 0
          const topSign = topPnl > 0 ? '+' : ''
          const topAddr = batch.topEarnerAddress ?? null

          // Build tooltip from lifecycle data
          const tooltipLines: string[] = []
          if (batch.bettingStart) tooltipLines.push(`Opened: ${formatTimestamp(batch.bettingStart)}`)
          if (batch.bettingEnd) tooltipLines.push(`Closed: ${formatTimestamp(batch.bettingEnd)}`)
          if (batch.settledAt) tooltipLines.push(`Settled: ${formatTimestamp(batch.settledAt)}`)
          else tooltipLines.push(`Settled: ${formatTimestamp(batch.timestamp)}`)
          if (batch.marketCount != null) tooltipLines.push(`Markets: ${batch.marketCount}`)
          if (batch.avgPnl > 0) tooltipLines.push(`Avg swing: \u00B1$${batch.avgPnl.toFixed(2)}`)
          if (batch.bettingEnd && batch.settledAt) {
            const dur = Math.floor((new Date(batch.settledAt).getTime() - new Date(batch.bettingEnd).getTime()) / 1000)
            if (dur > 0) {
              const m = Math.floor(dur / 60)
              const s = dur % 60
              tooltipLines.push(`Settlement: ${m}:${s.toString().padStart(2, '0')}`)
            }
          }

          // Result column: "You won $X" / "0x029...abc won $X" / "Tie"
          const userEntry = participatedBatches.get(batch.batchId)
          const userPnl = userEntry?.pnl
          let winnerText: string | null = null
          let winnerTitle: string | null = null
          let winnerPnl = topPnl
          if (participated && userPnl !== undefined) {
            const uSign = userPnl >= 0 ? '+' : '-'
            winnerText = `You ${uSign}$${Math.abs(userPnl).toFixed(2)}`
            winnerPnl = userPnl
          } else if (topAddr && topPnl > 0) {
            winnerText = `+$${topPnl.toFixed(2)}`
            winnerTitle = `${truncAddr(topAddr)} won $${topPnl.toFixed(2)}`
          } else if (topAddr && topPnl !== 0) {
            winnerText = `${topSign}$${Math.abs(topPnl).toFixed(2)}`
            winnerTitle = `${truncAddr(topAddr)} ${topSign}$${Math.abs(topPnl).toFixed(2)}`
          } else if (batch.playerCount > 0) {
            winnerText = 'Tie'
          }

          return (
            <div
              key={batch.batchId}
              title={tooltipLines.join('\n')}
              className={`grid ${GRID_COLS} items-center px-4 py-2 border-b border-border-light last:border-0 cursor-default transition-colors hover:bg-surface/50 ${
                participated ? 'bg-white' : 'bg-surface/30'
              }`}
            >
              <div className={`font-mono text-[12px] tabular-nums ${participated ? 'font-bold text-black' : 'font-bold text-text-muted'}`}>
                #{batch.batchId}
              </div>
              <div className={`text-[10px] font-mono ${participated ? 'text-text-secondary' : 'text-text-muted'}`}>
                {t('batch_detail.settled')}
              </div>
              <div className={`text-right font-mono text-[12px] tabular-nums ${participated ? 'text-text-secondary' : 'text-text-muted'}`}>
                {batch.playerCount}
              </div>
              <div className={`text-right font-mono text-[12px] tabular-nums ${participated ? 'text-text-secondary' : 'text-text-muted'}`}>
                ${batch.totalPool.toFixed(2)}
              </div>
              {/* Winner: "You: +$X" when participated, "0xABC...def +$X" otherwise */}
              <div className={`text-right font-mono text-[11px] tabular-nums truncate ${
                winnerText
                  ? participated
                    ? winnerPnl > 0 ? 'text-color-up font-semibold' : 'text-color-down font-semibold'
                    : 'text-text-muted'
                  : 'text-text-muted'
              }`} title={winnerTitle ?? winnerText ?? undefined}>
                {winnerText ?? '\u2014'}
              </div>
              <div className={`text-right font-mono text-[10px] ${participated ? 'text-text-secondary' : 'text-text-muted'}`}>
                {timeAgo(batch.settledAt ?? batch.timestamp)}
              </div>
            </div>
          )
        })}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border-light bg-surface/30">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="text-[11px] font-mono font-bold text-text-muted hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {t('batch_detail.prev')}
            </button>
            <span className="text-[10px] font-mono text-text-muted tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="text-[11px] font-mono font-bold text-text-muted hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {t('batch_detail.next')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
