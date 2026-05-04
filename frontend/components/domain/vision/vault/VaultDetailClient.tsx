'use client'

/**
 * VaultDetailClient — orchestrates the hero, NAV chart, deposit panel, and
 * portfolio for a single vault page. The page.tsx is a server component
 * that wires AppShell + breadcrumb and hands data into here.
 *
 * Layout:
 *   1. Hero card     — identity, strategy pill, stat strip, "deposited" pill
 *   2. Two-column    — deposit panel (1/3) + NAV chart (rest)
 *   3. Portfolio     — existing VaultPortfolioView (asset fills)
 *
 * The hero deliberately has no chart. The real NavChart is rendered below.
 */

import { useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useVaultsByAddresses } from '@/hooks/vaults/useVaults'
import { useVaultDisplayResolver } from '@/hooks/vaults/useVaultDisplay'
import { useSSEVisionVault, useSSEUserVaultPosition } from '@/hooks/useSSE'
import { useVaultHistory, type VaultSnapshot, type VaultHistoryRange } from '@/hooks/vaults/useVaultHistory'
import { NavChart } from '@/components/domain/vaults/NavChart'
import { VaultActionsPanel } from './VaultActionsPanel'
import { VaultPortfolioView } from './VaultPortfolioView'

type FundEntry = {
  name: string
  symbol: string
  source: string
  strategy: string
  vault?: string
  tagline?: string
  color?: string
  fee?: number
  category?: string
}

interface Props {
  vaultAddress: `0x${string}`
  sourceId: string
  fund: FundEntry | null
  fallbackName: string
}

const STRATEGY_LABEL: Record<string, string> = {
  momentum: 'Momentum',
  contrarian: 'Contrarian',
  bullish: 'Bullish',
  bearish: 'Bearish',
  mean_reversion: 'Mean reversion',
  regime: 'Regime',
  cluster: 'Cluster',
  momentum_threshold: 'Selective momentum',
  time_of_day: 'Time of day',
  volatility_fade: 'Volatility fade',
  adoption_curve: 'Adoption curve',
  home_field: 'Home field',
}

const RANGE_LABELS: { key: '1d' | '1w' | '1m' | 'all'; label: string }[] = [
  { key: '1d', label: '1D' },
  { key: '1w', label: '1W' },
  { key: '1m', label: '1M' },
  { key: 'all', label: 'All' },
]

