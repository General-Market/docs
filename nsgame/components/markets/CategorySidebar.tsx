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

export type StatusFilter = 'live' | 'settling' | 'resolved' | 'positions'

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
      ? 'bg-terminal-surface-elevated/80 text-terminal-fg ring-1 ring-terminal-border-strong'
      : 'text-terminal-fg-muted hover:bg-terminal-surface/60 hover:text-terminal-fg',
  ].join(' ')
}

function sectionLabelClasses(): string {
  return 'mb-1.5 px-3 text-label font-medium tracking-tight text-terminal-fg-faint'
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

      <PositionsButton
        active={status === 'positions'}
        onOpen={() => onStatusChange('positions')}
        onOpenModal={onOpenPositions}
      />

      {/* Tiny escape hatch back to the live grid when the user is
          parked on positions and wants to return. The pill row only
          renders three of the four states. */}
      {status === 'positions' ? (
        <button
          type="button"
          onClick={() => onStatusChange('live')}
          className="-mt-4 px-3 font-mono text-micro uppercase tracking-[0.14em] text-terminal-fg-faint hover:text-terminal-fg-muted"
        >
          ← back to live
        </button>
      ) : null}

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
                  <span className="text-body-sm capitalize text-terminal-fg">{b.label}</span>
                  <span className="text-label text-terminal-fg-faint">{b.sub}</span>
                </span>
                <span
                  className={[
                    'text-caption tabular-nums',
                    active ? 'text-terminal-fg-muted' : 'text-terminal-fg-faint group-hover:text-terminal-fg-muted',
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
      className="inline-flex w-full items-center gap-0.5 rounded-md border border-terminal-border bg-terminal-surface/60 p-0.5"
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
              'flex-1 inline-flex h-9 items-center justify-center rounded px-2 text-label font-medium tracking-tight transition-colors',
              active
                ? 'bg-terminal-fg text-terminal-surface-deep'
                : 'text-terminal-fg-muted hover:text-terminal-fg',
            ].join(' ')}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

// Positions trigger. Switches the central list into a positions-only
// view — same row format as Settling / Resolved. On mobile the modal
// trigger still fires for the bottom-sheet experience.
interface PositionsButtonProps {
  active: boolean
  /** Switch the list into positions view (desktop). */
  onOpen: () => void
  /** Open the modal (mobile). */
  onOpenModal?: () => void
}

function PositionsButton({ active, onOpen, onOpenModal }: PositionsButtonProps) {
  const { address } = useWallet()
  const { positions } = useUserPositions(address)

  if (!address) return null

  const open = positions.filter(p => p.state === 'open').length
  const settling = positions.filter(p => p.state === 'settling').length
  const won = positions.filter(p => p.state === 'resolved-won' || p.state === 'claimed-won').length
  const total = positions.length

  // One behaviour everywhere: switch the central list into positions
  // view. The modal trigger is kept around for the bottom-nav entry
  // point but the sidebar button no longer fires it — the duplicated
  // surface that prompted the rewrite was the modal's whole point.
  void onOpenModal
  const handleClick = () => {
    onOpen()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      className={[
        'group relative flex w-full items-center gap-3 overflow-hidden rounded-lg border px-3 py-3 text-left transition-colors duration-150',
        active
          ? 'border-sky-400/40 bg-sky-500/10 hover:bg-sky-500/15'
          : 'border-terminal-border bg-terminal-surface/80 hover:border-sky-500/40 hover:bg-terminal-surface',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-body font-bold tabular-nums',
          active
            ? 'bg-sky-400 text-sky-950'
            : 'bg-terminal-surface-elevated text-terminal-fg-muted group-hover:bg-sky-400 group-hover:text-sky-950',
        ].join(' ')}
        aria-hidden
      >
        {total}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={[
            'font-mono text-micro font-semibold uppercase tracking-[0.16em]',
            active ? 'text-sky-200' : 'text-terminal-fg-muted group-hover:text-terminal-fg',
          ].join(' ')}
        >
          my positions
        </span>
        <span className="flex items-center gap-1.5 font-mono text-micro tabular-nums text-terminal-fg-faint">
          {total === 0 ? (
            <span>nothing yet</span>
          ) : (
            <>
              <span className="text-emerald-300">{open}</span>
              <span className="text-terminal-border-strong">·</span>
              <span className="text-amber-300">{settling}</span>
              <span className="text-terminal-border-strong">·</span>
              <span className="text-terminal-fg-muted">{won}w</span>
            </>
          )}
        </span>
      </span>

      <span
        aria-hidden
        className={[
          'font-mono text-caption transition-transform duration-150',
          active ? 'text-sky-300 translate-x-0.5' : 'text-terminal-fg-faint group-hover:text-sky-300 group-hover:translate-x-0.5',
        ].join(' ')}
      >
        →
      </span>
    </button>
  )
}
