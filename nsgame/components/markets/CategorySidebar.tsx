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
    'group flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
    'min-h-[40px]',
    active
      ? 'bg-zinc-900 text-white'
      : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900',
  ].join(' ')
}

function sectionLabelClasses(): string {
  return 'mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500'
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
  // Per-source slot counts. Cheap — slots is already capped by the hook.
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
        'border-r border-zinc-200 pr-4',
        'space-y-6',
        className,
      ].join(' ')}
      aria-label="Categories"
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-700">
          what&apos;s next
        </p>
        <p className="mt-1 text-[13px] text-zinc-600">
          Markets that close soon. Pick a side.
        </p>
      </div>

      <div>
        <p className={sectionLabelClasses()}>sources</p>
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => onSourceChange('all')}
            aria-pressed={source === 'all'}
            className={rowClasses(source === 'all')}
          >
            <span className="flex items-center gap-2">
              <span className="grid h-4 w-4 place-items-center text-zinc-400">
                <span className="block h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              </span>
              <span className="text-[13px] font-medium">all sources</span>
            </span>
            <span className="font-mono text-[11px] tabular-nums text-zinc-400 group-hover:text-zinc-600">
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
                <span className="flex items-center gap-2">
                  <SourceIcon sourceId={s.id} className="h-4 w-4" />
                  <span className="text-[13px] font-medium">{s.label}</span>
                </span>
                <span
                  className={[
                    'font-mono text-[11px] tabular-nums',
                    active ? 'text-white/70' : 'text-zinc-400 group-hover:text-zinc-600',
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
        <p className={sectionLabelClasses()}>horizons</p>
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
                <span className="text-[13px] font-medium">{h.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-400 group-hover:text-zinc-600">
                  {h.id}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className={sectionLabelClasses()}>status</p>
        <div className="space-y-0.5">
          {STATUSES.map(s => {
            const active = statuses.includes(s.id)
            return (
              <label
                key={s.id}
                className={[
                  'flex min-h-[40px] cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 transition-colors',
                  active ? 'text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => onStatusToggle(s.id)}
                  className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-1 focus:ring-zinc-900"
                />
                <span className="text-[13px] font-medium">{s.label}</span>
              </label>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
