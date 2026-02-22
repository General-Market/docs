'use client'

import { useTranslations } from 'next-intl'
import { BatchInfo } from '@/hooks/p2pool/useBatches'
import { useBatchMetadata } from '@/hooks/p2pool/useBatchMetadata'
import { useVisionDeployerName } from '@/hooks/p2pool/useVisionDeployerName'
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

/** Extract YouTube video ID from common URL formats */
function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/
  )
  return match?.[1] ?? null
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function BatchCard({ batch, onClick }: BatchCardProps) {
  const t = useTranslations('p2pool')
  const marketCount = batch.marketCount || batch.marketIds.length
  const tvlUsdc = parseFloat(batch.tvl) / 1e18
  const { metadata } = useBatchMetadata(batch.id)
  const { name: deployerName } = useVisionDeployerName(
    batch.creator ? (batch.creator as `0x${string}`) : undefined
  )

  // Thumbnail: imageUrl > YouTube thumbnail > default BatchHeader
  const ytId = metadata?.videoUrl ? getYouTubeId(metadata.videoUrl) : null
  const thumbnailUrl = metadata?.imageUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null)

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border-light rounded-card p-4 cursor-pointer
                 hover:bg-card-hover hover:shadow-card-hover transition-all"
    >
      {thumbnailUrl ? (
        <div className="w-full h-28 mb-3 rounded overflow-hidden bg-muted">
          <img
            src={thumbnailUrl}
            alt={metadata?.name || t('batch_card.batch_number', { id: batch.id })}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        batch.marketIds.length > 0 && <BatchHeader marketIds={batch.marketIds} />
      )}

      <h3 className="font-bold text-text-primary text-sm">
        {metadata?.name || t('batch_card.batch_number', { id: batch.id })}
      </h3>
      <p className="text-xs text-text-muted font-mono mt-0.5">
        {deployerName || truncateAddress(batch.creator || '0x0000...0000')}
      </p>
      <div className="flex gap-2 mt-1 text-xs text-text-secondary font-mono">
        <span>{t('batch_card.markets_count', { count: marketCount })}</span>
        <span>&middot;</span>
        <span>{t('batch_card.tick_duration', { minutes: batch.tickDuration / 60 })}</span>
        <span>&middot;</span>
        <span>{t('batch_card.players_count', { count: batch.playerCount })}</span>
        <span>&middot;</span>
        <span>{t('batch_card.tvl_usdc', { amount: tvlUsdc.toLocaleString() })}</span>
      </div>
    </div>
  )
}
