'use client'

import { useMemo } from 'react'
import type { BoardFilter } from './FilterBar'
import type { UpcomingSlot } from '@/lib/markets/hooks'
import { useWallet } from '@/hooks/useWallet'
import { useUserPositions } from '@/lib/markets/positions'
import { GlobalActivity } from './GlobalActivity'

// Left rail. Positions, activity, boards, status. The horizon column
// died — Status (live / settling / resolved) is the time axis now.

const BOARDS: Array<{ id: BoardFilter; label: string; sub: string }> = [
  { id: 'all', label: 'all', sub: '25 fights' },
  { id: 'stars', label: 'stars', sub: '4h gain race' },
  { id: 'cams', label: 'cams', sub: '2m gain / total' },
]

export type StatusFilter = 'live' | 'settling' | 'resolved'

const STATUSES: ReadonlyArray<{ id: StatusFilter; label: string }> = [
  { id: 'live', label: 'Live' },
  { id: 'settling', label: 'Settling' },
  { id: 'resolved', label: 'Resolved' },
]

export interface CategorySidebarProps {
  board: BoardFilter
  status: StatusFilter
  slots: UpcomingSlot[]
  onBoardChange: (b: BoardFilter) => void
  onStatusChange: (s: StatusFilter) => void
  /** Hide the desktop-only widgets (activity rail) — for the mobile
   *  drawer, where activity lives elsewhere. */
  hideWidgets?: boolean
  /** Open the positions modal. When omitted, the button is suppressed. */
  onOpenPositions?: () => void
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
  status,
  slots,
  onBoardChange,
  onStatusChange,
  hideWidgets = false,
  onOpenPositions,
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
      {!hideWidgets ? <GlobalActivity /> : null}

      {onOpenPositions ? <PositionsButton onOpen={onOpenPositions} /> : null}

      <div>
        <p className={sectionLabelClasses()}>Status</p>
        <StatusPillRow status={status} onChange={onStatusChange} />
      </div>

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
    </aside>
  )
}

function StatusPillRow({
  status,
  onChange,
}: {
  status: StatusFilter
  onChange: (s: StatusFilter) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Status"
      className="inline-flex w-full items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-900/60 p-0.5"
    >
      {STATUSES.map(s => {
        const active = s.id === status
        return (
          <button
            key={s.id}
            role="radio"
            aria-checked={active}
            type="button"
            onClick={() => onChange(s.id)}
            className={[
              'flex-1 inline-flex h-7 items-center justify-center rounded px-2 text-[11px] font-medium tracking-tight transition-colors',
              active
                ? 'bg-zinc-100 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-100',
            ].join(' ')}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

// Positions trigger. A single line that opens the full ledger in a
// modal — the side panel had to die so the central UI could breathe.
function PositionsButton({ onOpen }: { onOpen: () => void }) {
  const { address } = useWallet()
  const { positions } = useUserPositions(address)

  if (!address) return null

  const open = positions.filter(p => p.state === 'open').length
  const settling = positions.filter(p => p.state === 'settling').length
  const won = positions.filter(p => p.state === 'resolved-won' || p.state === 'claimed-won').length

  const summary = positions.length === 0
    ? 'no positions yet'
    : `${open} open · ${settling} settling · ${won} won`

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900/80"
    >
      <span className="flex flex-col items-start gap-0.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 group-hover:text-zinc-400">
          my positions
        </span>
        <span className="font-mono text-[11px] tabular-nums text-zinc-200">
          {summary}
        </span>
      </span>
      <span aria-hidden className="font-mono text-[11px] text-zinc-500 group-hover:text-zinc-200">→</span>
    </button>
  )
}
