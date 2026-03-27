'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { useRounds, type RoundInfo } from '@/hooks/vision/useRounds'
import { usePlayerProfile } from '@/hooks/usePlayerProfile'

interface SourceBatch {
  batchId: number
  status: 'open' | 'settled'
  playerCount: number
  totalPool: number
  avgPnl: number
  topEarnerPnl?: number
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
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    if (!target) return
    const update = () => {
      const diff = Math.floor((new Date(target).getTime() - Date.now()) / 1000)
      setRemaining(diff)
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [target])
  return remaining
}

function formatTimer(secs: number) {
  if (secs <= 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Locks the bettingEnd timestamp per batchId so the timer counts to zero
 * instead of resetting when the oracle advances current_tick.
 *
 * Once a bettingEnd is recorded for a given batchId, subsequent polls that
 * return a different (later) bettingEnd are ignored — the original deadline
 * is the truth for this round's lifecycle.
 */
function useLockedBettingEnds(rounds: RoundInfo[], fallbackBettingEnd?: string | null) {
  const lockedRef = useRef<Map<number, string>>(new Map())

  // Lock bettingEnd for each round the first time we see it
  for (const round of rounds) {
    const raw = round.bettingEnd ?? fallbackBettingEnd ?? null
    if (raw && !lockedRef.current.has(round.batchId)) {
      lockedRef.current.set(round.batchId, raw)
    }
  }

  // Prune entries for rounds that disappeared (settled and gone from active list)
  const activeBatchIds = new Set(rounds.map(r => r.batchId))
  for (const [id] of lockedRef.current) {
    if (!activeBatchIds.has(id)) {
      lockedRef.current.delete(id)
    }
  }

  const getLockedBettingEnd = useCallback((batchId: number): string | null => {
    return lockedRef.current.get(batchId) ?? null
  }, [])

  return getLockedBettingEnd
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

/** Renders the timer cell for an active round showing close + settle phases */
function ActiveTimers({ bettingEnd, settlementEnd }: { bettingEnd: string | null; settlementEnd: string | null }) {
  const closeRemaining = useCountdown(bettingEnd)
  const settleRemaining = useCountdown(settlementEnd)

  // Phase 1: Betting open — show both timers
  if (closeRemaining > 0) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className={`font-mono text-[10px] tabular-nums ${closeRemaining < 60 ? 'text-color-down font-bold' : 'text-text-secondary'}`}>
          <span className="text-text-muted">Close</span> {formatTimer(closeRemaining)}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-text-muted">
          Settle {formatTimer(settleRemaining)}
        </span>
      </div>
    )
  }

  // Phase 2: Betting closed, waiting for settlement — show only settle timer
  if (settleRemaining > 0) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-mono text-[10px] text-color-warning font-bold">Closed</span>
        <span className={`font-mono text-[10px] tabular-nums ${settleRemaining < 30 ? 'text-color-down font-bold' : 'text-text-secondary'}`}>
          Settle {formatTimer(settleRemaining)}
        </span>
      </div>
    )
  }

  // Phase 3: Both expired — settling
  return (
    <span className="font-mono text-[10px] text-text-muted">Settling...</span>
  )
}

/** Status badge for active rounds */
function ActiveStatus({ bettingEnd }: { bettingEnd: string | null }) {
  const closeRemaining = useCountdown(bettingEnd)
  if (closeRemaining > 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-color-up opacity-50" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-color-up" />
        </span>
        <span className="text-[10px] font-bold text-color-up uppercase tracking-wider">Open</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-color-warning" />
      </span>
      <span className="text-[10px] font-bold text-color-warning uppercase tracking-wider">Closed</span>
    </div>
  )
}

// Grid: Round | Status | Players | Pool | Avg Swing | Top | Time
const GRID_COLS = 'grid-cols-[56px_72px_52px_64px_72px_64px_1fr]'

interface BatchHistoryProps {
  sourceId: string
  activeBatchId?: number
  bettingEnd?: string | null
  playerCount?: number
  tvl?: string
  tickDuration?: number
}

