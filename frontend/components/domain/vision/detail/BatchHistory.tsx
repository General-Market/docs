'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

interface SourceBatch {
  batchId: number
  status: 'open' | 'settled'
  playerCount: number
  totalPool: number
  avgPnl: number
  timestamp: string
  bettingEnd?: string | null
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

function CountdownCell({ target }: { target: string }) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    const update = () => {
      const diff = Math.floor((new Date(target).getTime() - Date.now()) / 1000)
      setRemaining(Math.max(0, diff))
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [target])

  if (remaining <= 0) return <span className="font-mono text-[11px] text-color-warning">closing</span>
  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  return (
    <span className={`font-mono text-[11px] tabular-nums ${remaining < 60 ? 'text-color-down' : 'text-text-secondary'}`}>
      {m}:{s.toString().padStart(2, '0')}
    </span>
  )
}

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

  const { data, isLoading } = useQuery({
    queryKey: ['source-history', sourceId, page],
    queryFn: () => fetchSourceHistory(sourceId, page),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  // Build active batch entry from props (scheduler data, always accurate)
  const activeBatch: SourceBatch | null = activeBatchId ? {
    batchId: activeBatchId,
    status: 'open',
    playerCount: playerCount ?? 0,
    totalPool: tvl ? parseFloat(tvl) / 1e18 : 0,
    avgPnl: 0,
    timestamp: bettingEnd ?? new Date().toISOString(),
    bettingEnd,
  } : null

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
            {totalSettled} settled{activeBatch ? ' · 1 open' : ''}
          </div>
        </div>
      </div>

      <div className="bg-white border border-t-0 border-border-light overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[56px_72px_64px_72px_80px_1fr] items-center px-4 py-2 border-b border-border-light text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
          <div>Round</div>
          <div>Status</div>
          <div className="text-right">Players</div>
          <div className="text-right">Pool</div>
          <div className="text-right">Avg P&L</div>
          <div className="text-right">Time</div>
        </div>

        {/* Active batch — always first */}
        {activeBatch && page === 1 && (
          <div className="grid grid-cols-[56px_72px_64px_72px_80px_1fr] items-center px-4 py-2.5 border-b border-border-light bg-surface/60">
            <div className="font-mono text-[12px] font-bold text-black tabular-nums">
              #{activeBatch.batchId}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-color-up opacity-50" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-color-up" />
              </span>
              <span className="text-[10px] font-bold text-color-up uppercase tracking-wider">Open</span>
            </div>
            <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
              {activeBatch.playerCount}
            </div>
            <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
              ${activeBatch.totalPool < 0.01 ? '0' : activeBatch.totalPool.toFixed(2)}
            </div>
            <div className="text-right font-mono text-[12px] tabular-nums text-text-muted">
              —
            </div>
            <div className="text-right">
              {bettingEnd ? (
                <CountdownCell target={bettingEnd} />
              ) : (
                <span className="font-mono text-[11px] text-color-up">
                  {tickDuration ? `${Math.floor(tickDuration / 60)}m rounds` : 'open'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Settled rows */}
        {settled.map((batch) => {
          const pnlColor = batch.avgPnl > 0
            ? 'text-color-up'
            : batch.avgPnl < 0
              ? 'text-color-down'
              : 'text-text-muted'
          const pnlSign = batch.avgPnl > 0 ? '+' : ''

          return (
            <div
              key={batch.batchId}
              className="grid grid-cols-[56px_72px_64px_72px_80px_1fr] items-center px-4 py-2.5 border-b border-border-light last:border-0"
            >
              <div className="font-mono text-[12px] font-bold text-text-muted tabular-nums">
                #{batch.batchId}
              </div>
              <div className="text-[10px] font-mono text-text-muted">Settled</div>
              <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
                {batch.playerCount}
              </div>
              <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
                ${batch.totalPool.toFixed(2)}
              </div>
              <div className={`text-right font-mono text-[12px] tabular-nums font-semibold ${pnlColor}`}>
                {pnlSign}${Math.abs(batch.avgPnl).toFixed(2)}
              </div>
              <div className="text-right font-mono text-[11px] text-text-muted">
                {timeAgo(batch.timestamp)}
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
