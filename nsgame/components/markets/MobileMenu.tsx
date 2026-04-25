'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useWallet } from '@/hooks/useWallet'
import { PulseDot } from './PulseDot'
import { CategorySidebar, type StatusFilter } from './CategorySidebar'
import type { BoardFilter, HorizonFilter } from './FilterBar'
import type { UpcomingSlot } from '@/lib/markets/hooks'

// A drawer that opens, then closes. Carries the same filters the
// sidebar holds on desktop — there is only one truth, and on mobile it
// hides until called.

interface MobileMenuProps {
  open: boolean
  onClose: () => void
  board: BoardFilter
  horizon: HorizonFilter
  statuses: StatusFilter[]
  slots: UpcomingSlot[]
  onBoardChange: (b: BoardFilter) => void
  onHorizonChange: (h: HorizonFilter) => void
  onStatusToggle: (s: StatusFilter) => void
}

export function MobileMenu({
  open,
  onClose,
  board,
  horizon,
  statuses,
  slots,
  onBoardChange,
  onHorizonChange,
  onStatusToggle,
}: MobileMenuProps) {
  const { cluster } = useWallet()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Wrap callbacks so the drawer auto-closes when a board/horizon is
  // chosen — choice is the signal the user is done picking.
  const handleBoard = (b: BoardFilter) => { onBoardChange(b); onClose() }
  const handleHorizon = (h: HorizonFilter) => { onHorizonChange(h); onClose() }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-[340px] flex-col border-r border-zinc-800 bg-zinc-950 shadow-[8px_0_32px_-12px_rgb(0_0_0/0.6)]"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 px-5 py-4">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                Categories
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-5">
              <CategorySidebar
                board={board}
                horizon={horizon}
                statuses={statuses}
                slots={slots}
                onBoardChange={handleBoard}
                onHorizonChange={handleHorizon}
                onStatusToggle={onStatusToggle}
              />
            </div>

            <div className="border-t border-zinc-800/80 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span
                  aria-label={`Solana ${cluster}`}
                  className="inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[11px] lowercase tracking-[0.06em] text-zinc-400"
                >
                  <PulseDot active color="amber" size={6} />
                  <span>{cluster}</span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                  nsgame.io
                </span>
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
