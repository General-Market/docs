'use client'

import { useQuery } from '@tanstack/react-query'

interface SourceBatch {
  batchId: number
  playerCount: number
  totalPool: number
  avgPnl: number
  settledAt: string
  marketCount: number
}

async function fetchSourceHistory(sourceId: string): Promise<SourceBatch[]> {
  const res = await fetch(`/api/vision/source/${encodeURIComponent(sourceId)}/history`)
  if (!res.ok) return []
  const data = await res.json()
  return data.batches ?? []
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

interface BatchHistoryProps {
  sourceId: string
}

export function BatchHistory({ sourceId }: BatchHistoryProps) {
  const { data: batches, isLoading } = useQuery({
    queryKey: ['source-history', sourceId],
    queryFn: () => fetchSourceHistory(sourceId),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  if (isLoading || !batches || batches.length === 0) return null

  return (
    <div className="mt-6">
      <div className="section-bar">
        <div>
          <div className="section-bar-title">Past Rounds</div>
          <div className="section-bar-value">{batches.length} settled</div>
        </div>
      </div>

      <div className="bg-white border border-t-0 border-border-light overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[60px_80px_70px_80px_90px_1fr] items-center px-4 py-2 border-b border-border-light text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
          <div>Round</div>
          <div className="text-right">Players</div>
          <div className="text-right">Markets</div>
          <div className="text-right">Pool</div>
          <div className="text-right">Avg P&L</div>
          <div className="text-right">Settled</div>
        </div>

        {batches.map((batch) => {
          const pnlColor = batch.avgPnl > 0
            ? 'text-color-up'
            : batch.avgPnl < 0
              ? 'text-color-down'
              : 'text-text-muted'
          const pnlSign = batch.avgPnl > 0 ? '+' : ''

          return (
            <div
              key={batch.batchId}
              className="grid grid-cols-[60px_80px_70px_80px_90px_1fr] items-center px-4 py-2.5 border-b border-border-light last:border-0"
            >
              <div className="font-mono text-[12px] font-bold text-text-muted tabular-nums">
                #{batch.batchId}
              </div>
              <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
                {batch.playerCount}
              </div>
              <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
                {batch.marketCount}
              </div>
              <div className="text-right font-mono text-[12px] tabular-nums text-text-secondary">
                ${batch.totalPool.toFixed(2)}
              </div>
              <div className={`text-right font-mono text-[12px] tabular-nums font-semibold ${pnlColor}`}>
                {pnlSign}${Math.abs(batch.avgPnl).toFixed(2)}
              </div>
              <div className="text-right font-mono text-[11px] text-text-muted">
                {timeAgo(batch.settledAt)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
