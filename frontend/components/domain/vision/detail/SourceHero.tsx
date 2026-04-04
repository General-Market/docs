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
      {/* Noise texture across entire banner */}
      <div className="absolute inset-0 opacity-[0.035] z-[1] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")' }} />

      <div className="relative flex min-h-[140px]">
        {/* ── Left column: info, stats, everything ── */}
        <div className="relative flex-1 bg-[#0f0f1a]">
          {/* Diagonal brand bleed from right */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{ background: `linear-gradient(105deg, transparent 60%, ${source.brandBg})` }}
          />

          <div className="relative z-[2] flex flex-col justify-center h-full px-6 py-5">
            {/* Top row: category + status */}
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-2 py-0.5 bg-white/[0.06] border border-white/[0.06] text-[9px] font-bold uppercase tracking-[0.12em] text-white/40">
                {categoryLabel}
              </span>
              {sourceSchedule && (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                  isLive
                    ? 'bg-color-up/10 border border-color-up/20 text-color-up'
                    : 'bg-white/[0.04] border border-white/[0.06] text-white/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-color-up animate-pulse' : 'bg-white/20'}`} />
                  {isLive ? t('source_hero.live') : t('source_hero.offline')}
                </span>
              )}
            </div>

            {/* Source name */}
            <h1 className="text-[26px] font-black text-white leading-none tracking-[-0.02em] mb-1">
              {source.name}
            </h1>

            {source.description && (
              <p className="text-[11px] text-white/30 leading-relaxed max-w-md mb-4">
                {source.description}
              </p>
            )}

            {/* Stat boxes row */}
            <div className="flex items-center gap-px">
              {stats.map((s) => (
                <div key={s.label} className="bg-white/[0.04] border border-white/[0.07] px-4 py-2 first:rounded-l last:rounded-r">
                  <div className="text-[7px] font-bold uppercase tracking-[0.16em] text-white/20 leading-none mb-1">
                    {s.label}
                  </div>
                  <div className="text-[18px] font-mono font-black text-white leading-none tabular-nums">
                    {s.value}
                  </div>
                </div>
              ))}
              {stats.length > 0 && (
                <div className="bg-white/[0.04] border border-white/[0.07] px-4 py-2 rounded-r">
                  <div className="text-[7px] font-bold uppercase tracking-[0.16em] text-white/20 leading-none mb-1">
                    STATUS
                  </div>
                  <div className={`text-[18px] font-mono font-black leading-none tabular-nums ${isLive ? 'text-color-up' : 'text-white/30'}`}>
                    {isLive ? 'ON' : 'OFF'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right column: brand logo zone ── */}
        <div
          className="relative w-[38%] shrink-0 flex items-center justify-center"
          style={{ background: source.brandBg }}
        >
          {/* Dark vignette from left edge for blending */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f1a] via-transparent to-transparent opacity-40" />
          {/* Inner shadow for depth */}
          <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.3)]" />

          {/* Radial glow behind logo */}
          <div
            className="absolute w-[200px] h-[200px] rounded-full opacity-20 blur-[60px]"
            style={{ background: source.brandBg }}
          />

          {/* Logo */}
          {!logoLoaded && (
            <div className="absolute z-10 w-20 h-10 rounded bg-white/10 animate-pulse" />
          )}
          <Image
            src={source.logo}
            alt={source.name}
            width={160}
            height={80}
            className={`relative z-10 max-h-[72px] max-w-[75%] object-contain drop-shadow-[0_2px_20px_rgba(0,0,0,0.4)] transition-opacity duration-300 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`}
            priority
            onLoad={() => setLogoLoaded(true)}
          />
        </div>
      </div>
    </div>
  )
}
