'use client'

/**
 * FeaturedVaultHero — Apple-style hero for the source detail page.
 *
 * Data derivation: no `useFeaturedVault` hook exists. We read from
 * `fund-branding.json` (the canonical source→vault map, same as VaultShowcase)
 * and from `useVaultsByAddresses` + SSE to get live NAV/TVL. The vault with
 * the highest `totalAssets` is featured. This mirrors VaultShowcase's sorting
 * logic exactly so both surfaces always agree on which vault is "featured".
 *
 * Depositor count: not available in the current SSE schema (`VisionVaultSSE`)
 * or the wagmi multicall (no `balanceOf` enumeration on the vault contract).
 * We omit the depositor pill rather than show a stale or fabricated number.
 * When the data-node exposes a `holder_count` field, add it to VisionVaultSSE
 * and read it here.
 *
 * Sparkline: uses the same canvas-based sparkline from VaultShowcase. No per-
 * trade markers — vaults can have 1000 fills per block; dots would be noise.
 */

import { useEffect, useMemo, useRef } from 'react'
import { formatUnits } from 'viem'
import { Link } from '@/i18n/routing'
import fundData from '@/data/fund-branding.json'
import { useVaultsByAddresses } from '@/hooks/vaults/useVaults'
import { useVaultDisplayResolver } from '@/hooks/vaults/useVaultDisplay'
import { useSSEVisionVaults, useSSEUserVaultPositions } from '@/hooks/useSSE'
import { useVaultHistory } from '@/hooks/vaults/useVaultHistory'
import { cn } from '@/lib/utils/cn'

/* ─── helpers ─────────────────────────────────────────────────── */

