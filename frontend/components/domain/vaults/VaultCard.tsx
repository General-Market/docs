'use client'

import { formatUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { cn } from '@/lib/utils/cn'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { indexL3 } from '@/lib/wagmi'
import { useFundBranding } from '@/hooks/vaults/useFundBranding'
import type { VaultInfo } from '@/hooks/vaults/useVaults'

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const STRATEGY_COLORS: Record<string, string> = {
  Momentum: 'bg-emerald-500/10 text-emerald-700',
  Contrarian: 'bg-rose-500/10 text-rose-700',
  Bullish: 'bg-sky-500/10 text-sky-700',
  'Home Field': 'bg-amber-500/10 text-amber-700',
}

interface VaultCardProps {
  vault: VaultInfo
  onClick: () => void
}

export function VaultCard({ vault, onClick }: VaultCardProps) {
  const { address } = useAccount()
  const branding = useFundBranding(vault.address)

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
  const feePercent = branding ? branding.fee / 100 : Number(vault.performanceFeeRate) / 1e16

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border-light rounded-md cursor-pointer
                 hover:bg-card-hover hover:shadow-card-hover transition-all overflow-hidden
                 w-full"
    >
      {/* Color accent bar */}
      <div
        className="h-[3px]"
        style={{ backgroundColor: branding?.color ?? 'var(--color-brand)' }}
      />

      <div className="p-3.5">
        {/* Name + symbol + strategy pill */}
        <div className="flex items-start justify-between gap-1.5 mb-1.5">
          <div className="min-w-0">
            <span className="font-bold text-text-primary text-sm leading-tight">
              {branding?.name ?? vault.name}
            </span>
            {branding && (
              <span className="ml-1.5 text-text-muted font-mono text-[11px] font-normal">
                {branding.symbol}
              </span>
            )}
            {!branding && (
              <p className="text-[10px] text-text-muted font-mono mt-0.5">
                {truncateAddress(vault.manager)}
              </p>
            )}
          </div>
          {branding && (
            <span className={cn(
              'shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full whitespace-nowrap',
              STRATEGY_COLORS[branding.strategy] ?? 'bg-black/5 text-text-secondary',
            )}>
              {branding.strategy}
            </span>
          )}
        </div>

        {/* Tagline */}
        {branding && (
          <p className="text-[11px] text-text-secondary leading-[1.35] line-clamp-1 mb-2.5">
            {branding.tagline}
          </p>
        )}

        {/* Stats row: TVL | NAV | Perf | Fee */}
        <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
          <div className="flex flex-col">
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-text-muted leading-tight">TVL</span>
            <span className="font-bold text-black">${vault.tvlFormatted}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-text-muted leading-tight">NAV</span>
            <span className="text-text-primary">${vault.navPerShare.toFixed(4)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-text-muted leading-tight">Perf</span>
            <span className={cn(isPositive ? 'text-color-up' : 'text-color-down')}>
              {isPositive ? '+' : ''}{perfPercent}%
            </span>
          </div>
          <div className="flex flex-col ml-auto">
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-text-muted leading-tight">Fee</span>
            <span className="text-text-secondary">{feePercent.toFixed(0)}%</span>
          </div>
        </div>

        {/* User balance — only when wallet has shares */}
        {shares > 0n && (
          <div className="mt-2.5 pt-2.5 border-t border-border-light flex justify-between text-[11px]">
            <span className="text-text-muted">Your position</span>
            <span className="font-mono tabular-nums font-semibold text-text-primary">
              ${userValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
