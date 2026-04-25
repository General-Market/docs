'use client'

import { useMemo } from 'react'
import { SourceIcon } from './SourceIcon'

// Two chip groups. Source. Horizon. The state lives in the parent — URL
// sync is left as a TODO so deep links work the day Agent B wants them.

export type SourceFilter = 'all' | 1 | 2 | 3 | 4 | 5
export type HorizonFilter = 'today' | '7d' | 'all'

const SOURCES: Array<{ id: SourceFilter; label: string }> = [
  { id: 'all', label: 'all' },
  { id: 1, label: 'xv' },
  { id: 2, label: 'xn' },
  { id: 3, label: 'ph' },
  { id: 4, label: 'cb' },
  { id: 5, label: 'ep' },
]

const HORIZONS: Array<{ id: HorizonFilter; label: string }> = [
  { id: 'today', label: 'today' },
  { id: '7d', label: '7d' },
  { id: 'all', label: 'all' },
]

export interface FilterBarProps {
  source: SourceFilter
  horizon: HorizonFilter
  onSourceChange: (s: SourceFilter) => void
  onHorizonChange: (h: HorizonFilter) => void
}

function chipClasses(active: boolean): string {
  return [
    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 font-mono text-[12px] tracking-tight transition-colors',
    'min-w-[44px] justify-center snap-start shrink-0',
    active
      ? 'border-zinc-900 bg-zinc-900 text-white'
      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900',
  ].join(' ')
}

export function FilterBar({ source, horizon, onSourceChange, onHorizonChange }: FilterBarProps) {
  const sourceChips = useMemo(() => SOURCES.map(s => ({
    ...s,
    active: source === s.id,
  })), [source])

  const horizonChips = useMemo(() => HORIZONS.map(h => ({
    ...h,
    active: horizon === h.id,
  })), [horizon])

  return (
    <div className="sticky top-14 z-20 -mx-4 border-b border-zinc-200/60 bg-white/80 px-4 backdrop-blur-md sm:top-16 sm:mx-0 sm:px-0">
      <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div
          className="flex snap-x snap-mandatory items-center gap-2 overflow-x-auto scrollbar-hide"
          role="group"
          aria-label="Source filter"
        >
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            source
          </span>
          {sourceChips.map(c => (
            <button
              key={String(c.id)}
              type="button"
              onClick={() => onSourceChange(c.id)}
              aria-pressed={c.active}
              className={chipClasses(c.active)}
            >
              {typeof c.id === 'number' ? (
                <SourceIcon
                  sourceId={c.id as 1 | 2 | 3 | 4 | 5}
                  className="h-3 w-3"
                />
              ) : null}
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        <div
          className="flex snap-x snap-mandatory items-center gap-2 overflow-x-auto scrollbar-hide"
          role="group"
          aria-label="Horizon filter"
        >
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            horizon
          </span>
          {horizonChips.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => onHorizonChange(c.id)}
              aria-pressed={c.active}
              className={chipClasses(c.active)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
