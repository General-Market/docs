'use client'

import type { VisionSource } from '@/lib/vision/sources'
import type { SourceSchedule } from '@/hooks/vision/useMarketSnapshot'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { GeometricPulse } from './GeometricPulse'

interface SourceHeroProps {
  source: VisionSource
  sourceSchedule?: SourceSchedule
  marketCount?: number
  tickRemaining?: number
  tickDuration?: number
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

export function SourceHero({ source, sourceSchedule, marketCount, tickRemaining, tickDuration }: SourceHeroProps) {
  const isLive = sourceSchedule?.status === 'healthy'
  const categoryLabel = getCategoryLabel(source.category)

  return (
    <div className="border border-border-light overflow-hidden bg-white flex flex-col sm:flex-row hover-lift" data-fade-in>
      {/* Left half — info */}
      <div className="flex-1 px-4 sm:px-5 py-4 flex flex-col justify-center animate-fade-up">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-micro font-bold uppercase tracking-[0.08em] bg-black/5 text-text-secondary">
            {categoryLabel}
          </span>
          {sourceSchedule && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-micro font-bold uppercase tracking-[0.08em] ${
                isLive
                  ? 'bg-surface-up text-color-up'
                  : 'bg-surface-down text-color-down'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLive ? 'bg-color-up' : 'bg-color-down'
                }`}
              />
              {isLive ? 'LIVE' : 'OFFLINE'}
            </span>
          )}
        </div>

        <h1 className="text-title font-black tracking-tight text-black leading-tight animate-hero-in">
          {source.name}
        </h1>

        {source.description && (
          <p className="text-caption text-text-muted leading-snug mt-1.5">
            {source.description}
          </p>
        )}
      </div>

      {/* Right half — brand logo with geometric pulse */}
      <div
        className="relative w-full sm:w-1/2 min-h-[80px] sm:min-h-[100px] flex items-center justify-center animate-fade-in"
        style={{ background: source.brandBg }}
      >
        <GeometricPulse
          brandBg={source.brandBg}
          tickRemaining={tickRemaining}
          tickDuration={tickDuration}
        />
        <img
          src={source.logo}
          alt={source.name}
          className="relative z-10 max-h-[64px] max-w-[80%] object-contain"
        />
      </div>
    </div>
  )
}
