'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useWallet } from '@/hooks/useWallet'
import { PulseDot } from './PulseDot'

// A drawer that opens, then closes. Like every interface — it asks for
// little, gives less. Nav links, a wordmark, the network's quiet pulse.

interface MobileMenuProps {
  open: boolean
  onClose: () => void
}

const LINKS: { href: string; label: string }[] = [
  { href: '/', label: 'Calendar' },
  { href: '#', label: 'Profile' },
]

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  const { cluster } = useWallet()

  // Lock body scroll while the drawer breathes.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // ESC closes it. The keyboard remembers what the user forgets.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
            aria-hidden
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-[80%] max-w-[320px] flex-col bg-white shadow-xl"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="flex items-baseline gap-2 border-b border-zinc-200/60 px-5 py-4">
              <span className="inline-flex items-baseline font-sans text-[20px] font-bold leading-none tracking-[-0.025em] text-zinc-900">
                nsgame
                <span
                  aria-hidden="true"
                  className="ml-[3px] inline-block h-[7px] w-[7px] translate-y-[-1px] rounded-[1px] bg-cyan-500"
                />
              </span>
              <span className="font-mono text-[11px] font-light text-zinc-300">·</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                calendar
              </span>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-4">
              <ul className="space-y-1">
                {LINKS.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={onClose}
                      className="block rounded-md px-3 py-2.5 text-[15px] text-zinc-800 transition-colors duration-150 hover:bg-zinc-100"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="border-t border-zinc-200/60 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span
                  aria-label={`Solana ${cluster}`}
                  className="inline-flex items-center gap-1.5 rounded border border-zinc-200/60 bg-white px-2 py-1 font-mono text-[11px] lowercase tracking-[0.06em] text-zinc-600"
                >
                  <PulseDot active color="amber" size={6} />
                  <span>{cluster}</span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
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
