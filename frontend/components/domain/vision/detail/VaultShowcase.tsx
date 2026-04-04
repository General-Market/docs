'use client'

import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { formatUnits } from 'viem'
import { useReadContracts } from 'wagmi'
import { motion, useReducedMotion } from 'framer-motion'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { indexL3 } from '@/lib/wagmi'
import fundData from '@/data/fund-branding.json'
import { VaultActions } from '@/components/domain/vaults/VaultActions'
import { useVaultHistory } from '@/hooks/vaults/useVaultHistory'
import type { VaultInfo } from '@/hooks/vaults/useVaults'
import { cn } from '@/lib/utils/cn'

const STRATEGY_META: Record<string, { label: string; color: string }> = {
  momentum:           { label: 'MOMENTUM',   color: '#10b981' },
  contrarian:         { label: 'CONTRARIAN',  color: '#f43f5e' },
  adoption_curve:     { label: 'ADOPTION',    color: '#8b5cf6' },
  cluster:            { label: 'CLUSTER',     color: '#06b6d4' },
  regime:             { label: 'REGIME',      color: '#f59e0b' },
  mean_reversion:     { label: 'MEAN REV',    color: '#8b5cf6' },
  bullish:            { label: 'BULLISH',     color: '#0ea5e9' },
  bearish:            { label: 'BEARISH',     color: '#ef4444' },
  momentum_threshold: { label: 'SELECTIVE',   color: '#10b981' },
  time_of_day:        { label: 'TIME',        color: '#f97316' },
  volatility_fade:    { label: 'VOL FADE',    color: '#71717a' },
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

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

/* ─────────────────────────────────────────────
   Sparkline — Canvas, responsive width
   ───────────────────────────────────────────── */

function Sparkline({ data, height, color, className }: {
  data: number[]
  height: number
  color: string
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas || data.length < 2) return

    const draw = () => {
      const width = container.clientWidth
      const ctx = canvas.getContext('2d')
      if (!ctx || width === 0) return

      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      const min = Math.min(...data)
      const max = Math.max(...data)
      const range = max - min || 1
      const padY = height * 0.12

      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      let lastX = 0, lastY = 0
      data.forEach((v, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - padY - ((v - min) / range) * (height - padY * 2)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        lastX = x
        lastY = y
      })
      ctx.stroke()

      // gradient fill
      ctx.lineTo(lastX, height)
      ctx.lineTo(0, height)
      ctx.closePath()
      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      gradient.addColorStop(0, color + '20')
      gradient.addColorStop(1, color + '05')
      ctx.fillStyle = gradient
      ctx.fill()
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(container)
    return () => observer.disconnect()
  }, [data, height, color])

  if (data.length < 2) return null

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} />
    </div>
  )
}

/* ─────────────────────────────────────────────
   CountUp — animates a number on scroll-in
   ───────────────────────────────────────────── */

function useCountUp(target: number, duration = 1200, skip = false) {
  const [value, setValue] = useState(skip ? target : 0)
  const ref = useRef<HTMLDivElement>(null)
  const hasRun = useRef(false)

  useEffect(() => {
    if (skip) { setValue(target); return }
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRun.current) {
          hasRun.current = true
          const start = performance.now()
          const animate = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setValue(target * eased)
            if (progress < 1) requestAnimationFrame(animate)
            else setValue(target)
          }
          requestAnimationFrame(animate)
          observer.unobserve(el)
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, duration, skip])

  return { ref, value }
}

/* ─────────────────────────────────────────────
   Featured Vault — the hero
   ───────────────────────────────────────────── */

