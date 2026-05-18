'use client'

import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { formatUnits } from 'viem'
import { motion, useReducedMotion } from 'framer-motion'
import fundData from '@/data/fund-branding.json'
import { Link } from '@/i18n/routing'
import { useVaultHistory } from '@/hooks/vaults/useVaultHistory'
import { useVaultDisplayResolver } from '@/hooks/vaults/useVaultDisplay'
import { useSSEVisionVaults, useSSEUserVaultPositions } from '@/hooks/useSSE'
import { useVaultsByAddresses, type VaultInfo } from '@/hooks/vaults/useVaults'
import { Sparkline } from '@/components/domain/home/Sparkline'
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

function safeBigInt(v: string | undefined): bigint {
  if (!v) return 0n
  try { return BigInt(v) } catch { return 0n }
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

interface UserPosition {
  shares: bigint
  pending: bigint
}

function computeUserValue(pos: UserPosition | undefined, vault: VaultInfo): number {
  if (!pos) return 0
  const sharesValue =
    vault.totalSupply > 0n && pos.shares > 0n
      ? (Number(pos.shares) / Number(vault.totalSupply)) *
        parseFloat(formatUnits(vault.totalAssets, 18))
      : 0
  const pendingValue = pos.pending > 0n ? parseFloat(formatUnits(pos.pending, 18)) : 0
  return sharesValue + pendingValue
}

/* ─────────────────────────────────────────────
   CountUp, animates a number on scroll-in
   ───────────────────────────────────────────── */

function useCountUp(target: number, duration = 1200, skip = false) {
  const [value, setValue] = useState(skip ? target : 0)
  const ref = useRef<HTMLDivElement>(null)
  const hasRevealed = useRef(false)
  // Mirror the displayed value in a ref so the animation can read the
  // current displayed value as its starting point — even if the React
  // state hasn't reflected the latest tween frame yet.
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    if (skip) { setValue(target); return }
    const el = ref.current
    if (!el) return

    let cancelled = false
    let raf = 0

    const runAnimation = () => {
      const startValue = valueRef.current
      const start = performance.now()
      const animate = (now: number) => {
        if (cancelled) return
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(startValue + (target - startValue) * eased)
        if (progress < 1) raf = requestAnimationFrame(animate)
        else setValue(target)
      }
      raf = requestAnimationFrame(animate)
    }

    // Already-revealed path: re-animate from current value to the new
    // target. This is the path that fires when wagmi data arrives after
    // the first paint and the headline number needs to update.
    if (hasRevealed.current) {
      runAnimation()
      return () => { cancelled = true; cancelAnimationFrame(raf) }
    }

    // First-reveal path: gate the initial count-up on intersection so the
    // animation plays when the user scrolls the element into view.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRevealed.current) {
          hasRevealed.current = true
          runAnimation()
          observer.unobserve(el)
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [target, duration, skip])

  return { ref, value }
}


/* ─────────────────────────────────────────────
   Vault Card — Apple register. The old 3D tilt
   was retired: it read as theatrical against the
   featured hero. A soft shadow-lift earns more.
   ───────────────────────────────────────────── */

