'use client'

import { useEffect, useState } from 'react'
import type { StatusFilter } from './CategorySidebar'

// A bottom sheet that slides up to admit a small confession: which
// statuses you'd like to see. Mobile-only by composition. Plain Tailwind
// transitions — no framer.

const STATUSES: Array<{ id: StatusFilter; label: string; sub: string }> = [
  { id: 'live', label: 'live', sub: 'taking bets' },
  { id: 'settling', label: 'settling', sub: 'awaiting the keeper' },
  { id: 'resolved', label: 'resolved', sub: 'paid out' },
]

export interface StatusSheetProps {
  open: boolean
  statuses: StatusFilter[]
  onStatusToggle?: (s: StatusFilter) => void
  onClose: () => void
}

export function StatusSheet({ open, statuses, onStatusToggle, onClose }: StatusSheetProps) {
  // Two-phase mount so the enter transition has something to animate
  // from. `mounted` controls presence in the DOM; `visible` controls
  // the transform/opacity classes.
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // Next frame: flip to visible so the transition runs.
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    // Wait for the slide-down to finish before unmounting.
    const t = window.setTimeout(() => setMounted(false), 250)
    return () => window.clearTimeout(t)
  }, [open])

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden" aria-hidden={!open}>
      <div
        onClick={onClose}
        aria-hidden
        className={[
          'absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out',
          visible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Status filters"
        className={[
          'absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-2xl bg-white shadow-2xl',
          'transition-transform ease-out',
          visible ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
        style={{ transitionDuration: '250ms' }}
      >
        <div className="flex items-center justify-between border-b border-zinc-200/60 px-5 py-4">
          <div>
            <p className="text-[11px] font-medium tracking-tight text-zinc-400">Filters</p>
            <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">Status</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] font-medium tracking-tight text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-0.5">
            {STATUSES.map(s => {
              const active = statuses.includes(s.id)
              const disabled = !onStatusToggle
              return (
                <label
                  key={s.id}
                  className={[
                    'flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 py-2 transition-colors',
                    disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                    active
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    disabled={disabled}
                    onChange={() => onStatusToggle?.(s.id)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-1 focus:ring-zinc-900"
                  />
                  <span className="flex flex-col items-start">
                    <span className="text-[13.5px] capitalize">{s.label}</span>
                    <span className="text-[11px] text-zinc-500">{s.sub}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {!onStatusToggle ? (
            <p className="mt-3 px-3 text-[11px] text-zinc-400">
              Status filters not yet wired. Soon.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
