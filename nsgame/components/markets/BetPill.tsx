'use client'

import { useEffect, useState } from 'react'
import { useLastBet } from '@/hooks/useLastBet'

// A small persistent pill that follows the user across every page in
// the (app) group. Shows the side, the truncated market label, and the
// time-to-close of the most recent open bet. Tapping it asks the host
// page (Calendar) to reopen the bet sheet for that market — a CustomEvent
// the hosts may listen to in a follow-up phase. If the host doesn't
// handle it, the pill at minimum surfaces the bet's state.
//
// Hidden when:
//   - no last open bet
//   - the bet has already closed
//   - the BetSheet is open (the page dispatches `nsgame:bet-sheet-open`
//     with detail.open=true to suppress the pill, false to restore)

const HIDE_EVENT = 'nsgame:bet-sheet-open'
const REOPEN_EVENT = 'nsgame:reopen-bet'

function useNowSecs(): number {
  const [now, setNow] = useState<number>(0)
  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000))
    const id = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function formatRemaining(secs: number): string {
  if (secs <= 0) return 'closed'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${secs}s`
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}

export function BetPill() {
  const bet = useLastBet()
  const now = useNowSecs()
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onSheet = (e: Event) => {
      const ce = e as CustomEvent<{ open?: boolean }>
      setSheetOpen(Boolean(ce.detail?.open))
    }
    window.addEventListener(HIDE_EVENT, onSheet)
    return () => window.removeEventListener(HIDE_EVENT, onSheet)
  }, [])

  if (!bet) return null
  if (sheetOpen) return null
  if (now > 0 && bet.closesAt <= now) return null

  const remaining = now > 0 ? bet.closesAt - now : bet.closesAt
  const label = bet.marketLabel ?? bet.pickLabel ?? bet.marketPda.slice(0, 8)

  function handleClick() {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent(REOPEN_EVENT, { detail: { marketPda: bet!.marketPda } }),
    )
  }

  return (
    <div
      className={[
        'fixed z-40 pointer-events-none',
        // Desktop: bottom-right, modest inset.
        'right-4 bottom-4',
        // Mobile: anchored above BottomNav (72px tall + safe-area).
        'max-lg:right-3 max-lg:bottom-[calc(env(safe-area-inset-bottom,0px)+72px)]',
      ].join(' ')}
      aria-live="polite"
    >
      <button
        type="button"
        onClick={handleClick}
        className={[
          'pointer-events-auto inline-flex items-center gap-2 rounded-full',
          'border border-zinc-700/80 bg-zinc-950/90 px-3 py-1.5 backdrop-blur',
          'font-mono text-[11px] uppercase tracking-[0.06em] text-zinc-300',
          'shadow-[0_8px_24px_rgba(0,0,0,0.45)]',
          'transition-colors hover:border-zinc-500 hover:text-white',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400',
        ].join(' ')}
        aria-label={`Reopen last bet on ${label}`}
      >
        <span
          className={
            bet.side === 'yes'
              ? 'font-semibold text-emerald-300'
              : 'font-semibold text-rose-300'
          }
        >
          {bet.side.toUpperCase()}
        </span>
        <span className="text-zinc-600">·</span>
        <span className="normal-case tracking-normal text-zinc-200">
          {truncate(label, 28)}
        </span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-400">
          closes in {formatRemaining(remaining)}
        </span>
      </button>
    </div>
  )
}
