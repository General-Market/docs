'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

interface SourceBatch {
  batchId: number
  status: 'betting' | 'settling' | 'settled'
  playerCount: number
  totalPool: number
  avgPnl: number
  timestamp: string
  marketCount: number
  bettingEnd?: string
  settlementDeadline?: string
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

  if (remaining <= 0) return <span className="font-mono text-[11px] text-color-warning">now</span>
  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  return (
    <span className={`font-mono text-[11px] tabular-nums ${remaining < 60 ? 'text-color-down' : 'text-text-secondary'}`}>
      {m}:{s.toString().padStart(2, '0')}
    </span>
  )
}

function StatusBadge({ batch }: { batch: SourceBatch }) {
  if (batch.status === 'betting') {
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
  if (batch.status === 'settling') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-color-warning opacity-50" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-color-warning" />
        </span>
        <span className="text-[10px] font-bold text-color-warning uppercase tracking-wider">Settling</span>
      </div>
    )
  }
  return <span className="text-[10px] font-mono text-text-muted">Settled</span>
}

export function BatchHistory({ sourceId }: { sourceId: string }) {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['source-history', sourceId, page],
    queryFn: () => fetchSourceHistory(sourceId, page),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  if (isLoading && !data) return null
  if (!data || data.batches.length === 0) return null

  const { batches, totalPages, totalSettled } = data
  const activeCount = batches.filter(b => b.status !== 'settled').length

  return (
    <div className="mt-6">
      <div className="section-bar">
        <div>
          <div className="section-bar-title">Round History</div>
          <div className="section-bar-value">
            {totalSettled} settled{activeCount > 0 ? ` · ${activeCount} active` : ''}
          </div>
        </div>
      </div>

      <div className="bg-white border border-t-0 border-border-light overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[56px_80px_72px_72px_80px_1fr] items-center px-4 py-2 border-b border-border-light text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
          <div>Round</div>
          <div>Status</div>
          <div className="text-right">Players</div>
          <div className="text-right">Pool</div>
          <div className="text-right">Avg P&L</div>
          <div className="text-right">Time</div>
        </div>

        {/* Rows */}
        {batches.map((batch) => {
          const pnlColor = batch.avgPnl > 0
            ? 'text-color-up'
            : batch.avgPnl < 0
              ? 'text-color-down'
              : 'text-text-muted'
          const pnlSign = batch.avgPnl > 0 ? '+' : ''
          const isActive = batch.status !== 'settled'

          return (
            <div
              key={batch.batchId}
              className={`grid grid-cols-[56px_80px_72px_72px_80px_1fr] items-center px-4 py-2.5 border-b border-border-light last:border-0 ${
                isActive ? 'bg-surface/60' : ''
              }`}
            >
              <div className="font-mono text-[12px] font-bold text-text-muted tabular-nums">
                #{batch.batchId}
              </div>
              <StatusBadge batch={batch} />
              <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
                {batch.playerCount}
              </div>
              <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
                ${batch.totalPool.toFixed(2)}
              </div>
              <div className={`text-right font-mono text-[12px] tabular-nums font-semibold ${isActive ? 'text-text-muted' : pnlColor}`}>
                {isActive ? '—' : `${pnlSign}$${Math.abs(batch.avgPnl).toFixed(2)}`}
              </div>
              <div className="text-right">
                {batch.status === 'betting' && batch.bettingEnd ? (
                  <CountdownCell target={batch.bettingEnd} />
                ) : batch.status === 'settling' && batch.settlementDeadline ? (
                  <CountdownCell target={batch.settlementDeadline} />
                ) : (
                  <span className="font-mono text-[11px] text-text-muted">{timeAgo(batch.timestamp)}</span>
                )}
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