function formatTvl(tvl: number) {
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(1)}K`
  return `$${tvl.toFixed(0)}`
}

function formatPerf(perf: number) {
  const sign = perf >= 0 ? '+' : ''
  return `${sign}${(perf * 100).toFixed(2)}%`
}

export function VaultDetailClient({ vaultAddress, sourceId, fund, fallbackName }: Props) {
  const lower = vaultAddress.toLowerCase() as `0x${string}`
  const { vaults } = useVaultsByAddresses([lower])
  const vault = vaults[0]
  const resolveDisplay = useVaultDisplayResolver()

  const display = useMemo(() => {
    if (!vault) return null
    return resolveDisplay(vault)
  }, [vault, resolveDisplay])

  // SSE fallback: when the chain reads aren't back yet, paint NAV/TVL from
  // the data-node's broadcast so the hero never sits empty.
  const sseVault = useSSEVisionVault(lower)
  const sseDisplay = useMemo(() => {
    if (!sseVault) return null
    let assetsWei = 0n
    try { assetsWei = BigInt(sseVault.total_assets) } catch {}
    return {
      tvl: parseFloat(formatUnits(assetsWei, 18)),
      nav: sseVault.nav_per_share,
      perf: sseVault.nav_per_share - 1.0,
    }
  }, [sseVault])

  const effective = display ?? sseDisplay ?? { tvl: 0, nav: 1.0, perf: 0 }

  const userPos = useSSEUserVaultPosition(lower)
  const hasPosition = useMemo(() => {
    if (!userPos) return false
    try { if (BigInt(userPos.shares) > 0n) return true } catch {}
    try { if (BigInt(userPos.pending_deposit) > 0n) return true } catch {}
    return false
  }, [userPos])

  // ---- chart history --------------------------------------------------
  const [range, setRange] = useState<VaultHistoryRange>('1d')
  const { snapshots: rangeSnapshots } = useVaultHistory(lower, range)

  const liveTick: VaultSnapshot | null = useMemo(() => {
    if (!sseVault) return null
    let assetsWei = 0n
    try { assetsWei = BigInt(sseVault.total_assets) } catch { return null }
    return {
      nav: sseVault.nav_per_share,
      tvl: parseFloat(formatUnits(assetsWei, 18)),
      ts: Date.now(),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sseVault?.nav_per_share, sseVault?.total_assets])

  const chartSnapshots = useMemo(() => {
    if (!liveTick) return rangeSnapshots
    if (rangeSnapshots.length === 0) return [liveTick]
    const last = rangeSnapshots[rangeSnapshots.length - 1]
    if (liveTick.ts <= last.ts) return rangeSnapshots
    return [...rangeSnapshots, liveTick]
  }, [rangeSnapshots, liveTick])

  const navData = useMemo(() => chartSnapshots.map((s) => s.nav), [chartSnapshots])

  // ---- identity ------------------------------------------------------
  const vaultName = fund?.name ?? fallbackName
  const tagline = fund?.tagline ?? 'A managed strategy on the General settlement layer.'
  const strategyLabel = fund?.strategy ? (STRATEGY_LABEL[fund.strategy] ?? fund.strategy.replace(/_/g, ' ')) : null
  const feePercent = vault ? Number(vault.performanceFeeRate) / 1e16 : (fund?.fee ?? 0) / 100
  const isPositive = effective.perf >= 0

  return (
    <div className="flex flex-col gap-5">
      {/* HERO */}
      <VaultHeroCard
        eyebrow="Vault"
        strategyLabel={strategyLabel}
        title={vaultName}
        tagline={tagline}
        nav={effective.nav}
        perf={effective.perf}
        tvl={effective.tvl}
        feePercent={feePercent}
        isPositive={isPositive}
        hasPosition={hasPosition}
      />

      {/* TWO COLUMN: actions + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1">
          <VaultActionsPanel
            vaultAddress={lower}
            performanceFeeRate={vault?.performanceFeeRate ?? 0n}
            totalAssets={vault?.totalAssets ?? 0n}
            totalSupply={vault?.totalSupply ?? 0n}
          />
        </div>

        <div className="lg:col-span-2">
          <section
            aria-label="NAV history"
            style={{
              background: 'var(--apple-panel,#ffffff)',
              borderRadius: 'var(--apple-r-card,28px)',
              border: '1px solid var(--apple-line,rgba(0,0,0,0.08))',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              minHeight: 360,
            }}
          >
            <header className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-loose)',
                    textTransform: 'uppercase',
                    color: 'var(--apple-text-tertiary)',
                    margin: 0,
                  }}
                >
                  Nav history
                </p>
                <h2
                  style={{
                    fontFamily: 'var(--apple-font-display)',
                    fontSize: 'var(--apple-fs-21,21px)',
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-tighter)',
                    color: 'var(--apple-text)',
                    margin: '4px 0 0',
                  }}
                >
                  {`$${effective.nav.toFixed(4)}`}{' '}
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: isPositive ? 'rgb(52,199,89)' : 'rgb(255,59,48)',
                      letterSpacing: 'var(--apple-track-tight)',
                      marginLeft: 6,
                    }}
                  >
                    {formatPerf(effective.perf)}
                  </span>
                </h2>
              </div>

              <div
                role="tablist"
                style={{
                  display: 'inline-flex',
                  background: 'var(--apple-surface)',
                  borderRadius: 'var(--apple-r-pill,980px)',
                  padding: 3,
                  gap: 2,
                }}
              >
                {RANGE_LABELS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={range === key}
                    onClick={() => setRange(key)}
                    style={{
                      padding: '6px 14px',
                      background: range === key ? 'var(--apple-panel,#ffffff)' : 'transparent',
                      color: range === key ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
                      fontFamily: 'var(--apple-font-text)',
                      fontSize: 12,
                      fontWeight: 500,
                      letterSpacing: 'var(--apple-track-tight)',
                      border: 'none',
                      borderRadius: 'var(--apple-r-pill,980px)',
                      cursor: 'pointer',
                      boxShadow: range === key ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </header>

            <div style={{ flex: 1, minHeight: 240 }}>
              {navData.length >= 2 ? (
                <NavChart
                  data={navData}
                  vaultAddr={lower}
                  timestamps={chartSnapshots.map((s) => s.ts)}
                />
              ) : (
                <div
                  style={{
                    height: '100%',
                    minHeight: 240,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--apple-text-tertiary)',
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 13,
                  }}
                >
                  Awaiting first trade.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* PORTFOLIO */}
      <section
        aria-label="Portfolio"
        style={{
          background: 'var(--apple-panel,#ffffff)',
          borderRadius: 'var(--apple-r-card,28px)',
          border: '1px solid var(--apple-line,rgba(0,0,0,0.08))',
          overflow: 'hidden',
        }}
      >
        <VaultPortfolioView
          vaultAddress={vaultAddress}
          vaultName={vaultName}
          sourceId={sourceId}
          navPerShare={effective.nav}
          performanceSinceInception={effective.perf}
          tvlFormatted={
            parseFloat(
              formatUnits(vault?.totalAssets ?? 0n, 18),
            ).toLocaleString(undefined, { maximumFractionDigits: 2 })
          }
        />
      </section>
    </div>
  )
}

// ── Hero card ─────────────────────────────────────────────

function VaultHeroCard({
  eyebrow, strategyLabel, title, tagline,
  nav, perf, tvl, feePercent, isPositive,
  hasPosition,
}: {
  eyebrow: string
  strategyLabel: string | null
  title: string
  tagline: string
  nav: number
  perf: number
  tvl: number
  feePercent: number
  isPositive: boolean
  hasPosition: boolean
}) {
  return (
    <section
      aria-label="Vault summary"
      style={{
        background: 'var(--apple-panel,#ffffff)',
        borderRadius: 'var(--apple-r-card,28px)',
        border: '1px solid var(--apple-line,rgba(0,0,0,0.08))',
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="apple-pill apple-pill--external" style={{ textTransform: 'uppercase' }}>
          {eyebrow}
        </span>
        {strategyLabel ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: 'var(--apple-r-pill,980px)',
              border: '1px solid var(--apple-line,rgba(0,0,0,0.08))',
              background: 'var(--apple-surface)',
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-loose)',
              textTransform: 'uppercase',
              color: 'var(--apple-text-secondary)',
            }}
          >
            {strategyLabel}
          </span>
        ) : null}
        {hasPosition ? <span className="apple-pill apple-pill--anticheat">deposited</span> : null}
      </div>

      <div>
        <h1
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'clamp(28px, 3vw, 40px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tighter)',
            color: 'var(--apple-text)',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-17,17px)',
            color: 'var(--apple-text-secondary)',
            letterSpacing: 'var(--apple-track-tight)',
            lineHeight: 1.47,
            marginTop: 8,
            maxWidth: '60ch',
          }}
        >
          {tagline}
        </p>
      </div>

      {/* Stat strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        <Stat label="NAV" value={`$${nav.toFixed(4)}`} />
        <Stat
          label="All-time return"
          value={formatPerf(perf)}
          tone={isPositive ? 'up' : 'down'}
        />
        <Stat label="TVL" value={formatTvl(tvl)} />
        <Stat label="Performance fee" value={`${feePercent.toFixed(0)}%`} />
      </div>
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '12px 14px',
        background: 'var(--apple-surface)',
        borderRadius: 'var(--apple-r-md,12px)',
        border: '1px solid var(--apple-line,rgba(0,0,0,0.08))',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-loose)',
          textTransform: 'uppercase',
          color: 'var(--apple-text-tertiary)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-tight)',
          color:
            tone === 'up' ? 'rgb(52,199,89)'
            : tone === 'down' ? 'rgb(255,59,48)'
            : 'var(--apple-text)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

