'use client'

import { formatUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { cn } from '@/lib/utils/cn'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { indexL3 } from '@/lib/wagmi'
import type { VaultInfo } from '@/hooks/vaults/useVaults'

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

interface VaultCardProps {
  vault: VaultInfo
  onClick: () => void
}

export function VaultCard({ vault, onClick }: VaultCardProps) {
  const { address } = useAccount()

  // Read user's share balance in this vault
  const { data: userShares } = useReadContract({
    address: vault.address,
    abi: VISION_VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address },
  })

  const shares = (userShares as bigint | undefined) ?? 0n
  const userValue = vault.totalSupply > 0n && shares > 0n
    ? (Number(shares) / Number(vault.totalSupply)) * parseFloat(formatUnits(vault.totalAssets, 18))
    : 0

  const perfPercent = (vault.performanceSinceInception * 100).toFixed(2)
  const isPositive = vault.performanceSinceInception >= 0
  const feePercent = Number(vault.performanceFeeRate) / 1e16
  const deployedPercent = (vault.deployedRatio * 100).toFixed(1)

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border-light rounded-md p-5 cursor-pointer
                 hover:bg-card-hover hover:shadow-card-hover transition-all"
    >
      {/* Name + manager */}
      <h3 className="font-bold text-text-primary text-sm">{vault.name}</h3>
      <p className="text-xs text-text-muted font-mono mt-0.5">
        {truncateAddress(vault.manager)}
      </p>

      {/* TVL */}
      <p className="text-title font-extrabold font-mono tabular-nums text-black mt-3">
        ${vault.tvlFormatted}
      </p>
      <p className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted">TVL</p>

      {/* Stats row */}
      <div className="flex gap-4 mt-3 text-xs text-text-secondary font-mono tabular-nums">
        <div>
          <span className="text-text-muted">NAV </span>
          <span className="text-text-primary">${vault.navPerShare.toFixed(4)}</span>
        </div>
        <div>
          <span className="text-text-muted">Perf </span>
          <span className={cn(
            isPositive ? 'text-color-up' : 'text-color-down',
          )}>
            {isPositive ? '+' : ''}{perfPercent}%
          </span>
        </div>
        <div>
          <span className="text-text-muted">Fee </span>
          <span>{feePercent.toFixed(0)}%</span>
        </div>
      </div>

      {/* Deployed capital bar */}
      <div className="mt-3">
        <div className="flex justify-between text-micro text-text-muted mb-1">
          <span>Capital deployed</span>
          <span className="font-mono tabular-nums">{deployedPercent}%</span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all"
            style={{ width: `${Math.min(vault.deployedRatio * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* User balance (if any) */}
      {shares > 0n && (
        <div className="mt-3 pt-3 border-t border-border-light">
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Your balance</span>
            <span className="font-mono tabular-nums text-text-primary font-semibold">
              ${userValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-xs mt-0.5">
            <span className="text-text-muted">Shares</span>
            <span className="font-mono tabular-nums text-text-secondary">
              {parseFloat(formatUnits(shares, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
