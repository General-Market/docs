'use client'

import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { formatUnits } from 'viem'
import { useReadContracts } from '@/lib/wallet-shim'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { indexL3 } from '@/lib/wagmi'
import fundData from '@/data/fund-branding.json'
import { VaultCard } from '@/components/domain/vaults/VaultCard'
import { VaultActions } from '@/components/domain/vaults/VaultActions'
import type { VaultInfo } from '@/hooks/vaults/useVaults'

interface VaultCarouselProps {
  sourceId: string
}


export function VaultCarousel({ sourceId }: VaultCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
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
    <div>
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
            aria-label="Scroll left"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="w-7 h-7 flex items-center justify-center rounded border border-border-light bg-white text-text-muted hover:text-black disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            aria-label="Scroll right"
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

          const vaultInfo: VaultInfo = {
            address: fund.vault as `0x${string}`,
            name: fund.name,
            symbol: fund.symbol,
            manager: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            performanceFeeRate: BigInt(fund.fee) * 10n ** 14n,
            highWaterMark: 10n ** 18n,
            totalAssets: totalAssets,
            totalSupply: totalSupply,
            totalActiveCapital: 0n,
            navPerShare: nav,
            performanceSinceInception: perf,
            tvlFormatted: tvl > 0 ? tvl.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0',
            deployedRatio: 0,
          }

          return (
            <div key={fund.symbol} className="shrink-0 w-[240px]" style={{ scrollSnapAlign: 'start' }}>
              <VaultCard vault={vaultInfo} onClick={() => setSelectedVault(vaultInfo)} />
            </div>
          )
        })}
        </div>

        {/* CTA card, fixed on right */}
        <div className="shrink-0 w-[260px] hidden md:block relative">
          {/* Purple glow behind */}
          <div
            className="absolute inset-0 rounded-[20px] pointer-events-none"
            style={{ filter: 'blur(24px)', transform: 'scale(1.08)', opacity: 0.3, background: 'linear-gradient(-30deg, #6348dd, transparent 40%, transparent 60%, #6348dd)' }}
          />
          <div className="relative rounded-[20px] bg-terminal-dark border border-[#6348dd]/20 h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <div className="text-[14px] font-black text-white/90 leading-tight mb-1.5">
              Create a Strategy
            </div>
            <p className="text-[10px] text-white/30 leading-relaxed mb-5">
              Build your own automated trading strategy. Goes live in minutes, others can deposit into it.
            </p>
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[11px] font-bold text-white/80 hover:bg-white/[0.1] hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Get Started
            </button>
          </div>
        </div>
      </div>

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