function VaultTiltCard({ fund, vault, index, userPosition, href }: {
  fund: any
  vault: VaultInfo
  index: number
  userPosition?: UserPosition
  href: string
}) {
  const reduced = !!useReducedMotion()

  const resolveDisplay = useVaultDisplayResolver()
  const display = resolveDisplay(vault)
  const tvl = display.tvl
  const perf = display.perf
  const isPositive = perf >= 0
  const strategy = STRATEGY_META[fund.strategy]

  const userValue = computeUserValue(userPosition, vault)
  const hasPosition = !!userPosition && (userPosition.shares > 0n || userPosition.pending > 0n)
  const pendingOnly = hasPosition && userPosition!.shares === 0n && userPosition!.pending > 0n

  // Match the vault detail page's '1d' default so the source-card sparkline
  // and the deep-page chart trace the same curve. The 'all' range returns a
  // handful of sparse points the spline rounds into a synthetic shape.
  const { snapshots } = useVaultHistory(vault.address, '1d')
  const navData = useMemo(() => snapshots.map(s => s.nav), [snapshots])
  // Perf-driven hue. Apple system green for up, system red for down.
  // Black-on-everything was the previous default — three identical strokes
  // read as templated. Honest colour reads as alive.
  const sparkColor = isPositive ? 'rgb(52,199,89)' : 'rgb(255,59,48)'

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 + index * 0.08, ease: EASE_OUT_EXPO }}
    >
      <Link
        href={href}
        aria-label={`Open ${fund.name} vault`}
        className="vault-apple-card group relative block cursor-pointer overflow-hidden no-underline"
        style={{ color: 'inherit' }}
      >
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span
              className="truncate"
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: '-0.016em',
                lineHeight: 1.2105,
                color: 'var(--apple-text)',
              }}
            >
              {fund.name}
            </span>
            {strategy && (
              <span
                className="shrink-0 whitespace-nowrap"
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-loose)',
                  textTransform: 'uppercase',
                  background: 'var(--apple-surface)',
                  color: 'var(--apple-text-tertiary)',
                  padding: '2px 8px',
                  borderRadius: 999,
                }}
              >
                {strategy.label}
              </span>
            )}
          </div>

          <p
            className="line-clamp-2 mb-4"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              letterSpacing: '-0.005em',
              lineHeight: 1.3846,
              color: 'var(--apple-text-secondary)',
            }}
          >
            {fund.tagline}
          </p>

          {/* Real NAV history from useVaultHistory. Render nothing when the
              series is too short to draw — a fake curve where there is no
              history reads as broken trust. */}
          {navData.length >= 2 && (
            <div className="mb-4" style={{ height: 36 }}>
              <Sparkline
                series={navData}
                width={320}
                height={36}
                stroke={sparkColor}
              />
            </div>
          )}

          <div className="flex items-end justify-between gap-4">
            <div>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-loose)',
                  textTransform: 'uppercase',
                  color: 'var(--apple-text-tertiary)',
                  marginBottom: 2,
                }}
              >
                TVL
              </div>
              <div
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: '-0.016em',
                  color: 'var(--apple-text)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatTvl(tvl)}
              </div>
            </div>
            <div className="text-right">
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-loose)',
                  textTransform: 'uppercase',
                  color: 'var(--apple-text-tertiary)',
                  marginBottom: 2,
                }}
              >
                Perf
              </div>
              <div
                className={cn(isPositive ? 'text-color-up' : 'text-color-down')}
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: '-0.016em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatPerf(perf)}
              </div>
            </div>
          </div>

          {hasPosition && (
            <div
              className="mt-4 pt-3 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--apple-line)' }}
            >
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-loose)',
                  textTransform: 'uppercase',
                  color: 'var(--apple-text-tertiary)',
                }}
              >
                {pendingOnly ? 'Pending' : 'Your position'}
              </div>
              <div
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '-0.016em',
                  color: 'var(--apple-text)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ${userValue.toFixed(2)}
              </div>
            </div>
          )}

          <div
            className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              letterSpacing: '-0.005em',
              color: 'var(--apple-accent)',
              fontWeight: 500,
            }}
          >
            {hasPosition ? 'Manage →' : 'Open vault →'}
          </div>
        </div>

        <style jsx>{`
          .vault-apple-card {
            background: var(--apple-panel, #ffffff);
            border: 1px solid var(--apple-line, rgba(0, 0, 0, 0.08));
            border-radius: var(--apple-r-md, 12px);
            transition:
              transform 240ms cubic-bezier(0.4, 0, 0.6, 1),
              box-shadow 240ms cubic-bezier(0.4, 0, 0.6, 1),
              border-color 240ms cubic-bezier(0.4, 0, 0.6, 1);
          }
          .vault-apple-card:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
            border-color: rgba(0, 0, 0, 0.16);
          }
        `}</style>
      </Link>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   Loading panel — one Apple-toned card, no grid.
   Three identical placeholders read as broken;
   one reads as patient.
   ───────────────────────────────────────────── */

