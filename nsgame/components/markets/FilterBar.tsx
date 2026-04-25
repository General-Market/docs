'use client'

import { useMemo } from 'react'

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
  { id: '7d', label: '7 days' },
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
    'inline-flex h-9 items-center rounded-full border px-3 text-[12px] font-medium uppercase tracking-[0.08em] transition-colors',
    'min-w-[44px] justify-center',
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
    <div className="flex flex-col gap-3 border-b border-zinc-200 bg-white py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide" role="group" aria-label="Source filter">
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-500">
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
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide" role="group" aria-label="Horizon filter">
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-500">
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
  )
}