function FeaturedHero({ fund, vault, brandColor, onDeposit }: {
  fund: any
  vault: VaultInfo
  brandColor: string
  onDeposit: () => void
}) {
  const reduced = !!useReducedMotion()
  const tvl = parseFloat(formatUnits(vault.totalAssets, 18))
  const perf = vault.performanceSinceInception
  const perfAbs = Math.abs(perf * 100)
  const isPositive = perf >= 0
  const strategy = STRATEGY_META[fund.strategy]

  const { ref: countRef, value: countValue } = useCountUp(perfAbs, 1400, reduced)

  const { snapshots } = useVaultHistory(vault.address)
  const navData = useMemo(() => snapshots.map(s => s.nav), [snapshots])

  return (
    <div className="relative">
      {/* ambient glow — outer */}
      <div
        className="absolute -inset-6 rounded-3xl pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 50% at 30% 50%, ${brandColor}12, transparent 60%)`,
          filter: 'blur(50px)',
        }}
      />
      {/* ambient glow — inner */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${brandColor}1a, transparent 70%)`,
          filter: 'blur(30px)',
          transform: 'scale(1.1)',
        }}
      />

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
        className="relative rounded-2xl bg-terminal-dark border border-white/[0.08] overflow-hidden"
      >
        {/* strategy accent line */}
        <div
          className="h-[2px]"
          style={{ background: `linear-gradient(90deg, ${strategy?.color ?? brandColor}, transparent 70%)` }}
        />

        <div className="p-6 sm:p-8">
          {/* label row */}
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] font-bold tracking-[0.14em] text-white/35 uppercase">
              Featured Vault
            </span>
            {strategy && (
              <span
                className="text-[9px] font-bold tracking-[0.1em] px-2 py-0.5 rounded-full uppercase"
                style={{ backgroundColor: strategy.color + '18', color: strategy.color }}
              >
                {strategy.label}
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            {/* left column — name, tagline, stats, CTA */}
            <div className="min-w-0 flex-1">
              <h3 className="text-[22px] sm:text-[26px] font-black text-white leading-tight mb-2">
                {fund.name}
              </h3>
              <p className="text-[12px] text-white/35 leading-relaxed max-w-md mb-6">
                {fund.tagline}
              </p>

              <div className="flex items-center gap-6 mb-6">
                <div>
                  <div className="text-[9px] font-bold tracking-[0.12em] text-white/25 uppercase mb-0.5">TVL</div>
                  <div className="text-[16px] font-mono font-bold text-white/90">{formatTvl(tvl)}</div>
                </div>
                <div className="w-px h-8 bg-white/[0.06]" />
                <div>
                  <div className="text-[9px] font-bold tracking-[0.12em] text-white/25 uppercase mb-0.5">Fee</div>
                  <div className="text-[16px] font-mono font-bold text-white/90">{(fund.fee / 100).toFixed(0)}%</div>
                </div>
                <div className="w-px h-8 bg-white/[0.06]" />
                <div>
                  <div className="text-[9px] font-bold tracking-[0.12em] text-white/25 uppercase mb-0.5">NAV</div>
                  <div className="text-[16px] font-mono font-bold text-white/90">${vault.navPerShare.toFixed(4)}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onDeposit}
                  className="px-6 py-2.5 bg-white text-black text-[12px] font-black tracking-[0.04em] rounded-lg hover:bg-white/90 transition-colors"
                >
                  DEPOSIT
                </button>
                <button
                  onClick={onDeposit}
                  className="px-5 py-2.5 border border-white/[0.1] text-[12px] font-bold text-white/50 rounded-lg hover:border-white/20 hover:text-white/80 transition-colors"
                >
                  DETAILS
                </button>
              </div>
            </div>

            {/* right column — performance + sparkline */}
            <div className="shrink-0 sm:text-right">
              <div ref={countRef}>
                <span className={cn(
                  'text-[36px] sm:text-[44px] font-mono font-black leading-none tabular-nums',
                  isPositive ? 'text-color-up' : 'text-color-down',
                )}>
                  {isPositive ? '+' : '-'}{countValue.toFixed(2)}%
                </span>
              </div>
              <div className="text-[10px] text-white/25 mt-1.5 tracking-[0.06em]">since inception</div>

              <Sparkline
                data={navData}
                height={52}
                color={isPositive ? '#16A34A' : '#DC2626'}
                className="mt-4 w-full sm:w-[200px] sm:ml-auto"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Vault Tilt Card — 3D perspective hover
   ───────────────────────────────────────────── */

function VaultTiltCard({ fund, vault, index, onDeposit }: {
  fund: any
  vault: VaultInfo
  index: number
  onDeposit: () => void
}) {
  const reduced = !!useReducedMotion()
  const [transform, setTransform] = useState('')

  const tvl = parseFloat(formatUnits(vault.totalAssets, 18))
  const perf = vault.performanceSinceInception
  const isPositive = perf >= 0
  const strategy = STRATEGY_META[fund.strategy]

  const { snapshots } = useVaultHistory(vault.address)
  const navData = useMemo(() => snapshots.map(s => s.nav), [snapshots])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setTransform(`perspective(800px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) scale(1.02)`)
  }, [reduced])

  const onMouseLeave = useCallback(() => setTransform(''), [])

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 + index * 0.08, ease: EASE_OUT_EXPO }}
    >
      <div
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onDeposit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDeposit() } }}
        className="group relative rounded-xl border border-border-light bg-white cursor-pointer overflow-hidden transition-shadow duration-300 hover:shadow-lg"
        style={{
          transform: transform || undefined,
          transition: transform
            ? 'transform 0.08s ease-out'
            : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: transform ? 'transform' : undefined,
        }}
      >
        {/* strategy accent */}
        <div className="h-[2px]" style={{ backgroundColor: strategy?.color ?? '#9146FF' }} />

        <div className="p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-black text-[14px] text-text-primary leading-tight truncate">
              {fund.name}
            </span>
            {strategy && (
              <span
                className="shrink-0 text-[8px] font-bold tracking-[0.08em] px-1.5 py-0.5 rounded-full uppercase whitespace-nowrap"
                style={{ backgroundColor: strategy.color + '14', color: strategy.color }}
              >
                {strategy.label}
              </span>
            )}
          </div>

          <p className="text-[10px] text-text-muted leading-snug mb-3 line-clamp-2">
            {fund.tagline}
          </p>

          <Sparkline
            data={navData}
            height={36}
            color={isPositive ? '#16A34A' : '#DC2626'}
            className="mb-3"
          />

          <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
            <div>
              <div className="text-[8px] font-bold tracking-[0.08em] text-text-muted uppercase">TVL</div>
              <div className="font-bold text-text-primary">{formatTvl(tvl)}</div>
            </div>
            <div className="text-right">
              <div className="text-[8px] font-bold tracking-[0.08em] text-text-muted uppercase">Perf</div>
              <div className={cn('font-bold', isPositive ? 'text-color-up' : 'text-color-down')}>
                {formatPerf(perf)}
              </div>
            </div>
          </div>

          {/* deposit — reveals on hover */}
          <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button className="w-full py-1.5 bg-black text-white text-[10px] font-bold rounded-md hover:bg-black/80 transition-colors">
              DEPOSIT
            </button>
          </div>
        </div>

        {/* hover glow ring */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl"
          style={{ boxShadow: `inset 0 0 0 1px ${strategy?.color ?? '#9146FF'}25, 0 0 24px ${strategy?.color ?? '#9146FF'}0a` }}
        />
      </div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   VaultShowcase — orchestrator
   ───────────────────────────────────────────── */

interface VaultShowcaseProps {
  sourceId: string
}

export function VaultShowcase({ sourceId }: VaultShowcaseProps) {
  const reduced = !!useReducedMotion()
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

  const getVaultData = useCallback((fund: any) => {
    const i = funds.indexOf(fund)
    const base = i * 2
    const totalAssets = results?.[base]?.status === 'success' ? (results[base].result as bigint) : 0n
    const totalSupply = results?.[base + 1]?.status === 'success' ? (results[base + 1].result as bigint) : 0n
    return buildVaultInfo(fund, totalAssets, totalSupply)
  }, [funds, results])

  if (sortedFunds.length === 0) return null

  const featured = sortedFunds[0]
  const rest = sortedFunds.slice(1)
  const brandColor = featured.color || '#9146FF'

  return (
    <div className="space-y-6">
      <FeaturedHero
        fund={featured}
        vault={getVaultData(featured)}
        brandColor={brandColor}
        onDeposit={() => setSelectedVault(getVaultData(featured))}
      />

      {rest.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[11px] font-bold tracking-[0.1em] text-text-muted uppercase">
              More Strategies
            </h4>
            <span className="text-[10px] font-mono text-text-muted">
              {rest.length} vault{rest.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map((fund: any, i: number) => (
              <VaultTiltCard
                key={fund.symbol}
                fund={fund}
                vault={getVaultData(fund)}
                index={i}
                onDeposit={() => setSelectedVault(getVaultData(fund))}
              />
            ))}

            {/* create strategy CTA */}
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 + rest.length * 0.08, ease: EASE_OUT_EXPO }}
            >
              <div className="relative rounded-xl bg-terminal-dark border border-white/[0.06] h-full flex flex-col items-center justify-center text-center p-6 min-h-[200px]">
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                  <svg className="w-4.5 h-4.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </div>
                <div className="text-[14px] font-black text-white/80 leading-tight mb-1.5">
                  Build Your Own
                </div>
                <p className="text-[10px] text-white/25 leading-relaxed mb-4 max-w-[200px]">
                  Automated strategy. Live in minutes. Others deposit into it.
                </p>
                <button className="px-5 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[11px] font-bold text-white/60 hover:bg-white/[0.1] hover:text-white transition-colors">
                  CREATE STRATEGY
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {selectedVault && (
        <VaultActions
          vault={selectedVault}
          onClose={() => setSelectedVault(null)}
        />
      )}
    </div>
  )
}
