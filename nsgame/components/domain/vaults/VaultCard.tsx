'use client'

import { useRef, useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils/cn'
import { useFundBranding } from '@/hooks/vaults/useFundBranding'
import type { VaultInfo } from '@/hooks/vaults/useVaults'

const STRATEGY_COLORS: Record<string, string> = {
  momentum: 'bg-emerald-500/10 text-emerald-700',
  contrarian: 'bg-rose-500/10 text-rose-700',
  bullish: 'bg-sky-500/10 text-sky-700',
  bearish: 'bg-red-500/10 text-red-700',
  mean_reversion: 'bg-violet-500/10 text-violet-700',
  regime: 'bg-amber-500/10 text-amber-700',
  cluster: 'bg-cyan-500/10 text-cyan-700',
  momentum_threshold: 'bg-emerald-500/10 text-emerald-700',
  time_of_day: 'bg-orange-500/10 text-orange-700',
  volatility_fade: 'bg-zinc-500/10 text-zinc-700',
}

interface VaultCardProps {
  vault: VaultInfo
  onClick: () => void
}

export function VaultCard({ vault, onClick }: VaultCardProps) {
  const t = useTranslations('vision')
  const branding = useFundBranding(vault.address)
  const reduced = useReducedMotion()
  const cardRef = useRef<HTMLDivElement>(null)
  const [entered, setEntered] = useState(false)

  const perfPercent = (vault.performanceSinceInception * 100).toFixed(2)
  const isPositive = vault.performanceSinceInception >= 0

  useEffect(() => {
    if (reduced) {
      setEntered(true)
      return
    }
    const el = cardRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setEntered(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [reduced])

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      tabIndex={0}
      role="button"
      className="bg-card border border-border-light rounded-md cursor-pointer
                 hover:bg-card-hover hover:shadow-card-hover transition-all overflow-hidden
                 w-full"
    >
      <div
        className="h-[3px]"
        style={{ backgroundColor: branding?.color ?? 'var(--color-brand)' }}
      />

      <div className="p-3.5">
        <div className="flex items-center justify-between gap-1.5 mb-2">
          <span className="font-bold text-text-primary text-sm leading-tight truncate min-w-0">
            {branding?.name ?? vault.name}
          </span>
          {branding && (
            <span
              className={cn(
                'shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full whitespace-nowrap',
                STRATEGY_COLORS[branding.strategy] ??
                  'bg-black/5 text-text-secondary',
              )}
            >
              {branding.strategy}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
          <div className="flex flex-col">
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-text-muted leading-tight">
              {t('vaults.tvl_label')}
            </span>
            <span className="font-bold text-black">
              ${vault.tvlFormatted}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-text-muted leading-tight">
              {t('vaults.perf_label')}
            </span>
            <span
              className={cn(
                isPositive ? 'text-color-up' : 'text-color-down',
              )}
            >
              {isPositive ? '+' : ''}
              {perfPercent}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
