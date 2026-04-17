'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePoints } from '@/hooks/usePoints'
import { PortfolioSection } from '@/components/domain/PortfolioSection'

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
  const [expanded] = useState(true)

  return (
    <div className="space-y-6">
      {/* ITP portfolio only. Vaults have their own top-level tab in
          ProfileTabs — we don't duplicate them inside the Index tab. */}
      <PortfolioSection expanded={expanded} onToggle={() => {}} hideVaults />

      {/* Points breakdown */}
      {!isLoading && (points.indexCreator > 0 || points.indexHolder > 0) && (
        <div className="border border-border-light overflow-hidden">
          <div className="px-4 py-3 border-b border-border-light bg-surface/50">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
              {t('profile.points_title')}
            </div>
          </div>
          {[
            { label: t('profile.points_creator'), value: points.indexCreator, color: 'bg-amber-500', desc: 'NAV growth since ITP creation' },
            { label: t('profile.points_holder'), value: points.indexHolder, color: 'bg-emerald-500', desc: 'Weighted portfolio performance' },
          ].map((pool) => (
            <div key={pool.label} className="flex items-center justify-between px-4 py-3 border-b border-border-light last:border-b-0">
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
        </div>
      )}
    </div>
  )
}
