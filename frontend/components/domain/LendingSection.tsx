'use client'

import { useAccount } from 'wagmi'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { VaultStats } from '@/components/lending/VaultStats'
import { VaultDeposit } from '@/components/lending/VaultDeposit'
import { VaultPosition } from '@/components/lending/VaultPosition'

const LendingErrorFallback = (
  <div className="bg-surface-down border border-color-down/30 rounded-xl p-6 text-center">
    <h3 className="text-color-down font-bold mb-2">Something went wrong</h3>
    <p className="text-text-muted text-sm">Please refresh the page.</p>
  </div>
)

interface LendingSectionProps {
  expanded: boolean
  onToggle: () => void
}

export function LendingSection({ expanded, onToggle }: LendingSectionProps) {
  const { isConnected } = useAccount()

  return (
    <div id="lending" className="bg-card rounded-xl shadow-card border border-border-light">
      <button
        onClick={onToggle}
        className="w-full p-4 flex justify-between items-center text-left"
      >
        <div>
          <h2 className="text-xl font-bold text-text-primary">USDC Vault</h2>
          <p className="text-sm text-text-muted">Earn yield by lending USDC to borrowers</p>
        </div>
        <span className="text-zinc-900 text-2xl">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 border-t border-border-light">
          {!isConnected ? (
            <div className="bg-card rounded-xl shadow-card border border-border-light p-8 text-center">
              <p className="text-text-secondary">Connect your wallet to access vault features</p>
            </div>
          ) : (
            <ErrorBoundary fallback={LendingErrorFallback}>
              <div className="space-y-4">
                <VaultStats />
                <VaultDeposit />
                <VaultPosition />
              </div>
            </ErrorBoundary>
          )}
        </div>
      )}
    </div>
  )
}
