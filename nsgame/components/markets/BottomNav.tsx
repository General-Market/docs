'use client'

import { useState } from 'react'
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter'
import { useWallet } from '@/hooks/useWallet'
import { useTranslations } from 'next-intl'
import { BottomNavMoreSheet } from './BottomNavMoreSheet'

// Mobile-only fixed bottom bar. Four tabs. The screen ends with a
// reminder of where the screen begins.

interface BottomNavProps {
  onMenuClick?: () => void
  onTicketClick?: () => void
  hasTicket?: boolean
}

function CalendarIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <rect x="2.5" y="4" width="15" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function FilterIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M3 5h14M5.5 10h9M8 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function WalletIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <rect x="2.5" y="5" width="15" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 8.5h15" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="14" cy="12" r="0.9" fill="currentColor" />
    </svg>
  )
}

function MoreIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M3.5 6h13M3.5 10h13M3.5 14h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function BottomNav({ onMenuClick, onTicketClick, hasTicket = false }: BottomNavProps) {
  const t = useTranslations('common')
  const { connected, address, disconnect } = useWallet()
  const { setShowModal } = useUnifiedWalletContext()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleWallet = () => {
    if (connected && address) {
      disconnect()
    } else {
      setShowModal(true)
    }
  }

  return (
    <>
      <nav
        aria-label="Bottom navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800/80 bg-zinc-950/90 pb-[env(safe-area-inset-bottom,0)] backdrop-blur lg:hidden"
      >
        <div className="grid grid-cols-4">
          <button
            type="button"
            aria-label="Calendar"
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-emerald-400"
          >
            <CalendarIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-tight">Calendar</span>
          </button>

          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Filters"
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <FilterIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-tight">Filters</span>
          </button>

          <button
            type="button"
            onClick={onTicketClick ?? handleWallet}
            aria-label={connected ? 'Wallet' : 'Connect wallet'}
            className="relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <WalletIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-tight">
              {connected ? 'Wallet' : 'Connect'}
            </span>
            {hasTicket ? (
              <span
                aria-hidden
                className="absolute right-[28%] top-2 h-1.5 w-1.5 rounded-full bg-emerald-400"
              />
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label={t('nav.more')}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <MoreIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-tight">{t('nav.more')}</span>
          </button>
        </div>
      </nav>

      <BottomNavMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
