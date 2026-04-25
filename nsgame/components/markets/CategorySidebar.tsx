'use client'

import { useMemo } from 'react'
import type { BoardFilter, HorizonFilter } from './FilterBar'
import type { UpcomingSlot } from '@/lib/markets/hooks'

// Left rail. Boards, horizons, status. The list of axes the user is
// allowed to slice along — nothing here is novel, only quiet.

const BOARDS: Array<{ id: BoardFilter; label: string; sub: string }> = [
  { id: 'all', label: 'all', sub: '25 fights' },
  { id: 'stars', label: 'stars', sub: '4h gain race' },
  { id: 'cams', label: 'cams', sub: '2m gain / total' },
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
  board: BoardFilter
  horizon: HorizonFilter
  statuses: StatusFilter[]
  slots: UpcomingSlot[]
  onBoardChange: (b: BoardFilter) => void
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
  board,
  horizon,
  statuses,
  slots,
  onBoardChange,
  onHorizonChange,
  onStatusToggle,
  className = '',
}: CategorySidebarProps) {
  const boardCounts = useMemo(() => {
    const out = { stars: 0, cams: 0 }
    for (const s of slots) {
      if (s.board === 'stars') out.stars += 1
      else if (s.board === 'cams') out.cams += 1
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
        <p className={sectionLabelClasses()}>Boards</p>
        <div className="space-y-0.5">
          {BOARDS.map(b => {
            const active = board === b.id
            const count = b.id === 'all'
              ? totalCount
              : b.id === 'stars'
                ? boardCounts.stars
                : boardCounts.cams
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onBoardChange(b.id)}
                aria-pressed={active}
                className={rowClasses(active)}
              >
                <span className="flex flex-col items-start">
                  <span className="text-[13.5px] capitalize text-zinc-200">{b.label}</span>
                  <span className="text-[11px] text-zinc-500">{b.sub}</span>
                </span>
                <span
                  className={[
                    'text-[12px] tabular-nums',
                    active ? 'text-zinc-300' : 'text-zinc-500 group-hover:text-zinc-300',
                  ].join(' ')}
                >
                  {count}
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
