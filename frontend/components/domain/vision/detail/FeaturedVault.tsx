'use client'

import { useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useReadContracts } from 'wagmi'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { indexL3 } from '@/lib/wagmi'
import fundData from '@/data/fund-branding.json'
import { VaultActions } from '@/components/domain/vaults/VaultActions'
import type { VaultInfo } from '@/hooks/vaults/useVaults'
import { Link } from '@/i18n/routing'

const STRATEGY_LABELS: Record<string, string> = {
  momentum: 'MOMENTUM',
  contrarian: 'CONTRARIAN',
  bullish: 'BULLISH',
  bearish: 'BEARISH',
  momentum_threshold: 'SELECTIVE',
  home_field: 'HOME FIELD',
  regime: 'REGIME',
  mean_reversion: 'MEAN REVERSION',
  adoption_curve: 'ADOPTION CURVE',
  cluster: 'CLUSTER',
}

interface FeaturedVaultProps {
  sourceId: string
}

function formatPerf(perf: number) {
  const sign = perf >= 0 ? '+' : ''
  return `${sign}${(perf * 100).toFixed(2)}%`
}

function formatTvl(tvl: number) {
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(1)}K`
  return `$${tvl.toFixed(0)}`
}

function buildVaultInfo(fund: any, totalAssets: bigint, totalSupply: bigint): VaultInfo {
  const nav = totalSupply > 0n ? Number(totalAssets) / Number(totalSupply) : 1.0
  const perf = nav - 1.0
  const tvl = parseFloat(formatUnits(totalAssets, 18))

  return {
    address: fund.vault as `0x${string}`,
    name: fund.name,
    symbol: fund.symbol,
    manager: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    performanceFeeRate: BigInt(fund.fee) * 10n ** 14n,
    highWaterMark: 10n ** 18n,
    totalAssets,
    totalSupply,
    totalActiveCapital: 0n,
    navPerShare: nav,
    performanceSinceInception: perf,
    tvlFormatted: tvl > 0 ? tvl.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0',
    deployedRatio: 0,
  }
}

export function FeaturedVault({ sourceId }: FeaturedVaultProps) {
  const [selectedVault, setSelectedVault] = useState<VaultInfo | null>(null)

  const funds = useMemo(
    () => (fundData as any).funds.filter((f: any) => f.source === sourceId && f.vault),
    [sourceId],
  )

  const vaultAddresses = funds.map((f: any) => f.vault as `0x${string}`).filter(Boolean)

  const calls = vaultAddresses.flatMap((addr: `0x${string}`) => [
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'totalAssets' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'totalSupply' as const, chainId: indexL3.id },
  ])

  const { data: results } = useReadContracts({
    contracts: calls as any,
    allowFailure: true,
    query: { enabled: vaultAddresses.length > 0 },
  })

  const sortedFunds = useMemo(() => {
    if (!results) return funds
    return [...funds].sort((a: any, b: any) => {
      const idxA = funds.indexOf(a)
      const idxB = funds.indexOf(b)
      const tvlA = results?.[idxA * 2]?.status === 'success' ? Number(results[idxA * 2].result as bigint) : 0
      const tvlB = results?.[idxB * 2]?.status === 'success' ? Number(results[idxB * 2].result as bigint) : 0
      return tvlB - tvlA
    })
  }, [funds, results])

  const getVaultData = (fund: any) => {
    const i = funds.indexOf(fund)
    const base = i * 2
    const totalAssets = results?.[base]?.status === 'success' ? (results[base].result as bigint) : 0n
    const totalSupply = results?.[base + 1]?.status === 'success' ? (results[base + 1].result as bigint) : 0n
    return buildVaultInfo(fund, totalAssets, totalSupply)
  }

  if (sortedFunds.length === 0) {
    return (
      <div className="border bg-terminal-dark border border-white/[0.06] p-8 text-center">
        <div className="text-[14px] font-black text-white/90 mb-2">No bots yet</div>
        <p className="text-[12px] text-white/40 mb-5">
          This source has no automated strategies. Be the first.
        </p>
        <Link
          href="/build-bot"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-none bg-white/[0.06] border border-white/[0.08] text-[12px] font-bold text-white/80 hover:bg-white/[0.1] hover:text-white transition-colors"
        >
          BUILD YOUR BOT
          <span className="text-[10px]">&rarr;</span>
        </Link>
      </div>
    )
  }

  const featured = sortedFunds[0]
  const rest = sortedFunds.slice(1)
  const featuredVault = getVaultData(featured)
  const tvl = parseFloat(formatUnits(featuredVault.totalAssets, 18))
  const perf = featuredVault.performanceSinceInception
  const perfColor = perf >= 0 ? 'text-color-up' : 'text-color-down'

  return (
    <div className="space-y-4">
      {/* Featured vault hero */}
      <div className="border bg-white border border-border-light p-6">
        <div className="text-[10px] font-bold tracking-[0.12em] text-text-muted uppercase mb-3">
          Top Performing Bot
        </div>

        <div className="flex items-start justify-between gap-6 mb-4">
          <div className="min-w-0">
            <h3 className="text-[20px] font-black leading-tight mb-1">
              {featured.name}
              <span className="ml-2 text-[11px] font-bold text-text-muted tracking-[0.06em]">
                {STRATEGY_LABELS[featured.strategy] ?? featured.strategy.toUpperCase()}
              </span>
            </h3>
            <p className="text-[12px] text-text-secondary leading-relaxed max-w-md">
              {featured.tagline}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <div className={`text-[28px] font-mono font-black leading-none ${perfColor}`}>
              {formatPerf(perf)}
            </div>
            <div className="text-[10px] text-text-muted mt-1">performance</div>
          </div>
        </div>

        <div className="flex items-center gap-6 mb-5">
          <div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">TVL</div>
            <div className="text-[15px] font-mono font-bold">{formatTvl(tvl)}</div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">Fee</div>
            <div className="text-[15px] font-mono font-bold">{(featured.fee / 100).toFixed(0)}%</div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setSelectedVault(featuredVault)}
            className="px-5 py-2 rounded-none bg-black text-white text-[12px] font-bold hover:bg-black/80 transition-colors"
          >
            DEPOSIT
          </button>
          <button className="px-5 py-2 rounded-none border border-border-light text-[12px] font-bold text-text-secondary hover:bg-black/[0.03] transition-colors">
            DETAILS
          </button>
        </div>

        {/* Provocation CTA */}
        <div className="rounded-none bg-terminal-dark p-4 flex items-center justify-between">
          <p className="text-[12px] text-white/70">
            Think you can beat <span className={`font-mono font-bold ${perf >= 0 ? 'text-color-up' : 'text-color-down'}`}>{formatPerf(perf)}</span>?
            {' '}Build your own strategy.
          </p>
          <Link
            href="/build-bot"
            className="shrink-0 ml-4 px-4 py-1.5 rounded-none bg-white/[0.06] border border-white/[0.08] text-[11px] font-bold text-white/80 hover:bg-white/[0.1] hover:text-white transition-colors"
          >
            START &rarr;
          </Link>
        </div>
      </div>

      {/* More vaults row */}
      {(rest.length > 0) && (
        <div>
          <h4 className="text-[11px] font-bold tracking-[0.1em] text-text-muted uppercase mb-3">
            More Bots on This Source
          </h4>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
            {rest.map((fund: any) => {
              const vault = getVaultData(fund)
              const vTvl = parseFloat(formatUnits(vault.totalAssets, 18))
              const vPerf = vault.performanceSinceInception
              const vPerfColor = vPerf >= 0 ? 'text-color-up' : 'text-color-down'

              return (
                <div
                  key={fund.symbol}
                  className="shrink-0 w-[200px] rounded-none border border-border-light bg-white p-4 flex flex-col"
                >
                  <div className="text-[13px] font-black leading-tight mb-0.5">{fund.name}</div>
                  <div className="text-[9px] font-bold text-text-muted tracking-[0.06em] mb-2">
                    {STRATEGY_LABELS[fund.strategy] ?? fund.strategy.toUpperCase()}
                  </div>
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className={`text-[16px] font-mono font-bold ${vPerfColor}`}>
                      {formatPerf(vPerf)}
                    </span>
                    <span className="text-[10px] font-mono text-text-muted">{formatTvl(vTvl)}</span>
                  </div>
                  <button
                    onClick={() => setSelectedVault(vault)}
                    className="mt-auto w-full py-1.5 rounded-none bg-black text-white text-[11px] font-bold hover:bg-black/80 transition-colors"
                  >
                    DEPOSIT
                  </button>
                </div>
              )
            })}

            {/* Create CTA card */}
            <div className="shrink-0 w-[200px] rounded-none border border-white/[0.06] bg-terminal-dark p-4 flex flex-col items-center justify-center text-center">
              <div className="text-[12px] font-bold text-white/80 leading-snug mb-3">
                You have an edge?<br />Prove it.
              </div>
              <Link
                href="/build-bot"
                className="px-4 py-1.5 rounded-none bg-white/[0.06] border border-white/[0.08] text-[11px] font-bold text-white/80 hover:bg-white/[0.1] hover:text-white transition-colors"
              >
                BUILD YOUR BOT
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Vault deposit/withdraw modal */}
      {selectedVault && (
        <VaultActions
          vaults={[{ fund: { name: selectedVault.name, strategy: '', tagline: '' }, vault: selectedVault }]}
          initialIndex={0}
          onClose={() => setSelectedVault(null)}
        />
      )}
    </div>
  )
}
