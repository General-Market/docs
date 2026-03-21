'use client'

import type { VisionSource } from '@/lib/vision/sources'
import type { SourceSchedule } from '@/hooks/vision/useMarketSnapshot'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { GeometricPulse } from './GeometricPulse'
import { useTranslations } from 'next-intl'

interface SourceHeroProps {
  source: VisionSource
  sourceSchedule?: SourceSchedule
  marketCount?: number
  tickRemaining?: number
  tickDuration?: number
  sourceId?: string
  urgency?: 'normal' | 'urgent' | 'critical'
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

export function SourceHero({ source, sourceSchedule, marketCount, tickRemaining, tickDuration, sourceId, urgency }: SourceHeroProps) {
  const t = useTranslations('vision')
  const isLive = sourceSchedule?.status === 'healthy'
  const categoryLabel = getCategoryLabel(source.category)

  return (
    <div className="border border-border-light overflow-hidden bg-white flex">
      {/* Left half — info */}
      <div className="flex-1 px-5 py-4 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-1.5">
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
              {isLive ? t('source_hero.live') : t('source_hero.offline')}
            </span>
          )}
        </div>

        <h1 className="text-[22px] font-black tracking-[-0.02em] text-black leading-tight">
          {source.name}
        </h1>

        {source.description && (
          <p className="text-[12px] text-text-muted leading-snug mt-1.5">
            {source.description}
          </p>
        )}
      </div>

      {/* Right half — brand logo with geometric pulse */}
      <div
        className="relative w-1/2 min-h-[100px] flex items-center justify-center"
        style={{ background: source.brandBg, viewTransitionName: sourceId ? `source-brand-${sourceId}` : undefined } as React.CSSProperties}
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
