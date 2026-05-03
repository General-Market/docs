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
        className="hidden sm:inline-block rounded-full px-1.5 py-0.5 font-medium"
        style={{
          fontSize: 10,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          background: 'rgba(0,0,0,0.05)',
          color: 'var(--apple-text-secondary)',
        }}
      >
        Anti-Cheat
      </span>
    </Link>
  )
}
