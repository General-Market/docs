'use client'

import { useMemo, useState } from 'react'
import { StatusSheet } from './StatusSheet'
import type { StatusFilter } from './CategorySidebar'

// Board filter + horizon + filters trigger. Source rows are gone — the
// world has narrowed to two boards: stars (4h) and cams (2m).

export type BoardFilter = 'all' | 'stars' | 'cams'
export type HorizonFilter = 'today' | '7d' | 'all'

/**
 * Legacy alias — kept so NavBar (out of scope for PvP refactor) still
 * compiles. PvP routes use BoardFilter; NavBar's source tabs are not
 * wired by CalendarPageClient anymore, so the type only satisfies imports.
 */
export type SourceFilter = 'all' | 1 | 2 | 3 | 4 | 5

const BOARDS: Array<{ id: BoardFilter; label: string }> = [
  { id: 'all', label: 'all' },
  { id: 'stars', label: 'stars' },
  { id: 'cams', label: 'cams' },
]

const HORIZONS: Array<{ id: HorizonFilter; label: string }> = [
  { id: 'today', label: 'today' },
  { id: '7d', label: '7d' },
  { id: 'all', label: 'all' },
]

export interface FilterBarProps {
  board: BoardFilter
  horizon: HorizonFilter
  onBoardChange: (b: BoardFilter) => void
  onHorizonChange: (h: HorizonFilter) => void
  // Optional — the parent may not yet wire status into the bar.
  statuses?: StatusFilter[]
  onStatusToggle?: (s: StatusFilter) => void
}

function chipClasses(active: boolean): string {
  return [
    'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] tracking-tight transition-all duration-150',
    'min-w-[44px] justify-center snap-start shrink-0',
    active
      ? 'bg-zinc-800 text-zinc-100 ring-1 ring-zinc-700'
      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
  ].join(' ')
}

function groupLabelClasses(): string {
  return 'shrink-0 text-[11px] font-medium tracking-tight text-zinc-500'
}

export function FilterBar({
  board,
  horizon,
  onBoardChange,
  onHorizonChange,
  statuses = [],
  onStatusToggle,
}: FilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const boardChips = useMemo(() => BOARDS.map(b => ({
    ...b,
    active: board === b.id,
  })), [board])

  const horizonChips = useMemo(() => HORIZONS.map(h => ({
    ...h,
    active: horizon === h.id,
  })), [horizon])

  const hasStatusFilter = statuses.length > 0

  return (
    <>
      <div className="sticky top-14 z-20 -mx-4 border-b border-zinc-800/70 bg-zinc-950/80 px-4 backdrop-blur-md sm:top-16 sm:mx-0 sm:px-0">
        <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div
            className="flex snap-x snap-mandatory items-center gap-2 overflow-x-auto scrollbar-hide"
            role="group"
            aria-label="Board filter"
          >
            <span className={groupLabelClasses()}>Board</span>
            {boardChips.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => onBoardChange(c.id)}
                aria-pressed={c.active}
                className={chipClasses(c.active)}
              >
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div
              className="flex snap-x snap-mandatory items-center gap-2 overflow-x-auto scrollbar-hide"
              role="group"
              aria-label="Horizon filter"
            >
              <span className={groupLabelClasses()}>Horizon</span>
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

            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              className="relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-[12px] font-medium tracking-tight text-zinc-300 transition-all duration-150 hover:border-zinc-700 hover:text-zinc-100"
            >
              <span>Filters</span>
              {hasStatusFilter ? (
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-100"
                />
              ) : null}
              <span className="sr-only">
                {hasStatusFilter ? `${statuses.length} status filters active` : 'no extra filters'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <StatusSheet
        open={sheetOpen}
        statuses={statuses}
        onStatusToggle={onStatusToggle}
        onClose={() => setSheetOpen(false)}
      />
    </>
  )
}
