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
 * Render branches:
 *   - Loading (with known identity)  → identity card + reserved chart pulse + soft pills
 *   - Empty / SSE-down (after 5s)    → identity card + invitation to build a vault
 *   - Success                         → full hero with sparkline + stat pills + CTA
 *
 * The card never goes dark. It never shows three stacked bars. The slot's
 * height is stable across all branches so the layout doesn't lurch when data
 * lands.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import { Link } from '@/i18n/routing'
import fundData from '@/data/fund-branding.json'
import { useVaultsByAddresses } from '@/hooks/vaults/useVaults'
import { useVaultDisplayResolver } from '@/hooks/vaults/useVaultDisplay'
import { useSSEVisionVaults, useSSEUserVaultPositions } from '@/hooks/useSSE'
import { useVaultHistory } from '@/hooks/vaults/useVaultHistory'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'

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

/** Convert `rgb(R,G,B)` or `#rrggbb` to `rgba(...)` with a given alpha. */
function toRgba(color: string, alpha: number): string {
  const m = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i)
  if (m) return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    const hex = color.length === 4
      ? '#' + color.slice(1).split('').map(c => c + c).join('')
      : color
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  return color
}

/* ─── shared shell — keeps height + surface identical across branches ─ */

const CARD_CLASS = 'flex flex-col gap-5 p-6 rounded-[var(--apple-r-card)] border overflow-hidden'
const CARD_STYLE: React.CSSProperties = {
  borderColor: 'var(--apple-line)',
  background: 'var(--apple-panel)',
  minHeight: 360,
}

const CARD_LINK_CLASS = 'group flex flex-col gap-5 p-6 rounded-[var(--apple-r-card)] border overflow-hidden no-underline transition-[box-shadow,border-color] duration-200'
const CARD_LINK_STYLE: React.CSSProperties = {
  borderColor: 'var(--apple-line)',
  background: 'var(--apple-panel)',
  minHeight: 360,
  color: 'inherit',
  cursor: 'pointer',
}

const EYEBROW_STYLE: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 11,
  letterSpacing: 'var(--apple-track-loose)',
  color: 'var(--apple-text-tertiary)',
  fontWeight: 600,
  textTransform: 'uppercase',
  lineHeight: 1,
}

const HEADING_STYLE: React.CSSProperties = {
  fontFamily: 'var(--apple-font-display)',
  fontSize: 'var(--apple-fs-28)',
  letterSpacing: 'var(--apple-track-tighter)',
  lineHeight: 1.1428,
  fontWeight: 600,
  color: 'var(--apple-text)',
  marginBottom: 6,
}

const SUB_STYLE: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 'var(--apple-fs-17)',
  letterSpacing: 'var(--apple-track-tight)',
  lineHeight: 1.4706,
  color: 'var(--apple-text-secondary)',
  maxWidth: '40ch',
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
      // The stroke color arrives as `rgb(R,G,B)`; concatenating an alpha
      // suffix (`+ '20'`) yields `rgb(...)20`, which canvas refuses and
      // throws on, killing the entire card via the error boundary. Use
      // a proper rgba conversion so empty alpha never breaks the paint.
      gradient.addColorStop(0, toRgba(color, 0.12))
      gradient.addColorStop(1, toRgba(color, 0.02))
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

/* ─── chart placeholder — single soft surface, no stacked bars ─── */

function ChartPlaceholder({ pulse }: { pulse: boolean }) {
  return (
    <div
      className="w-full rounded-[var(--apple-r-sm)]"
      style={{
        height: 56,
        background: 'var(--apple-surface)',
        border: '1px solid var(--apple-line)',
        animation: pulse ? 'skeleton-shimmer 1.8s var(--ease-out) infinite' : undefined,
        backgroundImage: pulse
          ? 'linear-gradient(90deg, rgba(0,163,108,0.04) 0%, rgba(0,163,108,0.04) 33%, rgba(0,163,108,0.10) 50%, rgba(0,163,108,0.04) 67%, rgba(0,163,108,0.04) 100%)'
          : undefined,
        backgroundSize: pulse ? '200% 100%' : undefined,
      }}
      aria-hidden="true"
    />
  )
}

/* ─── stat pill ────────────────────────────────────────────────── */

