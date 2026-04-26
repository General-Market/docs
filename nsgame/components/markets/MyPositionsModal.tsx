'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { useWallet } from '@/hooks/useWallet'
import { MyPositions } from './MyPositions'

// Full-screen sheet that hosts every position the wallet has ever held —
// open, settling, resolved. The sidebar surfaces a button; this is what
// the button reveals. Same component on desktop and mobile, the centred
// panel just feels different at each width.

interface MyPositionsModalProps {
  open: boolean
  onClose: () => void
}

export function MyPositionsModal({ open, onClose }: MyPositionsModalProps) {
  const { address } = useWallet()

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

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="My positions"
            className="absolute inset-x-0 bottom-0 top-[10vh] flex flex-col overflow-hidden border-t border-zinc-800 bg-zinc-950 shadow-[0_-12px_40px_-8px_rgb(0_0_0/0.6)] sm:inset-x-4 sm:top-[8vh] sm:rounded-2xl sm:border lg:left-1/2 lg:right-auto lg:top-1/2 lg:w-[min(720px,92vw)] lg:max-w-none lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:border lg:bottom-auto"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="flex items-center justify-between gap-2 border-b border-zinc-800/80 px-5 py-4">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                my positions
              </span>
              <div className="flex items-center gap-2">
                {address ? (
                  <Link
                    href={`/u/${address}`}
                    onClick={onClose}
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:text-zinc-200"
                  >
                    profile →
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
              {address ? (
                <MyPositions hideHeader className="border-0 bg-transparent" />
              ) : (
                <p className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                  connect a wallet to see positions
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
