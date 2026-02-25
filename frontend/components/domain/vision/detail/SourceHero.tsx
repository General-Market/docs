'use client'

import type { VisionSource } from '@/lib/vision/sources'
import type { SourceSchedule } from '@/hooks/vision/useMarketSnapshot'
import { getCategoryLabel } from '@/lib/vision/source-categories'

interface SourceHeroProps {
  source: VisionSource
  sourceSchedule?: SourceSchedule
  marketCount?: number
}

function formatLastSync(lastSync: string | null): string {
  if (!lastSync) return '--'
  const date = new Date(lastSync)
  const now = Date.now()
  const diffMs = now - date.getTime()
  if (diffMs < 60_000) return 'just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`
  return date.toLocaleDateString()
}

export function SourceHero({ source, sourceSchedule, marketCount }: SourceHeroProps) {
  const isLive = sourceSchedule?.status === 'healthy'
  const categoryLabel = getCategoryLabel(source.category)

  return (
    <div className="rounded-lg border border-border-light overflow-hidden bg-white">
      {/* Brand image area */}
      <div
        className="h-[140px] flex items-center justify-center relative"
        style={{ background: source.brandBg }}
      >
        <img
          src={source.logo}
          alt={source.name}
          className="max-h-[80px] max-w-[90%] object-contain"
        />
      </div>

      {/* Info section */}
      <div className="bg-surface px-5 py-4">
        {/* Badge row */}
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.08em] bg-black/5 text-text-secondary">
            {categoryLabel}
          </span>
          {sourceSchedule && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.08em] ${
                isLive
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLive ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              {isLive ? 'LIVE' : 'OFFLINE'}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-[24px] font-black tracking-[-0.02em] text-black leading-tight">
          {source.name}
        </h1>

        {/* Description */}
        {source.description && (
          <p className="text-[13px] text-text-muted leading-relaxed mt-1.5">
            {source.description}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border-light">
          {marketCount !== undefined && marketCount > 0 && (
            <div className="text-[12px]">
              <span className="text-text-muted font-medium">Markets </span>
              <span className="font-bold text-black font-mono tabular-nums">{marketCount}</span>
            </div>
          )}
          {sourceSchedule && (
            <>
              <div className="flex items-center gap-1.5 text-[12px]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isLive ? 'bg-green-500' : 'bg-zinc-300'
                  }`}
                />
                <span className="text-text-muted font-medium">
                  {isLive ? 'Healthy' : sourceSchedule.status}
                </span>
              </div>
              {sourceSchedule.lastSync && (
                <div className="text-[12px]">
                  <span className="text-text-muted font-medium">Synced </span>
                  <span className="font-semibold text-text-primary">
                    {formatLastSync(sourceSchedule.lastSync)}
                  </span>
                </div>
              )}
            </>
          )}
          <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.08em] bg-black text-white">
            API
          </span>
        </div>
      </div>
    </div>
  )
}
