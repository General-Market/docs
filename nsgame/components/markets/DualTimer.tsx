'use client'

import { useNowSecs } from './CountdownTimer'

// Two countdowns stacked. Below each, a 2px progress bar that drains as
// the deadline approaches. Once `closeTime` passes, the close timer
// becomes a static "closed" pill and the settle timer takes over the
// amber active state. Once `settlementTime` passes, both timers read
// "—" — the parent is expected to advance to the next slot by then.

function formatHMS(secs: number): string {
  if (secs <= 0) return '0:00'
  const days = Math.floor(secs / 86_400)
  const hours = Math.floor((secs % 86_400) / 3600)
  const mins = Math.floor((secs % 3600) / 60)
  const ss = secs % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}:${mins.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
  return `${mins}:${ss.toString().padStart(2, '0')}`
}

export interface DualTimerProps {
  /** unix seconds */
  closeTime: number
  /** unix seconds */
  settlementTime: number
  /**
   * Anchor for progress-bar denominators: typically the moment the slot
   * was generated (or simply closeTime - closeOffsetSecs). When omitted
   * we fall back to a 60s window so the bar still moves.
   */
  closeAnchor?: number
  className?: string
}

export function DualTimer({
  closeTime,
  settlementTime,
  closeAnchor,
  className = '',
}: DualTimerProps) {
  const now = useNowSecs()

  const closeRemaining = closeTime - now
  const settleRemaining = settlementTime - now
  const closed = closeRemaining <= 0
  const settled = settleRemaining <= 0

  const closeWindow = Math.max(1, closeTime - (closeAnchor ?? closeTime - 60))
  const settleWindow = Math.max(1, settlementTime - closeTime)

  const closePct = closed
    ? 0
    : Math.max(0, Math.min(100, (closeRemaining / closeWindow) * 100))
  const settlePct = settled
    ? 0
    : closed
      ? Math.max(0, Math.min(100, (settleRemaining / settleWindow) * 100))
      : 100

  const closeText = now === 0 ? '—' : closed ? 'closed' : formatHMS(closeRemaining)
  const settleText = now === 0 ? '—' : settled ? 'settled' : formatHMS(settleRemaining)

  return (
    <div className={['space-y-2', className].join(' ')}>
      <div className="space-y-1">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em]">
          <span className="text-zinc-500">closes  in</span>
          <span
            className={[
              'tabular-nums',
              closed ? 'text-zinc-400' : 'text-zinc-700',
            ].join(' ')}
            suppressHydrationWarning
          >
            {closeText}
          </span>
        </div>
        <div className="h-[2px] w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className={[
              'h-full transition-[width] duration-1000 ease-linear',
              closed ? 'bg-zinc-300' : 'bg-amber-400',
            ].join(' ')}
            style={{ width: `${closePct}%` }}
            aria-hidden
          />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em]">
          <span className="text-zinc-500">settles in</span>
          <span
            className={[
              'tabular-nums',
              settled ? 'text-zinc-400' : 'text-zinc-700',
            ].join(' ')}
            suppressHydrationWarning
          >
            {settleText}
          </span>
        </div>
        <div className="h-[2px] w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className={[
              'h-full transition-[width] duration-1000 ease-linear',
              settled ? 'bg-zinc-300' : closed ? 'bg-amber-400' : 'bg-zinc-300',
            ].join(' ')}
            style={{ width: `${settlePct}%` }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}
