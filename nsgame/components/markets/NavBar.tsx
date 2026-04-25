'use client'

import { useEffect, useState } from 'react'
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter'
import { useWallet } from '@/hooks/useWallet'
import { truncateAddress } from '@/lib/utils/address'
import { PulseDot } from './PulseDot'

// Top bar. Logo, network badge, wallet. Nothing else earns the row.

export function NavBar() {
  const [mounted, setMounted] = useState(false)
  const { address, connected, connecting, cluster, disconnect } = useWallet()
  const { setShowModal } = useUnifiedWalletContext()

  useEffect(() => { setMounted(true) }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/60 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <a href="/" className="flex items-center gap-1.5 shrink-0">
          <span className="text-[18px] font-semibold tracking-[-0.02em] text-zinc-900">
            nsgame
          </span>
          <span className="hidden font-mono text-[11px] font-light text-zinc-300 sm:inline">
            ·
          </span>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 sm:inline">
            calendar
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          <span
            aria-label={`Solana ${cluster}`}
            className="hidden items-center gap-1.5 rounded border border-zinc-200/60 bg-white px-2 py-1 font-mono text-[11px] lowercase tracking-[0.06em] text-zinc-600 sm:inline-flex"
          >
            <PulseDot active color="amber" size={6} />
            <span>{cluster}</span>
          </span>

          {!mounted ? (
            <button
              disabled
              className="h-11 min-w-[44px] rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white opacity-50"
            >
              …
            </button>
          ) : connected && address ? (
            <button
              onClick={() => disconnect()}
              className="group inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 font-mono text-[13px] text-zinc-800 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              aria-label="Disconnect wallet"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 group-hover:bg-rose-500" />
              <span>{truncateAddress(address)}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              disabled={connecting}
              className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
            >
              {connecting ? 'Opening…' : 'Connect wallet'}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
