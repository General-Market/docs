'use client'

import { useTranslations } from 'next-intl'
import type { SimProgress } from '@/hooks/useSimulation'
import type { SweepProgress } from '@/hooks/useSimSweep'

interface SingleProgressProps {
  mode: 'single'
  progress: SimProgress | null
}

interface SweepProgressProps {
  mode: 'sweep'
  progress: SweepProgress | null
  completedCount: number
  totalVariants: number
}

type SimProgressBarProps = SingleProgressProps | SweepProgressProps

export function SimProgressBar(props: SimProgressBarProps) {
  const t = useTranslations('backtest')

  if (props.mode === 'single') {
    const { progress } = props
    if (!progress) return null

    return (
      <div className="mb-4">
        <div className="flex justify-between text-xs text-text-muted font-mono mb-1">
          <span>{t('progress.simulating', { date: progress.current_date })}</span>
          <span>{progress.pct.toFixed(1)}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-zinc-900 rounded-full origin-left will-change-transform"
            style={{
              width: '100%',
              transform: `scaleX(${(Math.min(progress.pct, 100) / 100).toFixed(4)})`,
              transition: 'transform 300ms cubic-bezier(0.25, 0.1, 0.3, 1)',
            }}
          />
        </div>
      </div>
    )
  }

  // Sweep mode
  const { progress, completedCount, totalVariants } = props
  const safeTotalVariants = totalVariants || 1 // avoid division by zero

  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs text-text-muted font-mono mb-1">
        <span>
          {progress
            ? t('progress.running_variant', { variant: progress.variant, current: progress.variant_index + 1, total: totalVariants, date: progress.current_date })
            : totalVariants === 0
              ? t('progress.starting_sweep')
              : t('progress.completed', { current: completedCount, total: totalVariants })
          }
        </span>
        <span>
          {progress
            ? `${progress.pct.toFixed(1)}%`
            : totalVariants === 0
              ? ''
              : `${Math.round((completedCount / safeTotalVariants) * 100)}%`
          }
        </span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-zinc-900 rounded-full origin-left will-change-transform"
          style={{
            width: '100%',
            transform: `scaleX(${((totalVariants === 0 ? 0 : progress ? ((completedCount + progress.pct / 100) / safeTotalVariants) * 100 : (completedCount / safeTotalVariants) * 100) / 100).toFixed(4)})`,
            transition: 'transform 300ms cubic-bezier(0.25, 0.1, 0.3, 1)',
          }}
        />
      </div>
      {/* Variant pills */}
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: totalVariants }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors duration-300 ${
              i < completedCount
                ? 'bg-color-up'
                : i === completedCount && progress
                  ? 'bg-zinc-900 animate-pulse'
                  : 'bg-border-light'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
