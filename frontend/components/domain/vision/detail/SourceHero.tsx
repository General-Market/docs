'use client'

import { useState } from 'react'
import type { VisionSource } from '@/lib/vision/sources'
import type { SourceSchedule } from '@/hooks/vision/useMarketSnapshot'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { GeometricPulse } from './GeometricPulse'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

interface SourceHeroProps {
  source: VisionSource
  sourceSchedule?: SourceSchedule
  marketCount?: number
  tickRemaining?: number
  tickDuration?: number
  sourceId?: string
  urgency?: 'normal' | 'urgent' | 'critical'
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'now'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${Math.floor(seconds)}s`
}


export function SourceHero({ source, sourceSchedule, marketCount, tickRemaining, tickDuration, sourceId, urgency }: SourceHeroProps) {
  const t = useTranslations('vision')
  const [logoLoaded, setLogoLoaded] = useState(false)
  const isLive = sourceSchedule?.status === 'healthy'
  const categoryLabel = getCategoryLabel(source.category)

  return (
    <div className="sticky top-14 sm:top-16 z-10 border border-border-light overflow-hidden bg-white flex">
      {/* Left half — info */}
      <div className="flex-1 px-6 py-4 flex flex-col justify-center">
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
              {isLive ? t('source_hero.live') : t('source_hero.offline')}
            </span>
          )}
        </div>

        <h1 className="text-title font-black text-text-primary">
          {source.name}
        </h1>

        {source.description && (
          <p className="text-body-sm text-text-muted mt-1.5">
            {source.description}
          </p>
        )}

        {/* Settlement countdown */}
        {tickRemaining != null && tickRemaining > 0 && tickDuration != null && tickDuration > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-label text-text-muted">
              {t('source_hero.settles_in', { time: formatCountdown(tickRemaining + tickDuration) })}
            </span>
            <span className="text-label font-mono tabular-nums text-text-secondary">
              {formatCountdown(tickRemaining + tickDuration)}
            </span>
          </div>
        )}
        {tickRemaining != null && tickRemaining <= 0 && tickDuration != null && tickDuration > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-label font-semibold text-color-warning">
              {t('source_hero.settling_soon')}
            </span>
          </div>
        )}
      </div>

      {/* Right half — brand logo with geometric pulse */}
      <div
        className="relative w-2/5 min-h-[100px] flex items-center justify-center"
        style={{ background: source.brandBg, viewTransitionName: sourceId ? `source-brand-${sourceId}` : undefined } as React.CSSProperties}
      >
        <GeometricPulse
          brandBg={source.brandBg}
          tickRemaining={tickRemaining}
          tickDuration={tickDuration}
        />
        {!logoLoaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="w-16 h-8 rounded bg-white/10 animate-pulse" />
          </div>
        )}
        <Image
          src={source.logo}
          alt={source.name}
          width={128}
          height={64}
          className={`relative z-10 max-h-[64px] max-w-[80%] object-contain transition-opacity duration-300 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`}
          priority
          onLoad={() => setLogoLoaded(true)}
        />
      </div>
    </div>
  )
}
