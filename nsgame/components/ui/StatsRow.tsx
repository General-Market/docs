'use client'

import { cn } from '@/lib/utils/cn'

interface StatCell {
  label: string
  value: React.ReactNode
  sub?: string
  color?: 'up' | 'down' | 'default'
}

interface StatsRowProps {
  stats: StatCell[]
  className?: string
}

export function StatsRow({ stats, className }: StatsRowProps) {
  const colorClass = (c?: 'up' | 'down' | 'default') => {
    if (c === 'up') return 'text-color-up'
    if (c === 'down') return 'text-color-down'
    return 'text-black'
  }

  return (
    <div className={cn('py-5 px-6 lg:px-12 border-b border-border-light', className)}>
      <div className="max-w-site mx-auto flex">
        {stats.map((stat, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 px-6',
              i !== stats.length - 1 && 'border-r border-border-light',
              i === 0 && 'pl-0'
            )}
          >
            <div className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">
              {stat.label}
            </div>
            <div className={cn('text-title font-extrabold font-mono tabular-nums', colorClass(stat.color))}>
              {stat.value}
            </div>
            {stat.sub && (
              <div className="text-label text-text-muted mt-0.5">{stat.sub}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
