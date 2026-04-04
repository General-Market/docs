'use client'

import { useState } from 'react'
import type { VisionSource } from '@/lib/vision/sources'
import type { SourceSchedule } from '@/hooks/vision/useMarketSnapshot'
import { getCategoryLabel } from '@/lib/vision/source-categories'
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

function formatTick(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

export function SourceHero({ source, sourceSchedule, marketCount, tickDuration, sourceId }: SourceHeroProps) {
  const t = useTranslations('vision')
  const [logoLoaded, setLogoLoaded] = useState(false)
  const isLive = sourceSchedule?.status === 'healthy'
  const categoryLabel = getCategoryLabel(source.category)

  const stats: { label: string; value: string }[] = []
  if (marketCount) stats.push({ label: 'MARKETS', value: marketCount.toLocaleString() })
  if (tickDuration && tickDuration > 0) stats.push({ label: 'TICK', value: formatTick(tickDuration) })

  return (
    <div
      className="relative overflow-hidden border border-white/[0.06]"
      style={{ viewTransitionName: sourceId ? `source-brand-${sourceId}` : undefined } as React.CSSProperties}
    >
      {/* Dark background with brand accent */}
      <div className="absolute inset-0 bg-[#1a1a2e]" />
      <div
        className="absolute inset-0 opacity-30"
        style={{ background: `linear-gradient(135deg, transparent 40%, ${source.brandBg})` }}
      />
      {/* Subtle noise texture */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")' }} />

      <div className="relative flex items-center gap-6 px-6 py-5">
        {/* Logo */}
        <div className="shrink-0 w-[72px] h-[72px] rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center overflow-hidden">
          {!logoLoaded && (
            <div className="w-10 h-5 rounded bg-white/10 animate-pulse" />
          )}
          <Image
            src={source.logo}
            alt={source.name}
            width={56}
            height={56}
            className={`max-h-[48px] max-w-[48px] object-contain transition-opacity duration-200 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`}
            priority
            onLoad={() => setLogoLoaded(true)}
          />
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
              {categoryLabel}
            </span>
            {sourceSchedule && (
              <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] ${isLive ? 'text-color-up' : 'text-white/25'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-color-up animate-pulse' : 'bg-white/20'}`} />
                {isLive ? t('source_hero.live') : t('source_hero.offline')}
              </span>
            )}
          </div>

          <h1 className="text-[22px] font-black text-white leading-tight tracking-[-0.01em]">
            {source.name}
          </h1>

          {source.description && (
            <p className="text-[11px] text-white/35 mt-1 leading-relaxed max-w-lg truncate">
              {source.description}
            </p>
          )}
        </div>

        {/* Stat boxes — HLTV-style */}
        {stats.length > 0 && (
          <div className="hidden sm:flex items-center gap-px shrink-0">
            {stats.map((s) => (
              <div key={s.label} className="bg-white/[0.04] border border-white/[0.06] px-4 py-2.5 first:rounded-l last:rounded-r">
                <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/25 leading-none mb-1">
                  {s.label}
                </div>
                <div className="text-[16px] font-mono font-black text-white/90 leading-none tabular-nums">
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
