'use client'

import dynamic from 'next/dynamic'
import { ReactNode } from 'react'
import { Link } from '@/i18n/routing'

const WalletControls = dynamic(
  () => import('./WalletControls').then((m) => ({ default: m.WalletControls })),
  {
    ssr: false,
    loading: () => (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-apple-pill border text-[12px]"
        style={{
          borderColor: 'var(--apple-line)',
          color: 'var(--apple-text-tertiary)',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--apple-text-tertiary)' }}
        />
        ...
      </span>
    ),
  },
)

type TopBarProps = {
  search?: ReactNode
}

export function TopBar({ search }: TopBarProps) {
  return (
    <header
      className="md:col-span-2 grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-6 border-b px-4 sm:px-6 py-3"
      style={{
        background: 'var(--apple-panel)',
        borderColor: 'var(--apple-line)',
      }}
    >
      <Brand />
      <div className="mx-auto w-full max-w-[520px]">{search}</div>
      <div className="shrink-0">
        <WalletControls isDark={false} />
      </div>
    </header>
  )
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <div
        className="grid place-items-center font-bold text-white"
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: 'var(--apple-text)',
          fontSize: 11,
        }}
      >
        GM
      </div>
      <span
        className="hidden sm:inline font-semibold"
        style={{
          fontFamily: 'var(--apple-font-display)',
          fontSize: 19,
          letterSpacing: 'var(--apple-track-tight)',
          color: 'var(--apple-text)',
        }}
      >
        General Market
      </span>
      <span
        className="hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
        style={{
          fontSize: 10,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          background: '#0071e3',
          color: '#ffffff',
        }}
      >
        <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M6 1L2 3v3.2c0 2.4 1.7 4.4 4 4.8 2.3-.4 4-2.4 4-4.8V3L6 1z"
            fill="currentColor"
          />
          <path
            d="M4.4 6l1.2 1.2L8 4.8"
            stroke="#0071e3"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Anti-Cheat
      </span>
    </Link>
  )
}
