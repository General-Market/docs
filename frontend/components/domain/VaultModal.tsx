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

interface VaultModalProps {
  onClose: () => void
}

export function VaultModal({ onClose }: VaultModalProps) {
  const { isConnected } = useAccount()

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-terminal border border-white/20 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold text-accent">USDC Vault</h2>
              <p className="text-sm text-white/50">Earn yield by lending USDC to borrowers</p>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">&times;</button>
          </div>

          {!isConnected ? (
            <div className="bg-terminal-dark border border-white/10 rounded-lg p-8 text-center">
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
      </div>
    </div>
  )
}
