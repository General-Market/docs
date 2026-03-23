'use client'

import { useTranslations } from 'next-intl'
import { usePoints } from '@/hooks/usePoints'

interface IndexTabProps {
  address: string
}

function formatPoints(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  if (n >= 1) return Math.floor(n).toLocaleString()
  return '0'
}

export function IndexTab({ address }: IndexTabProps) {
  const t = useTranslations('common')
  const { points, isLoading } = usePoints(address)

  const hasPoints = points.indexCreator > 0 || points.indexHolder > 0

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-surface rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (!hasPoints) {
    return (
      <div className="py-16 text-center">
        <div className="text-caption text-text-muted">{t('profile.no_index_data')}</div>
      </div>
    )
  }

  const pools = [
    {
      label: t('profile.points_creator'),
      value: points.indexCreator,
      color: 'bg-amber-500',
      desc: 'NAV growth since ITP creation',
    },
    {
      label: t('profile.points_holder'),
      value: points.indexHolder,
      color: 'bg-emerald-500',
      desc: 'Weighted portfolio performance',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Points breakdown */}
      <div className="border border-border-light overflow-hidden">
        <div className="px-4 py-3 border-b border-border-light bg-surface/50">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
            {t('profile.points_title')}
          </div>
        </div>
        {pools.map((pool) => (
          <div
            key={pool.label}
            className="flex items-center justify-between px-4 py-3 border-b border-border-light last:border-b-0"
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${pool.color}`} />
              <div>
                <div className="text-[13px] font-semibold text-black">{pool.label}</div>
                <div className="text-[11px] text-text-muted">{pool.desc}</div>
              </div>
            </div>
            <div className="text-[16px] font-black font-mono tabular-nums text-black">
              {formatPoints(pool.value)}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3 bg-surface/30">
          <div className="text-[13px] font-bold text-black">{t('profile.points_total')}</div>
          <div className="text-[16px] font-black font-mono tabular-nums text-black">
            {formatPoints(points.indexCreator + points.indexHolder)}
          </div>
        </div>
      </div>
    </div>
  )
}
