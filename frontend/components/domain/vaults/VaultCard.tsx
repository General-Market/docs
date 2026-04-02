'use client'

import Image from 'next/image'
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
  const deployedPercent = (vault.deployedRatio * 100).toFixed(1)

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border-light rounded-md cursor-pointer
                 hover:bg-card-hover hover:shadow-card-hover transition-all overflow-hidden"
    >
      {/* Color accent bar */}
      {branding && (
        <div className="h-1" style={{ backgroundColor: branding.color }} />
      )}

      <div className="p-5">
        {/* Header: name + strategy + sources */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-text-primary text-sm">
              {branding?.name ?? vault.name}
              {branding && (
                <span className="ml-1.5 text-text-muted font-mono text-xs font-normal">
                  {branding.symbol}
                </span>
              )}
            </h3>
            {!branding && (
              <p className="text-xs text-text-muted font-mono mt-0.5">
                {truncateAddress(vault.manager)}
              </p>
            )}
          </div>

          {/* Source logos */}
          {branding && branding.sourceLogos.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              {branding.sourceLogos.map((logo, i) => (
                <Image
                  key={i}
                  src={logo}
                  alt=""
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              ))}
            </div>
          )}
        </div>

        {/* Strategy + category pills */}
        {branding && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className={cn(
              'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full',
              STRATEGY_COLORS[branding.strategy] ?? 'bg-black/5 text-text-secondary'
            )}>
              {branding.strategy}
            </span>
            <span className="text-[10px] font-medium text-text-muted bg-black/[0.04] px-1.5 py-0.5 rounded-full">
              {branding.category}
            </span>
          </div>
        )}

        {/* Tagline */}
        {branding && (
          <p className="text-xs text-text-secondary mt-2 line-clamp-2 leading-relaxed">
            {branding.tagline}
          </p>
        )}

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
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(vault.deployedRatio * 100, 100)}%`,
                backgroundColor: branding?.color ?? 'var(--color-brand)',
              }}
            />
          </div>
        </div>

        {/* User balance */}
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
    </div>
  )
}
