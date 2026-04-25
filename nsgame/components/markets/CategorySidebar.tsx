'use client'

import { useMemo } from 'react'
import { SourceIcon } from './SourceIcon'
import type { SourceFilter, HorizonFilter } from './FilterBar'
import type { UpcomingSlot } from '@/lib/markets/hooks'

// Left rail. Sources, horizons, status. The list of axes the user is
// allowed to slice along — nothing here is novel, only quiet.

const SOURCES: Array<{ id: 1 | 2 | 3 | 4 | 5; label: string }> = [
  { id: 1, label: 'xvideos' },
  { id: 2, label: 'xnxx' },
  { id: 3, label: 'pornhub' },
  { id: 4, label: 'chaturbate' },
  { id: 5, label: 'eporner' },
]

const HORIZONS: Array<{ id: HorizonFilter; label: string }> = [
  { id: 'today', label: 'today' },
  { id: '7d', label: 'next 7 days' },
  { id: 'all', label: 'all open' },
]

export type StatusFilter = 'live' | 'open' | 'resolved'

const STATUSES: Array<{ id: StatusFilter; label: string }> = [
  { id: 'live', label: 'live' },
  { id: 'open', label: 'open' },
  { id: 'resolved', label: 'resolved' },
]

export interface CategorySidebarProps {
  source: SourceFilter
  horizon: HorizonFilter
  statuses: StatusFilter[]
  slots: UpcomingSlot[]
  onSourceChange: (s: SourceFilter) => void
  onHorizonChange: (h: HorizonFilter) => void
  onStatusToggle: (s: StatusFilter) => void
  className?: string
}

function rowClasses(active: boolean): string {
  return [
    'group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors duration-150',
    'min-h-[36px]',
    active
      ? 'bg-zinc-800/80 text-zinc-100 ring-1 ring-zinc-700'
      : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100',
  ].join(' ')
}

function sectionLabelClasses(): string {
  return 'mb-1.5 px-3 text-[11px] font-medium tracking-tight text-zinc-500'
}

export function CategorySidebar({
  source,
  horizon,
  statuses,
  slots,
  onSourceChange,
  onHorizonChange,
  onStatusToggle,
  className = '',
}: CategorySidebarProps) {
  const sourceCounts = useMemo(() => {
    const out: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const s of slots) {
      if (out[s.sourceId] === undefined) continue
      out[s.sourceId] += 1
    }
    return out
  }, [slots])

  const totalCount = slots.length

  return (
    <aside
      className={[
        'pr-4 space-y-7',
        className,
      ].join(' ')}
      aria-label="Categories"
    >
      <div>
        <p className={sectionLabelClasses()}>Sources</p>
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => onSourceChange('all')}
            aria-pressed={source === 'all'}
            className={rowClasses(source === 'all')}
          >
            <span className="flex items-center gap-2.5">
              <span className="grid h-4 w-4 place-items-center text-zinc-500">
                <span className="block h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              </span>
              <span className="text-[13.5px]">All</span>
            </span>
            <span className="text-[12px] tabular-nums text-zinc-500 group-hover:text-zinc-300">
              {totalCount}
            </span>
          </button>
          {SOURCES.map(s => {
            const active = source === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSourceChange(s.id)}
                aria-pressed={active}
                className={rowClasses(active)}
              >
                <span className="flex items-center gap-2.5">
                  <SourceIcon sourceId={s.id} className="h-4 w-4" />
                  <span className="text-[13.5px] capitalize">{s.label}</span>
                </span>
                <span
                  className={[
                    'text-[12px] tabular-nums',
                    active ? 'text-zinc-300' : 'text-zinc-500 group-hover:text-zinc-300',
                  ].join(' ')}
                >
                  {sourceCounts[s.id] ?? 0}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className={sectionLabelClasses()}>Horizon</p>
        <div className="space-y-0.5">
          {HORIZONS.map(h => {
            const active = horizon === h.id
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => onHorizonChange(h.id)}
                aria-pressed={active}
                className={rowClasses(active)}
              >
                <span className="text-[13.5px] capitalize">{h.label}</span>
                <span className="text-[11px] tabular-nums text-zinc-500 group-hover:text-zinc-300">
                  {h.id}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className={sectionLabelClasses()}>Status</p>
        <div className="space-y-0.5">
          {STATUSES.map(s => {
            const active = statuses.includes(s.id)
            return (
              <label
                key={s.id}
                className={[
                  'flex min-h-[36px] cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 transition-colors duration-150',
                  active ? 'bg-zinc-800/80 text-zinc-100 ring-1 ring-zinc-700' : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => onStatusToggle(s.id)}
                  className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-zinc-500"
                />
                <span className="text-[13.5px] capitalize">{s.label}</span>
              </label>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