function StatPill({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div
      className="flex flex-col gap-0.5 px-3 py-2 rounded-[var(--apple-r-sm)] border"
      style={{ borderColor: 'var(--apple-line)', background: 'var(--apple-surface)' }}
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

function StatPillGhost({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col gap-1 px-3 py-2 rounded-[var(--apple-r-sm)] border"
      style={{ borderColor: 'var(--apple-line)', background: 'var(--apple-surface)' }}
    >
      <span style={{ ...EYEBROW_STYLE, fontSize: 'var(--apple-fs-12)' }}>{label}</span>
      <span
        style={{
          display: 'inline-block',
          height: 14,
          width: 56,
          borderRadius: 4,
          background: 'rgba(0,0,0,0.06)',
        }}
      />
    </div>
  )
}

/* ─── identity header (used by all branches) ─────────────────── */

function IdentityHeader({
  eyebrow,
  title,
  sub,
  trailingPill,
}: {
  eyebrow: string
  title: string
  sub?: string
  trailingPill?: React.ReactNode
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="apple-pill apple-pill--external" style={{ textTransform: 'uppercase' }}>
          {eyebrow}
        </span>
        {trailingPill}
      </div>
      <div>
        <h2 style={HEADING_STYLE}>{title}</h2>
        {sub && <p style={SUB_STYLE}>{sub}</p>}
      </div>
    </>
  )
}

/* ─── loading state ─────────────────────────────────────────── */

function LoadingState({ sourceName }: { sourceName: string }) {
  return (
    <div className={CARD_CLASS} style={CARD_STYLE} aria-busy="true">
      <IdentityHeader
        eyebrow="featured vault"
        title={sourceName}
        sub="Live odds incoming."
      />
      <ChartPlaceholder pulse />
      <div className="flex flex-wrap gap-3">
        <StatPillGhost label="NAV" />
        <StatPillGhost label="all-time return" />
        <StatPillGhost label="TVL" />
      </div>
    </div>
  )
}

/* ─── empty state (also serves as SSE-down fallback after 5s) ── */

function EmptyState({ sourceName }: { sourceName: string }) {
  return (
    <div className={CARD_CLASS} style={CARD_STYLE}>
      <IdentityHeader
        eyebrow="featured vault"
        title="No vault has stepped forward yet."
        sub={`The slot is open. Whoever ships a strategy on ${sourceName} first lands here.`}
      />
      <ChartPlaceholder pulse={false} />
      <div>
        <Link
          href="/build-bot"
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
          Build a vault
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  )
}

/* ─── main component ────────────────────────────────────────────── */

interface FeaturedVaultHeroProps {
  sourceId: string
}

export function FeaturedVaultHero({ sourceId }: FeaturedVaultHeroProps) {
  const resolveDisplay = useVaultDisplayResolver()
  const { sources } = useSourceRegistry()

  // Source identity is known synchronously from registry (cached on mount via parent prefetch).
  // Fall back to a humanized sourceId so we never render an empty heading.
  const sourceName = useMemo(() => {
    const entry = findSource(sources, sourceId)
    if (entry?.name) return entry.name
    return sourceId.charAt(0).toUpperCase() + sourceId.slice(1)
  }, [sources, sourceId])

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

  // Resolve display vitals (wagmi preferred, SSE fallback). Returns null
  // when *neither* source has anything for this vault — the hero then falls
  // through to the empty-state branch instead of pretending NAV is $1.0000
  // and TVL is zero. Faking values reads as "vault is broken"; saying
  // nothing reads as "vault has yet to live."
  const display = useMemo(() => {
    if (!featuredFund) return null
    if (featuredVault && (featuredVault.totalAssets > 0n || featuredVault.totalSupply > 0n)) {
      return resolveDisplay(featuredVault)
    }
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
    // Chain returned a vault but every read was zero (or a partial read
    // succeeded for `name` but not the balance fields). That's not the same
    // as "no live data" — surface zeros only when the chain confirms them.
    if (featuredVault) return resolveDisplay(featuredVault)
    return null
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

  // Patience timer: if SSE is silent and chain is empty for 5s, show the empty state
  // instead of pulsing forever. Local dev hits this whenever data-node SSE returns 502.
  const [patienceExpired, setPatienceExpired] = useState(false)
  useEffect(() => {
    setPatienceExpired(false)
    const t = setTimeout(() => setPatienceExpired(true), 5000)
    return () => clearTimeout(t)
  }, [sourceId])

  const hasAnyData = Object.keys(chainByAddress).length > 0 || Object.keys(sseByAddress).length > 0
  const stillFetching = chainLoading && !hasAnyData

  // Branch 1: actively fetching, nothing in cache yet, give it 5s before bailing.
  if (stillFetching && !patienceExpired) {
    return <LoadingState sourceName={sourceName} />
  }

  // Branch 2: no fund mapped for this source, OR data never arrived.
  // Either way, the vault slot is empty — teach the user what it's for.
  if (!featuredFund || !display) {
    return <EmptyState sourceName={sourceName} />
  }

  // Branch 3: success.
  const isPositive = display.perf >= 0
  const sparklineColor = isPositive ? 'rgb(52,199,89)' : 'rgb(255,59,48)'

  const depositHref = `/source/${sourceId}/vault/${(vaultAddress ?? '').toLowerCase()}`

  return (
    <Link
      href={depositHref}
      aria-label={`Open ${featuredFund.name} vault`}
      className={`${CARD_LINK_CLASS} hero-card-link`}
      style={CARD_LINK_STYLE}
    >
      <IdentityHeader
        eyebrow="featured vault"
        title={featuredFund.name}
        sub={featuredFund.tagline}
        trailingPill={
          hasPosition ? (
            <span className="apple-pill apple-pill--anticheat">deposited</span>
          ) : undefined
        }
      />

      {/* sparkline — no per-trade markers; vaults can have 1000 fills/block */}
      {navData.length >= 2
        ? <Sparkline data={navData} color={sparklineColor} />
        : <ChartPlaceholder pulse={false} />}

      <div className="flex flex-wrap gap-3">
        <StatPill label="NAV" value={formatNav(display.nav)} />
        <StatPill
          label="all-time return"
          value={formatPerf(display.perf)}
          positive={isPositive}
        />
        <StatPill label="TVL" value={formatTvl(display.tvl)} />
      </div>

      <div>
        <span
          className="inline-flex items-center gap-1.5 rounded-[var(--apple-r-pill)] px-5 py-2.5 transition-colors"
          style={{
            background: 'var(--apple-accent)',
            color: '#fff',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-17)',
            letterSpacing: 'var(--apple-track-tight)',
            fontWeight: 600,
          }}
        >
          {hasPosition ? 'Manage position' : 'Deposit'}
          <span aria-hidden="true">→</span>
        </span>
      </div>

      <style jsx>{`
        :global(.hero-card-link:hover) {
          border-color: rgba(0, 0, 0, 0.18) !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
        }
      `}</style>
    </Link>
  )
}
