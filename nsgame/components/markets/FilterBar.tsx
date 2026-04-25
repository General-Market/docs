'use client'

import { useMemo, useState } from 'react'
import { SourceIcon } from './SourceIcon'
import { StatusSheet } from './StatusSheet'
import type { StatusFilter } from './CategorySidebar'

// Two chip groups, one trigger. Source. Horizon. A button that admits
// what filters always are: more rooms behind another door.

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
  // Optional — the parent may not yet wire status into the bar.
  // The sheet trigger still renders, just with an empty list.
  statuses?: StatusFilter[]
  onStatusToggle?: (s: StatusFilter) => void
}

function chipClasses(active: boolean): string {
  return [
    'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] tracking-tight transition-all duration-150',
    'min-w-[44px] justify-center snap-start shrink-0',
    active
      ? 'bg-zinc-100 text-zinc-900'
      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900',
  ].join(' ')
}

function groupLabelClasses(): string {
  return 'shrink-0 text-[11px] font-medium tracking-tight text-zinc-400'
}

export function FilterBar({
  source,
  horizon,
  onSourceChange,
  onHorizonChange,
  statuses = [],
  onStatusToggle,
}: FilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const sourceChips = useMemo(() => SOURCES.map(s => ({
    ...s,
    active: source === s.id,
  })), [source])

  const horizonChips = useMemo(() => HORIZONS.map(h => ({
    ...h,
    active: horizon === h.id,
  })), [horizon])

  const hasStatusFilter = statuses.length > 0

  return (
    <>
      <div className="sticky top-14 z-20 -mx-4 border-b border-zinc-200/60 bg-white/80 px-4 backdrop-blur-md sm:top-16 sm:mx-0 sm:px-0">
        <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div
            className="flex snap-x snap-mandatory items-center gap-2 overflow-x-auto scrollbar-hide"
            role="group"
            aria-label="Source filter"
          >
            <span className={groupLabelClasses()}>Source</span>
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
              className="relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[12px] font-medium tracking-tight text-zinc-700 transition-all duration-150 hover:border-zinc-300 hover:text-zinc-900"
            >
              <span>Filters</span>
              {hasStatusFilter ? (
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-900"
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
