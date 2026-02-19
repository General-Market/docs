'use client'

import { formatUnits } from 'viem'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'

/**
 * VaultStats component (AC7)
 *
 * Displays MetaMorpho vault stats: APY, total deposits, utilization.
 */
export function VaultStats() {
  const { vaultInfo, isLoading, error } = useMetaMorphoVault()

  if (isLoading) {
    return (
      <div className="bg-terminal-dark border border-white/10 rounded-lg p-6">
        <h2 className="text-lg font-bold text-white mb-4">USDC Lending Vault</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-white/10 rounded w-full" />
        </div>
      </div>
    )
  }

  if (error || !vaultInfo) {
    return (
      <div className="bg-terminal-dark border border-white/10 rounded-lg p-6">
        <h2 className="text-lg font-bold text-white mb-2">USDC Lending Vault</h2>
        <p className="text-white/60 text-sm">Vault info unavailable</p>
      </div>
    )
  }

  const totalAssetsFormatted = formatUnits(vaultInfo.totalAssets, 6)

  return (
    <div className="bg-terminal-dark border border-white/10 rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-bold text-white">{vaultInfo.name}</h2>
          <p className="text-white/60 text-sm">${vaultInfo.symbol}</p>
        </div>
        <div className="text-right">
          <p className="text-green-400 text-2xl font-bold font-mono">
            {vaultInfo.apy.toFixed(2)}%
          </p>
          <p className="text-white/40 text-xs">APY</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-black/30 rounded-lg p-4">
          <p className="text-white/60 text-xs mb-1">Total Deposits</p>
          <p className="text-white font-bold text-xl font-mono">
            ${parseFloat(totalAssetsFormatted).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-white/40 text-xs">USDC</p>
        </div>

        <div className="bg-black/30 rounded-lg p-4">
          <p className="text-white/60 text-xs mb-1">Utilization</p>
          <p className={`font-bold text-xl font-mono ${
            vaultInfo.utilization > 90 ? 'text-red-400' :
            vaultInfo.utilization > 70 ? 'text-yellow-400' :
            'text-green-400'
          }`}>
            {vaultInfo.utilization.toFixed(1)}%
          </p>
          <p className="text-white/40 text-xs">of deposits borrowed</p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-blue-400 text-sm">
          Deposit USDC to earn yield from borrowers. Your deposits are used by ITP holders as collateral loans.
        </p>
      </div>
    </div>
  )
}
