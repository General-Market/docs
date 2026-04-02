'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useReadContracts } from 'wagmi'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { indexL3 } from '@/lib/wagmi'
import fundData from '@/data/fund-branding.json'
import { cn } from '@/lib/utils/cn'

interface SourceFundsProps {
  sourceId: string
}

const STRATEGY_LABELS: Record<string, string> = {
  momentum: 'Momentum',
  contrarian: 'Contrarian',
  bullish: 'Bullish',
  bearish: 'Bearish',
  momentum_threshold: 'Selective',
  home_field: 'Home Field',
}

const STRATEGY_COLORS: Record<string, string> = {
  momentum: 'bg-blue-100 text-blue-700',
  contrarian: 'bg-orange-100 text-orange-700',
  bullish: 'bg-green-100 text-green-700',
  bearish: 'bg-red-100 text-red-700',
  momentum_threshold: 'bg-purple-100 text-purple-700',
  home_field: 'bg-yellow-100 text-yellow-700',
}

export function SourceFunds({ sourceId }: SourceFundsProps) {
  const funds = useMemo(
    () => fundData.funds.filter((f: any) => f.source === sourceId && f.vault),
    [sourceId],
  )

  // Skip if no funds for this source
  if (funds.length === 0) return null

  const vaultAddresses = funds.map((f: any) => f.vault as `0x${string}`).filter(Boolean)

  // Multicall: read totalAssets + totalSupply for each vault
  const calls = vaultAddresses.flatMap((addr) => [
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'totalAssets' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'totalSupply' as const, chainId: indexL3.id },
  ])

  const { data: results } = useReadContracts({
    contracts: calls as any,
    allowFailure: true,
    query: { enabled: vaultAddresses.length > 0 },
  })

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-text-muted">
          Managed Funds
        </h3>
        <span className="text-[11px] font-mono text-text-muted bg-black/[0.04] px-1.5 py-0.5 rounded">
          {funds.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {funds.map((fund: any, i: number) => {
          const base = i * 2
          const totalAssets = results?.[base]?.status === 'success' ? (results[base].result as bigint) : 0n
          const totalSupply = results?.[base + 1]?.status === 'success' ? (results[base + 1].result as bigint) : 0n
          const nav = totalSupply > 0n ? Number(totalAssets) / Number(totalSupply) : 1.0
          const perf = nav - 1.0
          const tvl = parseFloat(formatUnits(totalAssets, 18))

          return (
            <div
              key={fund.symbol}
              className="border border-border-light bg-card rounded-md overflow-hidden hover:border-border transition-colors"
            >
              {/* Color accent */}
              <div className="h-1" style={{ backgroundColor: fund.color }} />

              <div className="p-3.5">
                {/* Header: name + strategy */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-black">{fund.name}</span>
                    <span className="text-[11px] font-mono text-text-muted">{fund.symbol}</span>
                  </div>
                  <span className={cn(
                    'text-[10px] font-bold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded',
                    STRATEGY_COLORS[fund.strategy] || 'bg-gray-100 text-gray-600',
                  )}>
                    {STRATEGY_LABELS[fund.strategy] || fund.strategy}
                  </span>
                </div>

                {/* Tagline */}
                <p className="text-[11px] text-text-secondary leading-[1.4] line-clamp-2 mb-2.5">
                  {fund.tagline}
                </p>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-[11px] font-mono">
                  <div>
                    <span className="text-text-muted">TVL </span>
                    <span className="font-bold text-black">
                      ${tvl > 0 ? tvl.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">NAV </span>
                    <span className="font-bold text-black">${nav.toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Perf </span>
                    <span className={cn('font-bold', perf >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {perf >= 0 ? '+' : ''}{(perf * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="ml-auto">
                    <span className="text-text-muted">{fund.fee / 100}% fee</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
