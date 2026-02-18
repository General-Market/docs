'use client'

import { WalletConnectButton } from '@/components/domain/WalletConnectButton'

export function Header() {
  return (
    <header className="border-b border-white/10 px-6 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-accent font-bold text-xl tracking-tight">INDEX</span>
        </div>
        <WalletConnectButton />
      </div>
    </header>
  )
}
