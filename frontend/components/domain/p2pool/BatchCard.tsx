'use client'

import { BatchInfo } from '@/hooks/p2pool/useBatches'

interface BatchCardProps {
  batch: BatchInfo
  onClick: () => void
}

export function BatchCard({ batch, onClick }: BatchCardProps) {
  const marketCount = batch.marketIds.length

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border-light rounded-card p-4 cursor-pointer
                 hover:bg-card-hover hover:shadow-card-hover transition-all"
    >
      {/* Animated header placeholder -- type depends on market count */}
      <div className="h-16 bg-surface rounded mb-3 flex items-center justify-center">
        <span className="text-text-muted text-xs font-mono">
          {marketCount <= 5 ? 'sparklines' :
           marketCount <= 20 ? 'bar grid' :
           marketCount <= 100 ? 'heatmap' : 'bitmap mosaic'}
        </span>
      </div>

      <h3 className="font-bold text-text-primary text-sm">
        Batch #{batch.id}
      </h3>
      <div className="flex gap-2 mt-1 text-xs text-text-secondary font-mono">
        <span>{marketCount} mkts</span>
        <span>&middot;</span>
        <span>{batch.tickDuration / 60}min</span>
        <span>&middot;</span>
        <span>{batch.playerCount} players</span>
        <span>&middot;</span>
        <span>${parseFloat(batch.tvl).toLocaleString()}</span>
      </div>
    </div>
  )
}