export function BatchHistory({ sourceId, activeBatchId, bettingEnd, playerCount, tvl, tickDuration }: BatchHistoryProps) {
  const [page, setPage] = useState(1)
  const { address } = useAccount()
  const { profile } = usePlayerProfile(address ?? '')

  // Set of batch IDs the connected wallet participated in
  const participatedBatches = useMemo(() => {
    if (!profile?.batches) return new Set<number>()
    return new Set(profile.batches.map(b => b.batchId))
  }, [profile?.batches])

  // Live rounds data — polls every 5s for real-time player counts
  const { data: rounds } = useRounds(sourceId)
  // Show ALL active rounds (betting + settling can overlap with 30s overlap)
  const activeRounds = (rounds ?? []).filter(r => r.status === 'betting' || r.status === 'settling')
  const liveRound = activeRounds[0] ?? null

  // Lock bettingEnd per batchId — prevents timer reset when oracle advances current_tick.
  // Once captured, a round's deadline is immutable until the round leaves the active list.
  const getLockedBettingEnd = useLockedBettingEnds(activeRounds, bettingEnd)

  // Prefer live round data over props for player count and pool
  const livePlayerCount = liveRound?.playerCount ?? playerCount ?? 0
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
  if (!activeBatch && settled.length === 0 && !isLoading) return null

  return (
    <div className="mt-6">
      <div className="section-bar">
        <div>
          <div className="section-bar-title">Round History</div>
          <div className="section-bar-value">
            {totalSettled} settled{activeBatch ? ' \u00b7 1 open' : ''}
          </div>
        </div>
      </div>

      <div className="bg-white border border-t-0 border-border-light overflow-hidden">
        {/* Header */}
        <div className={`grid ${GRID_COLS} items-center px-4 py-2 border-b border-border-light text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted`}>
          <div>Round</div>
          <div>Status</div>
          <div className="text-right">Players</div>
          <div className="text-right">Pool</div>
          <div className="text-right">Avg Swing</div>
          <div className="text-right">Top</div>
          <div className="text-right">Timers</div>
        </div>

        {/* Active rounds — show all (betting + settling can overlap) */}
        {page === 1 && activeRounds.map((round) => {
          // Use locked bettingEnd — immune to oracle tick advances
          const roundBettingEnd = getLockedBettingEnd(round.batchId)
          const roundTickDuration = round.timeframeSecs ?? liveTickDuration
          const roundSettlementEnd = roundBettingEnd && roundTickDuration
            ? new Date(new Date(roundBettingEnd).getTime() + roundTickDuration * 1000).toISOString()
            : null
          const pool = round.tvl ? parseFloat(round.tvl) / 1e18 : 0
          const participated = participatedBatches.has(round.batchId)

          return (
            <div
              key={round.batchId}
              className={`grid ${GRID_COLS} items-center px-4 py-2.5 border-b border-border-light ${
                participated ? 'bg-white' : 'bg-surface/60'
              }`}
            >
              <div className={`font-mono text-[12px] tabular-nums ${participated ? 'font-bold text-black' : 'font-bold text-black'}`}>
                #{round.batchId}
              </div>
              <ActiveStatus bettingEnd={roundBettingEnd} />
              <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
                {round.playerCount ?? 0}
              </div>
              <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
                ${pool < 0.01 ? '0' : pool.toFixed(2)}
              </div>
              <div className="text-right font-mono text-[12px] tabular-nums text-text-muted">{'\u2014'}</div>
              <div className="text-right font-mono text-[12px] tabular-nums text-text-muted">{'\u2014'}</div>
              <div className="text-right">
                <ActiveTimers bettingEnd={roundBettingEnd} settlementEnd={roundSettlementEnd} />
              </div>
            </div>
          )
        })}
        {/* Fallback: show single active batch from props if no live rounds */}
        {page === 1 && activeRounds.length === 0 && activeBatch && (
          <div className={`grid ${GRID_COLS} items-center px-4 py-2.5 border-b border-border-light bg-surface/60`}>
            <div className="font-mono text-[12px] font-bold text-black tabular-nums">
              #{activeBatch.batchId}
            </div>
            <ActiveStatus bettingEnd={bettingEnd ?? null} />
            <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
              {activeBatch.playerCount}
            </div>
            <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
              ${activeBatch.totalPool < 0.01 ? '0' : activeBatch.totalPool.toFixed(2)}
            </div>
            <div className="text-right font-mono text-[12px] tabular-nums text-text-muted">{'\u2014'}</div>
            <div className="text-right font-mono text-[12px] tabular-nums text-text-muted">{'\u2014'}</div>
            <div className="text-right">
              <ActiveTimers bettingEnd={bettingEnd ?? null} settlementEnd={settlementTime} />
            </div>
          </div>
        )}

        {/* Settled rows */}
        {settled.map((batch) => {
          const participated = participatedBatches.has(batch.batchId)
          // avgPnl = average absolute PnL (always >= 0, represents typical swing size)
          const swingColor = batch.avgPnl > 0 ? 'text-text-secondary' : 'text-text-muted'

          const topPnl = batch.topEarnerPnl ?? 0
          const topColor = topPnl > 0
            ? 'text-color-up'
            : topPnl < 0
              ? 'text-color-down'
              : 'text-text-muted'
          const topSign = topPnl > 0 ? '+' : ''

          return (
            <div
              key={batch.batchId}
              className={`grid ${GRID_COLS} items-center px-4 py-2.5 border-b border-border-light last:border-0 ${
                participated
                  ? 'bg-white'
                  : 'bg-surface/30'
              }`}
            >
              <div className={`font-mono text-[12px] tabular-nums ${participated ? 'font-bold text-black' : 'font-bold text-text-muted'}`}>
                #{batch.batchId}
              </div>
              <div className={`text-[10px] font-mono ${participated ? 'text-text-secondary' : 'text-text-muted'}`}>
                Settled
              </div>
              <div className={`text-right font-mono text-[12px] tabular-nums ${participated ? 'text-text-secondary' : 'text-text-muted'}`}>
                {batch.playerCount}
              </div>
              <div className={`text-right font-mono text-[12px] tabular-nums ${participated ? 'text-text-secondary' : 'text-text-muted'}`}>
                ${batch.totalPool.toFixed(2)}
              </div>
              <div className={`text-right font-mono text-[12px] tabular-nums font-semibold ${participated ? swingColor : 'text-text-muted'}`}>
                {batch.avgPnl > 0 ? `\u00B1$${batch.avgPnl.toFixed(2)}` : '\u2014'}
              </div>
              <div className={`text-right font-mono text-[12px] tabular-nums font-semibold ${participated ? topColor : 'text-text-muted'}`}>
                {topPnl !== 0 ? `${topSign}$${Math.abs(topPnl).toFixed(2)}` : '\u2014'}
              </div>
              <div className={`text-right font-mono text-[10px] ${participated ? 'text-text-secondary' : 'text-text-muted'}`}>
                <div className="flex flex-col items-end gap-0.5">
                  {batch.bettingEnd && (
                    <span>Closed {timeAgo(batch.bettingEnd)}</span>
                  )}
                  <span>Settled {timeAgo(batch.settledAt ?? batch.timestamp)}</span>
                  {batch.bettingEnd && batch.settledAt && (() => {
                    const durationSecs = Math.floor(
                      (new Date(batch.settledAt).getTime() - new Date(batch.bettingEnd).getTime()) / 1000
                    )
                    if (durationSecs <= 0) return null
                    const m = Math.floor(durationSecs / 60)
                    const s = durationSecs % 60
                    return <span className="text-text-muted">{m}:{s.toString().padStart(2, '0')} round</span>
                  })()}
                </div>
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
              Prev
            </button>
            <span className="text-[10px] font-mono text-text-muted tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="text-[11px] font-mono font-bold text-text-muted hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
