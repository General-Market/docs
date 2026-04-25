'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter'
import { useWallet } from '@/hooks/useWallet'
import { truncateAddress } from '@/lib/utils/address'
import { PulseDot } from './PulseDot'

// Top bar. A hamburger on mobile that opens the drawer. The wordmark.
// A network pulse. A wallet button. Each only earns its row by being
// brief.

interface NavBarProps {
  onMenuClick?: () => void
}

export function NavBar({ onMenuClick }: NavBarProps) {
  const [mounted, setMounted] = useState(false)
  const { address, connected, connecting, cluster, disconnect } = useWallet()
  const { setShowModal } = useUnifiedWalletContext()

  useEffect(() => { setMounted(true) }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:h-16 sm:px-6">
        {onMenuClick ? (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100 lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}

        <a href="/" className="flex items-center gap-2 shrink-0" aria-label="nsgame home">
          <Image
            src="/brand/nsgame-logo.svg"
            alt="nsgame"
            width={150}
            height={40}
            priority
            className="h-5 w-auto invert sm:h-6"
          />
          <span className="hidden font-mono text-[11px] font-light text-zinc-700 sm:inline">·</span>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 sm:inline">
            calendar
          </span>
        </a>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span
            aria-label={`Solana ${cluster}`}
            className="hidden items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[11px] lowercase tracking-[0.06em] text-zinc-400 sm:inline-flex"
          >
            <PulseDot active color="amber" size={6} />
            <span>{cluster}</span>
          </span>

          {!mounted ? (
            <button
              disabled
              className="h-10 min-w-[44px] rounded-md bg-zinc-800 px-4 text-sm font-medium text-zinc-300 opacity-60"
            >
              …
            </button>
          ) : connected && address ? (
            <button
              onClick={() => disconnect()}
              className="group inline-flex h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 font-mono text-[13px] text-zinc-200 transition-colors hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-300"
              aria-label="Disconnect wallet"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 group-hover:bg-rose-400" />
              <span>{truncateAddress(address)}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              disabled={connecting}
              className="inline-flex h-10 items-center rounded-md bg-zinc-100 px-4 text-[14px] font-medium text-zinc-900 transition-colors hover:bg-white disabled:opacity-60"
            >
              {connecting ? 'Opening…' : 'Connect wallet'}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
