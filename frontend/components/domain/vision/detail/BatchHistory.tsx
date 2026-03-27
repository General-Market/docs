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
 * Locks bettingEnd per batchId AND retains rounds through their settlement
 * window — even after the oracle stops returning them.
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
        // First time seeing this round — lock bettingEnd and timeframe
        lockedRef.current.set(round.batchId, {
          batchId: round.batchId,
          bettingEnd: raw,
          timeframeSecs: round.timeframeSecs ?? 300,
          playerCount: round.playerCount ?? 0,
          tvl: round.tvl ?? '0',
        })
      } else {
        // Round already locked — update mutable fields (playerCount, tvl)
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
    // Empty rounds (0 players) will never settle on-chain — oracle skips them.
    // Show "No players" instead of a countdown to nowhere.
    if (playerCount === 0) {
      return (
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-mono text-[10px] text-text-muted">Closed</span>
          <span className="font-mono text-[10px] text-text-muted">No players</span>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-mono text-[10px] text-color-warning font-bold">Closed</span>
        <span className={`font-mono text-[10px] tabular-nums ${settleRemaining < 30 ? 'text-color-down font-bold' : 'text-text-secondary'}`}>
          Settle {formatTimer(settleRemaining)}
        </span>
      </div>
    )
  }

  // Phase 3: Both expired — empty rounds just vanish, populated rounds show settling
  if (playerCount === 0) {
    return <span className="font-mono text-[10px] text-text-muted">Skipped</span>
  }
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

// Grid: Round | Status | Players | Pool | Winner | Time
const GRID_COLS = 'grid-cols-[56px_64px_52px_60px_1fr_90px]'

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

  // Live rounds data — polls every 5s for real-time player counts
  const { data: rounds } = useRounds(sourceId)
  // Only show the LATEST active round (highest batchId that's still betting/settling).
  // Old stale rounds with expired bettingEnd used to leak through — now we pick one.
  const activeRounds = useMemo(() => {
    const candidates = (rounds ?? []).filter(
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
  // When on-chain says "joined" but oracle says 0, floor at 1 — chain is truth.
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
          <div className="text-right">Winner</div>
          <div className="text-right">Time</div>
        </div>

        {/* Active rounds — show all (betting + settling can overlap) */}
        {page === 1 && activeRounds.map((round) => {
          // Use locked bettingEnd — immune to oracle tick advances
          const roundBettingEnd = getLockedBettingEnd(round.batchId)
          const roundTickDuration = round.timeframeSecs ?? liveTickDuration
          const roundSettlementEnd = roundBettingEnd && roundTickDuration
            ? new Date(new Date(roundBettingEnd).getTime() + roundTickDuration * 1000).toISOString()
            : null
          const rawPool = round.tvl ? parseFloat(round.tvl) / 1e18 : 0
          const participated = participatedBatches.has(round.batchId)
          // On-chain join confirmation applies to the active batch even before oracle syncs
          const knownJoined = participated || (isJoinedOnChain && round.batchId === activeBatchId)
          const userEntry = participatedBatches.get(round.batchId)
          // Reconcile: if user is in this batch but oracle lags, floor at their deposit
          const players = knownJoined ? Math.max(round.playerCount ?? 0, 1) : (round.playerCount ?? 0)
          const pool = participated && userEntry ? Math.max(rawPool, userEntry.deposited) : rawPool

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
        })}
        {/* Retained rounds — oracle dropped them but settlement window still open.
            These show the CLOSED/Settle countdown that would otherwise be lost. */}
        {page === 1 && retainedRounds.map((locked) => {
          const roundSettlementEnd = new Date(
            new Date(locked.bettingEnd).getTime() + locked.timeframeSecs * 1000
          ).toISOString()
          const rawPool = locked.tvl ? parseFloat(locked.tvl) / 1e18 : 0
          const participated = participatedBatches.has(locked.batchId)
          const userEntry = participatedBatches.get(locked.batchId)
          const players = participated ? Math.max(locked.playerCount, 1) : locked.playerCount
          const pool = participated && userEntry ? Math.max(rawPool, userEntry.deposited) : rawPool

          return (
            <div
              key={`retained-${locked.batchId}`}
              className={`grid ${GRID_COLS} items-center px-4 py-2.5 border-b border-border-light ${
                participated ? 'bg-white' : 'bg-surface/60'
              }`}
            >
              <div className="font-mono text-[12px] tabular-nums font-bold text-black">
                #{locked.batchId}
              </div>
              <ActiveStatus bettingEnd={locked.bettingEnd} />
              <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
                {players}
              </div>
              <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
                ${pool < 0.01 ? '0' : pool.toFixed(2)}
              </div>
              <div className="text-right font-mono text-[10px] tabular-nums text-text-muted">{'\u2014'}</div>
              <div className="text-right">
                <ActiveTimers bettingEnd={locked.bettingEnd} settlementEnd={roundSettlementEnd} playerCount={players} />
              </div>
            </div>
          )
        })}
        {/* Fallback: show single active batch from props if no live or retained rounds */}
        {page === 1 && activeRounds.length === 0 && retainedRounds.length === 0 && activeBatch && (() => {
          const participated = participatedBatches.has(activeBatch.batchId)
          const knownJoined = participated || !!isJoinedOnChain
          const userEntry = participatedBatches.get(activeBatch.batchId)
          const players = knownJoined ? Math.max(activeBatch.playerCount, 1) : activeBatch.playerCount
          const pool = participated && userEntry ? Math.max(activeBatch.totalPool, userEntry.deposited) : activeBatch.totalPool
          return (
          <div className={`grid ${GRID_COLS} items-center px-4 py-2.5 border-b border-border-light ${participated ? 'bg-white' : 'bg-surface/60'}`}>
            <div className="font-mono text-[12px] font-bold text-black tabular-nums">
              #{activeBatch.batchId}
            </div>
            <ActiveStatus bettingEnd={bettingEnd ?? null} />
            <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
              {players}
            </div>
            <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
              ${pool < 0.01 ? '0' : pool.toFixed(2)}
            </div>
            <div className="text-right font-mono text-[10px] tabular-nums text-text-muted">{'\u2014'}</div>
            <div className="text-right">
              <ActiveTimers bettingEnd={bettingEnd ?? null} settlementEnd={settlementTime} playerCount={players} />
            </div>
          </div>
          )
        })()}

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

          // Winner column: participated → "You: +$X.XX", else "0x029...abc +$0.71"
          const userEntry = participatedBatches.get(batch.batchId)
          const userPnl = userEntry?.pnl
          let winnerText: string | null = null
          let winnerPnl = topPnl
          if (participated && userPnl !== undefined) {
            const uSign = userPnl > 0 ? '+' : ''
            winnerText = `You: ${uSign}$${Math.abs(userPnl).toFixed(2)}`
            winnerPnl = userPnl
          } else if (topPnl !== 0 && topAddr) {
            winnerText = `${truncAddr(topAddr)} ${topSign}$${Math.abs(topPnl).toFixed(2)}`
          } else if (topPnl !== 0) {
            winnerText = `${topSign}$${Math.abs(topPnl).toFixed(2)}`
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
                Settled
              </div>
              <div className={`text-right font-mono text-[12px] tabular-nums ${participated ? 'text-text-secondary' : 'text-text-muted'}`}>
                {batch.playerCount}
              </div>
              <div className={`text-right font-mono text-[12px] tabular-nums ${participated ? 'text-text-secondary' : 'text-text-muted'}`}>
                ${batch.totalPool.toFixed(2)}
              </div>
              {/* Winner: "You: +$X" when participated, "0xABC...def +$X" otherwise */}
              <div className={`text-right font-mono text-[11px] tabular-nums ${
                winnerText
                  ? participated
                    ? winnerPnl > 0 ? 'text-color-up font-semibold' : 'text-color-down font-semibold'
                    : 'text-text-muted'
                  : 'text-text-muted'
              }`}>
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