function VaultShowcaseLoading() {
  return (
    <section aria-hidden="true">
      <header className="mb-5 flex items-baseline gap-3">
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-loose)',
            color: 'var(--apple-text-tertiary)',
            textTransform: 'uppercase',
          }}
        >
          for you
        </span>
        <h2
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'var(--apple-fs-28)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tighter)',
            color: 'var(--apple-text)',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Vaults
        </h2>
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-14)',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text-secondary)',
          }}
        >
          Loading vaults…
        </span>
      </header>
      <div
        className="border p-6 sm:p-8"
        style={{
          background: 'var(--apple-panel)',
          borderColor: 'var(--apple-line)',
          borderRadius: 'var(--apple-r-card)',
        }}
      >
        <div className="flex flex-col gap-5">
          <span className="skeleton block h-[20px] w-2/5 rounded" />
          <span className="skeleton block h-[12px] w-3/5 rounded" />
          <div className="flex items-end justify-between gap-6">
            <div className="flex items-center gap-6">
              <div>
                <span className="skeleton block h-[9px] w-10 rounded mb-1.5" />
                <span className="skeleton block h-[16px] w-16 rounded" />
              </div>
              <div>
                <span className="skeleton block h-[9px] w-10 rounded mb-1.5" />
                <span className="skeleton block h-[16px] w-16 rounded" />
              </div>
            </div>
            <span className="skeleton block h-[36px] w-32 rounded" />
          </div>
        </div>
      </div>
    </section>
  )
}


/* ─────────────────────────────────────────────
   VaultShowcase, orchestrator
   ───────────────────────────────────────────── */

interface VaultShowcaseProps {
  sourceId: string
}