function formatNav(nav: number) {
  return `$${nav.toFixed(4)}`
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

function safeBigInt(v: string | undefined): bigint {
  if (!v) return 0n
  try { return BigInt(v) } catch { return 0n }
}

/* ─── sparkline ────────────────────────────────────────────────── */

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const HEIGHT = 56

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
      canvas.height = HEIGHT * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${HEIGHT}px`
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, HEIGHT)

      const min = Math.min(...data)
      const max = Math.max(...data)
      const range = max - min || 1
      const padY = HEIGHT * 0.1

      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      let lastX = 0, lastY = 0
      data.forEach((v, i) => {
        const x = (i / (data.length - 1)) * width
        const y = HEIGHT - padY - ((v - min) / range) * (HEIGHT - padY * 2)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        lastX = x
        lastY = y
      })
      ctx.stroke()

      ctx.lineTo(lastX, HEIGHT)
      ctx.lineTo(0, HEIGHT)
      ctx.closePath()
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT)
      gradient.addColorStop(0, color + '20')
      gradient.addColorStop(1, color + '05')
      ctx.fillStyle = gradient
      ctx.fill()
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(container)
    return () => observer.disconnect()
  }, [data, color])

  if (data.length < 2) return null

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} />
    </div>
  )
}

/* ─── stat pill ────────────────────────────────────────────────── */

function StatPill({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div
      className="flex flex-col gap-0.5 px-3 py-2 rounded-[var(--apple-r-sm)] border"
      style={{ borderColor: 'var(--apple-border)', background: 'var(--apple-surface)' }}
    >
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-12)',
          letterSpacing: 'var(--apple-track-loose)',
          color: 'var(--apple-text-tertiary)',
          lineHeight: 1,
          fontWeight: 600,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-17)',
          letterSpacing: 'var(--apple-track-tight)',
          color:
            positive === true
              ? 'rgb(52,199,89)'
              : positive === false
              ? 'rgb(255,59,48)'
              : 'var(--apple-text)',
          fontWeight: 600,
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
    </div>
  )
}

/* ─── skeleton ─────────────────────────────────────────────────── */

function FeaturedVaultHeroSkeleton() {
  return (
    <div
      className="flex flex-col gap-5 p-6 rounded-[var(--apple-r-card)] border"
      style={{ borderColor: 'var(--apple-border)', background: 'var(--apple-panel)' }}
      aria-hidden="true"
    >
      <div className="space-y-2">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-7 w-48 rounded" />
        <div className="skeleton h-4 w-full max-w-sm rounded" />
      </div>
      <div className="skeleton h-14 w-full rounded" />
      <div className="flex gap-3">
        <div className="skeleton h-14 w-24 rounded-[var(--apple-r-sm)]" />
        <div className="skeleton h-14 w-24 rounded-[var(--apple-r-sm)]" />
      </div>
      <div className="skeleton h-10 w-28 rounded-[var(--apple-r-pill)]" />
    </div>
  )
}

/* ─── main component ────────────────────────────────────────────── */

interface FeaturedVaultHeroProps {
  sourceId: string
}

export function FeaturedVaultHero({ sourceId }: FeaturedVaultHeroProps) {
  const resolveDisplay = useVaultDisplayResolver()

  // All funds for this source from the canonical branding manifest.
  const funds = useMemo(
    () => (fundData as any).funds.filter((f: any) => f.source === sourceId && f.vault),
    [sourceId],
  )

  const fundAddresses = useMemo(
    () => funds.map((f: any) => (f.vault as string).toLowerCase() as `0x${string}`),
    [funds],
  )

  const { vaults: chainVaults, isLoading: chainLoading } = useVaultsByAddresses(fundAddresses)
  const sseVaults = useSSEVisionVaults()
  const sseUserPositions = useSSEUserVaultPositions()

  // Build SSE lookup by address for NAV fallback.
  const sseByAddress = useMemo(() => {
    const map: Record<string, typeof sseVaults[number]> = {}
    for (const v of sseVaults) map[v.address.toLowerCase()] = v
    return map
  }, [sseVaults])

  // Build chain vault lookup.
  const chainByAddress = useMemo(() => {
    const map: Record<string, typeof chainVaults[number]> = {}
    for (const v of chainVaults) map[v.address.toLowerCase()] = v
    return map
  }, [chainVaults])

  // Determine the featured vault: largest totalAssets. Mirrors VaultShowcase.
  const featuredFund = useMemo(() => {
    if (funds.length === 0) return null
    return [...funds].sort((a: any, b: any) => {
      const keyA = (a.vault as string).toLowerCase()
      const keyB = (b.vault as string).toLowerCase()
      const assA = chainByAddress[keyA]?.totalAssets ?? safeBigInt(sseByAddress[keyA]?.total_assets)
      const assB = chainByAddress[keyB]?.totalAssets ?? safeBigInt(sseByAddress[keyB]?.total_assets)
      return assB > assA ? 1 : assB < assA ? -1 : 0
    })[0]
  }, [funds, chainByAddress, sseByAddress])

  const featuredVault = useMemo(() => {
    if (!featuredFund) return null
    const key = (featuredFund.vault as string).toLowerCase()
    return chainByAddress[key] ?? null
  }, [featuredFund, chainByAddress])

  // Resolve display vitals (wagmi preferred, SSE fallback).
  const display = useMemo(() => {
    if (!featuredVault) {
      if (!featuredFund) return null
      const key = (featuredFund.vault as string).toLowerCase()
      const sse = sseByAddress[key]
      if (sse) {
        let assets = 0n
        try { assets = BigInt(sse.total_assets) } catch {}
        return {
          tvl: parseFloat(formatUnits(assets, 18)),
          nav: sse.nav_per_share,
          perf: sse.nav_per_share - 1.0,
        }
      }
      return { tvl: 0, nav: 1.0, perf: 0 }
    }
    return resolveDisplay(featuredVault)
  }, [featuredVault, featuredFund, sseByAddress, resolveDisplay])

  const vaultAddress = featuredFund?.vault as string | undefined

  // History for sparkline.
  const { snapshots } = useVaultHistory(vaultAddress ?? '')
  const navData = useMemo(() => snapshots.map(s => s.nav), [snapshots])

  // User position: does the wallet hold shares in the featured vault?
  const userPosition = useMemo(() => {
    if (!vaultAddress) return null
    return sseUserPositions[vaultAddress.toLowerCase()] ?? null
  }, [vaultAddress, sseUserPositions])

  const hasPosition = !!userPosition &&
    (safeBigInt(userPosition.shares) > 0n || safeBigInt(userPosition.pending_deposit) > 0n)

  // Show skeleton during initial load when there's no SSE fallback either.
  const hasAnyData = Object.keys(chainByAddress).length > 0 || Object.keys(sseByAddress).length > 0
  if (chainLoading && !hasAnyData) {
    return <FeaturedVaultHeroSkeleton />
  }

  if (!featuredFund || !display) return null

  const isPositive = display.perf >= 0
  const perfColor = isPositive ? 'rgb(52,199,89)' : 'rgb(255,59,48)'
  const sparklineColor = isPositive ? 'rgb(52,199,89)' : 'rgb(255,59,48)'

  const depositHref = `/source/${sourceId}/vault/${(vaultAddress ?? '').toLowerCase()}`

  return (
    <div
      className="flex flex-col gap-5 p-6 rounded-[var(--apple-r-card)] border overflow-hidden"
      style={{ borderColor: 'var(--apple-border)', background: 'var(--apple-panel)' }}
    >
      {/* label row */}
      <div className="flex items-center gap-2">
        <span
          className="apple-pill apple-pill--external"
          style={{ textTransform: 'uppercase' }}
        >
          featured vault
        </span>
        {hasPosition && (
          <span className="apple-pill apple-pill--anticheat">
            deposited
          </span>
        )}
      </div>

      {/* title + tagline */}
      <div>
        <h2
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'var(--apple-fs-28)',
            letterSpacing: 'var(--apple-track-tighter)',
            lineHeight: 1.1428,
            fontWeight: 600,
            color: 'var(--apple-text)',
            marginBottom: '6px',
          }}
        >
          {featuredFund.name}
        </h2>
        {featuredFund.tagline && (
          <p
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 'var(--apple-fs-17)',
              letterSpacing: 'var(--apple-track-tight)',
              lineHeight: 1.4706,
              color: 'var(--apple-text-secondary)',
              maxWidth: '40ch',
            }}
          >
            {featuredFund.tagline}
          </p>
        )}
      </div>

      {/* sparkline — no per-trade markers; see file header */}
      {navData.length >= 2 && (
        <Sparkline data={navData} color={sparklineColor} />
      )}

      {/* stat pills */}
      <div className="flex flex-wrap gap-3">
        <StatPill label="NAV" value={formatNav(display.nav)} />
        <StatPill
          label="all-time return"
          value={formatPerf(display.perf)}
          positive={isPositive}
        />
        <StatPill label="TVL" value={formatTvl(display.tvl)} />
      </div>

      {/* CTA */}
      <div>
        <Link
          href={depositHref}
          className="inline-flex items-center gap-1.5 rounded-[var(--apple-r-pill)] px-5 py-2.5 transition-colors"
          style={{
            background: 'var(--apple-accent)',
            color: '#fff',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-17)',
            letterSpacing: 'var(--apple-track-tight)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Deposit
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  )
}
