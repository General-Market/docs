// Single source of truth for dialog a11y across nsgame.
'use client'

import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

interface DialogA11yOptions {
  initialFocusRef?: React.RefObject<HTMLElement>
}

export function useDialogA11y(
  open: boolean,
  onClose: () => void,
  opts?: DialogA11yOptions,
): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusFirst = () => {
      const explicit = opts?.initialFocusRef?.current
      if (explicit) {
        explicit.focus()
        return
      }
      const root = containerRef.current
      if (!root) return
      const first = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      first?.focus()
    }

    // Defer one frame so the panel has mounted before we reach for focusables.
    const raf = requestAnimationFrame(focusFirst)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const root = containerRef.current
      if (!root) return
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(el => !el.hasAttribute('disabled'))
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [open, onClose, opts?.initialFocusRef])

  return containerRef
}
