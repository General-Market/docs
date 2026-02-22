'use client'

import { BatchInfo } from '@/hooks/p2pool/useBatches'
import { SparklineHeader } from './headers/SparklineHeader'
import { BarGridHeader } from './headers/BarGridHeader'
import { HeatmapHeader } from './headers/HeatmapHeader'
import { BitmapMosaicHeader } from './headers/BitmapMosaicHeader'

interface BatchCardProps {
  batch: BatchInfo
  onClick: () => void
}

function BatchHeader({ marketIds }: { marketIds: string[] }) {
  const count = marketIds.length

  if (count <= 5) return <SparklineHeader marketIds={marketIds} />
  if (count <= 20) return <BarGridHeader marketIds={marketIds} />
  if (count <= 100) return <HeatmapHeader marketIds={marketIds} />
  return <BitmapMosaicHeader marketIds={marketIds} />
}

export function BatchCard({ batch, onClick }: BatchCardProps) {
  const marketCount = batch.marketIds.length

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border-light rounded-card p-4 cursor-pointer
                 hover:bg-card-hover hover:shadow-card-hover transition-all"
    >
      <BatchHeader marketIds={batch.marketIds} />

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