export function VaultShowcase({ sourceId }: VaultShowcaseProps) {
  // Patience timer: wagmi's multicall hook can keep `isLoading` true through
  // an internal retry loop when the RPC returns 4xx/5xx. Without a bound,
  // the user stares at "Loading vaults…" forever. After 5s, render whatever
  // arrived (even nothing) — fund-branding gives names; zero balances are
  // honest until a number contradicts them.
  const [patienceExpired, setPatienceExpired] = useState(false)
  useEffect(() => {
    setPatienceExpired(false)
    const t = setTimeout(() => setPatienceExpired(true), 5000)
    return () => clearTimeout(t)
  }, [sourceId])

  const funds = useMemo(
    () => (fundData as any).funds.filter((f: any) => f.source === sourceId && f.vault),
    [sourceId],
  )

  // Read the source's vaults directly by address — fund-branding.json is the
  // canonical (source → vault) map, so we don't need to round-trip through
  // VisionVaultFactory.getAllVaults() here. Bypassing the factory also means
  // a stale or unregistered vault still renders correct stats: the factory
  // address in deployment.json was empty on L3 at one point and silently
  // turned every TVL/Perf into $0 / +0.00%. SSE remains a fallback inside
  // useVaultDisplayResolver for the cold-paint window.
  const fundAddresses = useMemo(
    () => funds.map((f: any) => f.vault.toLowerCase() as `0x${string}`),
    [funds],
  )
  const { vaults: chainVaults, isLoading: chainLoading } = useVaultsByAddresses(fundAddresses)
  const vaultPositions = useSSEUserVaultPositions()
  const visionVaults = useSSEVisionVaults()

  // Wagmi vault info indexed by lowercased address.
  const chainVaultByAddress = useMemo(() => {
    const map: Record<string, VaultInfo> = {}
    for (const v of chainVaults) map[v.address.toLowerCase()] = v
    return map
  }, [chainVaults])

  // SSE fallback snapshots — only used when wagmi hasn't returned yet.
  const sseVaultByAddress = useMemo(() => {
    const map: Record<string, { totalAssets: bigint; totalSupply: bigint }> = {}
    for (const v of visionVaults) {
      map[v.address.toLowerCase()] = {
        totalAssets: safeBigInt(v.total_assets),
        totalSupply: safeBigInt(v.total_supply),
      }
    }
    return map
  }, [visionVaults])

  const getUserPosition = useCallback(
    (addr: `0x${string}`): UserPosition | undefined => {
      const entry = vaultPositions[addr.toLowerCase()]
      if (!entry) return undefined
      return {
        shares: safeBigInt(entry.shares),
        pending: safeBigInt(entry.pending_deposit),
      }
    },
    [vaultPositions],
  )

  const getVaultData = useCallback((fund: any): VaultInfo => {
    const key = (fund.vault as string).toLowerCase()
    const chain = chainVaultByAddress[key]
    if (chain) return chain
    const sse = sseVaultByAddress[key]
    if (sse) return buildVaultInfo(fund, sse.totalAssets, sse.totalSupply)
    return buildVaultInfo(fund, 0n, 0n)
  }, [chainVaultByAddress, sseVaultByAddress])

  // Active = the address answered on-chain and reports at least some supply
  // or assets, OR SSE has a non-zero snapshot. A branded entry that no
  // contract backs is just decoration — keep it out of the carousel.
  const activeFunds = useMemo(() => {
    return funds.filter((f: any) => {
      const key = (f.vault as string).toLowerCase()
      const chain = chainVaultByAddress[key]
      if (chain && (chain.totalAssets > 0n || chain.totalSupply > 0n)) return true
      const sse = sseVaultByAddress[key]
      if (sse && (sse.totalAssets > 0n || sse.totalSupply > 0n)) return true
      return false
    })
  }, [funds, chainVaultByAddress, sseVaultByAddress])

  const sortedFunds = useMemo(() => {
    return [...activeFunds].sort((a: any, b: any) => {
      const aKey = (a.vault as string).toLowerCase()
      const bKey = (b.vault as string).toLowerCase()
      const tvlA = chainVaultByAddress[aKey]?.totalAssets
        ?? sseVaultByAddress[aKey]?.totalAssets
        ?? 0n
      const tvlB = chainVaultByAddress[bKey]?.totalAssets
        ?? sseVaultByAddress[bKey]?.totalAssets
        ?? 0n
      return tvlB > tvlA ? 1 : tvlB < tvlA ? -1 : 0
    })
  }, [activeFunds, chainVaultByAddress, sseVaultByAddress])

  // Empty: this source has no vaults registered. Return null so the parent's
  // `[&:has(>div:empty)]:hidden` hack on SourceDetailV2 hides the wrapper. A
  // section with no vaults is best left silent — three placeholder cards say
  // less than nothing.
  if (sortedFunds.length === 0) return null

  const rest = sortedFunds.slice(1)

  // Loading: chain reads still pending and SSE returned nothing. Paint a
  // single Apple-toned panel rather than a 3-up grid of placeholders. Three
  // identical cards read as templated; one reads as patient. Bound it: the
  // patience timer expires after 5s so a hung RPC doesn't strand the user
  // in front of a forever-skeleton.
  const hasAnyVaultData =
    Object.keys(chainVaultByAddress).length > 0 || Object.keys(sseVaultByAddress).length > 0
  if (chainLoading && !hasAnyVaultData && !patienceExpired) {
    return <VaultShowcaseLoading />
  }

  // The featured vault renders in the page-level FeaturedVaultHero (Apple shell).
  // VaultShowcase carries the rest. If there is no rest, return null so the
  // parent's `:has(>div:empty)` collapses the wrapper.
  if (rest.length === 0) return null

  return (
    <div className="space-y-6">
      {rest.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <h4
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-loose)',
                color: 'var(--apple-text-tertiary)',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              More strategies
            </h4>
            <span
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 12,
                color: 'var(--apple-text-tertiary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {rest.length} vault{rest.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Mobile: horizontal carousel showing 2 cards at a time (snap-scroll).
              Desktop (sm+): reverts to a normal responsive grid. */}
          <div
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible sm:pb-0"
            style={{ scrollbarWidth: 'none' }}
          >
            {rest.map((fund: any, i: number) => (
              <div
                key={fund.symbol}
                className="shrink-0 basis-[calc(50%-0.5rem)] snap-start sm:basis-auto sm:shrink"
              >
                <VaultTiltCard
                  fund={fund}
                  vault={getVaultData(fund)}
                  index={i}
                  userPosition={getUserPosition(fund.vault)}
                  href={`/source/${sourceId}/vault/${(fund.vault as string).toLowerCase()}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
