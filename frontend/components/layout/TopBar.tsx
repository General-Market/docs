'use client'

import dynamic from 'next/dynamic'
import { ReactNode } from 'react'

const WalletControls = dynamic(
  () => import('./WalletControls').then((m) => ({ default: m.WalletControls })),
  {
    ssr: false,
    loading: () => (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-apple-sm border text-[12px]"
        style={{
          borderColor: 'var(--apple-border)',
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
      className="sticky top-0 z-40 apple-glass"
      style={{ height: 'var(--apple-shell-topbar)' }}
    >
      <div className="h-full px-6 flex items-center gap-6">
        <div className="flex-1 min-w-0 max-w-2xl">
          {search}
        </div>
        <div className="shrink-0">
          <WalletControls isDark={false} />
        </div>
      </div>
    </header>
  )
}
