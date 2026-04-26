'use client'

import { useEffect, useRef, useState } from 'react'

// Tiny "?" affordance with a dismissible popover. No hover-dismiss, no
// timer — opens on click, closes on outside-click, X, or Escape. One
// line of copy, dark surface, terminal hue. Used inside BetSheet and
// BetTicket to absorb questions the user would otherwise carry away.

export interface InlineTipProps {
  /** One short sentence. Cioran register: declarative, no exclamation. */
  label: string
  /** Optional aria description for the trigger. */
  ariaLabel?: string
  className?: string
}

export function InlineTip({ label, ariaLabel = 'Explain', className = '' }: InlineTipProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={wrapRef} className={['relative inline-flex', className].join(' ')}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="grid h-4 w-4 place-items-center rounded-full border border-terminal-border text-[10px] font-semibold leading-none text-terminal-fg-faint transition-colors hover:border-terminal-border-strong hover:text-terminal-fg-muted"
      >
        ?
      </button>
      {open ? (
        <span
          role="dialog"
          className="absolute left-0 top-6 z-30 w-64 rounded-md border border-terminal-border bg-terminal-surface-deep p-3 text-caption leading-relaxed text-terminal-fg-muted shadow-modal"
        >
          <span className="block pr-5">{label}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Dismiss"
            className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded text-terminal-fg-faint transition-colors hover:text-terminal-fg"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </span>
      ) : null}
    </span>
  )
}
