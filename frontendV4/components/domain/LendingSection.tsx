'use client'

import { useAccount } from 'wagmi'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { VaultStats } from '@/components/lending/VaultStats'
import { VaultDeposit } from '@/components/lending/VaultDeposit'
import { VaultPosition } from '@/components/lending/VaultPosition'

const LendingErrorFallback = (
  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
    <h3 className="text-red-400 font-bold mb-2">Something went wrong</h3>
    <p className="text-white/60 text-sm">Please refresh the page.</p>
  </div>
)

interface LendingSectionProps {
  expanded: boolean
  onToggle: () => void
}

export function LendingSection({ expanded, onToggle }: LendingSectionProps) {
  const { isConnected } = useAccount()

  return (
    <div id="lending" className="bg-terminal-dark/50 border border-white/10 rounded-lg">
      <button
        onClick={onToggle}
        className="w-full p-4 flex justify-between items-center text-left"
      >
        <div>
          <h2 className="text-xl font-bold text-white">USDC Vault</h2>
          <p className="text-sm text-white/50">Earn yield by lending USDC to borrowers</p>
        </div>
        <span className="text-accent text-2xl">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 border-t border-white/10">
          {!isConnected ? (
            <div className="bg-terminal border border-white/10 rounded-lg p-8 text-center">
              <p className="text-white/70">Connect your wallet to access vault features</p>
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
