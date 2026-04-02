'use client'

import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { formatUnits } from 'viem'
import { useReadContracts } from 'wagmi'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { indexL3 } from '@/lib/wagmi'
import fundData from '@/data/fund-branding.json'
import { cn } from '@/lib/utils/cn'

interface VaultCarouselProps {
  sourceId: string
}

const STRATEGY_LABELS: Record<string, string> = {
  momentum: 'Momentum',
  contrarian: 'Contrarian',
  bullish: 'Bullish',
  bearish: 'Bearish',
  momentum_threshold: 'Selective',
  home_field: 'Home Field',
  regime: 'Regime',
  mean_reversion: 'Mean Reversion',
  adoption_curve: 'Adoption Curve',
  cluster: 'Cluster',
}

const STRATEGY_COLORS: Record<string, string> = {
  momentum: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
  contrarian: 'from-orange-500/20 to-orange-600/5 border-orange-500/20',
  bullish: 'from-green-500/20 to-green-600/5 border-green-500/20',
  bearish: 'from-red-500/20 to-red-600/5 border-red-500/20',
  momentum_threshold: 'from-purple-500/20 to-purple-600/5 border-purple-500/20',
  home_field: 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/20',
  regime: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/20',
  mean_reversion: 'from-pink-500/20 to-pink-600/5 border-pink-500/20',
  adoption_curve: 'from-teal-500/20 to-teal-600/5 border-teal-500/20',
  cluster: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/20',
}

export function VaultCarousel({ sourceId }: VaultCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

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

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll, funds.length])

  const scroll = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = dir === 'left' ? -300 : 300
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }, [])

  // Sort funds by TVL (AUM) descending
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

  return (
    <div className="mt-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-text-muted">
            Managed Vaults
          </h3>
          <span className="text-[11px] font-mono text-text-muted bg-black/[0.04] px-1.5 py-0.5 rounded">
            {funds.length}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="w-7 h-7 flex items-center justify-center rounded border border-border-light bg-white text-text-muted hover:text-black disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="w-7 h-7 flex items-center justify-center rounded border border-border-light bg-white text-text-muted hover:text-black disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Layout: scrollable vaults on left, CTA fixed on right */}
      <div className="flex gap-3">
        {/* Scrollable vault cards */}
        <div
          ref={scrollRef}
          className="flex-1 min-w-0 flex gap-3 overflow-x-auto scrollbar-none pb-1"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {sortedFunds.map((fund: any) => {
            const i = funds.indexOf(fund)
          const base = i * 2
          const totalAssets = results?.[base]?.status === 'success' ? (results[base].result as bigint) : 0n
          const totalSupply = results?.[base + 1]?.status === 'success' ? (results[base + 1].result as bigint) : 0n
          const nav = totalSupply > 0n ? Number(totalAssets) / Number(totalSupply) : 1.0
          const perf = nav - 1.0
          const tvl = parseFloat(formatUnits(totalAssets, 18))
          const gradientClass = STRATEGY_COLORS[fund.strategy] || 'from-gray-500/20 to-gray-600/5 border-gray-500/20'

          return (
            <div
              key={fund.symbol}
              className={cn(
                'shrink-0 w-[280px] rounded-lg border bg-gradient-to-br overflow-hidden',
                gradientClass,
              )}
              style={{ scrollSnapAlign: 'start' }}
            >
              <div className="h-1" style={{ backgroundColor: fund.color }} />

              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-[15px] font-black text-black leading-tight">
                      {fund.name}
                    </div>
                    <div className="text-[10px] font-mono text-text-muted mt-0.5">
                      {fund.symbol}
                    </div>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded bg-black/[0.06] text-text-secondary shrink-0 mt-0.5">
                    {STRATEGY_LABELS[fund.strategy] || fund.strategy}
                  </span>
                </div>

                <p className="text-[11px] text-text-secondary leading-[1.5] line-clamp-3 mb-3 min-h-[50px]">
                  {fund.tagline}
                </p>

                <div className="flex items-end justify-between pt-2 border-t border-black/[0.06]">
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-muted">TVL</div>
                    <div className="text-[14px] font-bold font-mono text-black tabular-nums">
                      ${tvl > 0 ? tvl.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-muted">Performance</div>
                    <div className={cn(
                      'text-[16px] font-black font-mono tabular-nums',
                      perf >= 0 ? 'text-green-600' : 'text-red-600',
                    )}>
                      {perf >= 0 ? '+' : ''}{(perf * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-muted">Fee</div>
                    <div className="text-[12px] font-mono text-text-secondary tabular-nums">
                      {fund.fee / 100}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        </div>

        {/* CTA card — fixed on right */}
        <div className="shrink-0 w-[240px] rounded-lg border border-dashed border-black/20 bg-gradient-to-br from-black/[0.03] to-black/[0.01] overflow-hidden flex flex-col hidden md:flex">
          <div className="flex-1 p-5 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-black/[0.06] flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <div className="text-[14px] font-black text-black leading-tight mb-1.5">
              Deploy Your Own Bot
            </div>
            <p className="text-[10px] text-text-muted leading-relaxed mb-4">
              Build a custom trading strategy with Claude Code. Deploys as a managed vault in minutes.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-black text-white text-[11px] font-bold">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Claude Code
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
