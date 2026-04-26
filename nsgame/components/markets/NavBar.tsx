'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter'
import { useWallet } from '@/hooks/useWallet'
import { truncateAddress } from '@/lib/utils/address'
import { SourceIcon } from './SourceIcon'
import type { SourceFilter } from './FilterBar'

// Top bar. A narrow logo, a horizontal strip of source tabs, a wallet
// pill. The strip itself is the navigation — a category bar masquerading
// as a header.

interface NavBarProps {
  source?: SourceFilter
  onSourceChange?: (s: SourceFilter) => void
  totalCount?: number
  sourceCounts?: Record<number, number>
  onMenuClick?: () => void
}

const SOURCES: Array<{ id: 1 | 2 | 3 | 4 | 5; label: string }> = [
  { id: 1, label: 'Xvideos' },
  { id: 2, label: 'Xnxx' },
  { id: 3, label: 'Pornhub' },
  { id: 4, label: 'Chaturbate' },
  { id: 5, label: 'Eporner' },
]

function tabClasses(active: boolean): string {
  return [
    'inline-flex h-9 shrink-0 items-center gap-2 px-3 text-[13px] font-medium tracking-tight transition-colors duration-150',
    'border-b-2',
    active
      ? 'border-emerald-400 text-zinc-100'
      : 'border-transparent text-zinc-500 hover:text-zinc-200',
  ].join(' ')
}

export function NavBar({
  source,
  onSourceChange,
  totalCount,
  sourceCounts,
  onMenuClick,
}: NavBarProps) {
  const [mounted, setMounted] = useState(false)
  const { address, connected, connecting, disconnect } = useWallet()
  const { setShowModal } = useUnifiedWalletContext()

  useEffect(() => { setMounted(true) }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
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

        <a href="/" className="flex shrink-0 items-center" aria-label="nsgame home">
          <Image
            src="/brand/nsgame-logo.svg"
            alt="nsgame"
            width={120}
            height={32}
            priority
            className="h-7 w-auto sm:h-8"
          />
        </a>

        {onSourceChange ? (
          <nav
            aria-label="Source filter"
            className="hidden flex-1 snap-x snap-mandatory items-center gap-1 overflow-x-auto scrollbar-hide md:flex"
          >
            <button
              type="button"
              onClick={() => onSourceChange('all')}
              aria-pressed={source === 'all'}
              className={tabClasses(source === 'all')}
            >
              <span>All</span>
              {typeof totalCount === 'number' ? (
                <span className="text-[11px] tabular-nums text-zinc-600">{totalCount}</span>
              ) : null}
            </button>
            {SOURCES.map(s => {
              const active = source === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSourceChange(s.id)}
                  aria-pressed={active}
                  className={tabClasses(active)}
                >
                  <SourceIcon sourceId={s.id} className="h-4 w-4" />
                  <span>{s.label}</span>
                  {sourceCounts && typeof sourceCounts[s.id] === 'number' ? (
                    <span className="text-[11px] tabular-nums text-zinc-600">
                      {sourceCounts[s.id]}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>
        ) : <div className="flex-1" />}

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {!mounted ? (
            <button
              disabled
              className="h-9 min-w-[44px] rounded-md bg-zinc-800 px-4 text-[13px] font-medium text-zinc-300 opacity-60"
            >
              …
            </button>
          ) : connected && address ? (
            <button
              onClick={() => disconnect()}
              className="group inline-flex h-9 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 font-mono text-[12px] text-zinc-200 transition-colors hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-300"
              aria-label="Disconnect wallet"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 group-hover:bg-rose-400" />
              <span className="hidden sm:inline">{truncateAddress(address)}</span>
              <span className="sm:hidden">Wallet</span>
            </button>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              disabled={connecting}
              className="inline-flex h-9 items-center rounded-md bg-emerald-400 px-4 text-[13px] font-semibold text-zinc-950 transition-colors hover:bg-emerald-300 disabled:opacity-60"
            >
              {connecting ? 'Opening…' : 'Sign up'}
            </button>
          )}
        </div>
      </div>

      {/* Mobile source tab strip — separate row below the main bar */}
      {onSourceChange ? (
        <nav
          aria-label="Source filter"
          className="flex snap-x snap-mandatory items-center gap-0.5 overflow-x-auto px-2 scrollbar-hide md:hidden"
        >
          <button
            type="button"
            onClick={() => onSourceChange('all')}
            aria-pressed={source === 'all'}
            className={tabClasses(source === 'all')}
          >
            <span>All</span>
            {typeof totalCount === 'number' ? (
              <span className="text-[11px] tabular-nums text-zinc-600">{totalCount}</span>
            ) : null}
          </button>
          {SOURCES.map(s => {
            const active = source === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSourceChange(s.id)}
                aria-pressed={active}
                className={tabClasses(active)}
              >
                <SourceIcon sourceId={s.id} className="h-4 w-4" />
                <span>{s.label}</span>
              </button>
            )
          })}
        </nav>
      ) : null}
    </header>
  )
}
