'use client'

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
  if (props.mode === 'single') {
    const { progress } = props
    if (!progress) return null

    return (
      <div className="mb-4">
        <div className="flex justify-between text-xs text-white/60 font-mono mb-1">
          <span>Simulating... {progress.current_date}</span>
          <span>{progress.pct.toFixed(1)}%</span>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(progress.pct, 100)}%` }}
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
      <div className="flex justify-between text-xs text-white/60 font-mono mb-1">
        <span>
          {progress
            ? `Running ${progress.variant} (${progress.variant_index + 1}/${totalVariants}) — ${progress.current_date}`
            : totalVariants === 0
              ? 'Starting sweep...'
              : `Completed ${completedCount}/${totalVariants}`
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
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
          style={{ width: `${totalVariants === 0 ? 0 : progress ? ((completedCount + progress.pct / 100) / safeTotalVariants) * 100 : (completedCount / safeTotalVariants) * 100}%` }}
        />
      </div>
      {/* Variant pills */}
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: totalVariants }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors duration-300 ${
              i < completedCount
                ? 'bg-green-400'
                : i === completedCount && progress
                  ? 'bg-accent animate-pulse'
                  : 'bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
