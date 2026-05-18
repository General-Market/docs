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
import { useVaultStats } from '@/hooks/vaults/useVaultStats'
import { NavChart } from '@/components/domain/vaults/NavChart'
import { VaultActionsPanel } from './VaultActionsPanel'
import { VaultRoundHistory } from './VaultRoundHistory'
import sourcesDisplay from '@/data/sources-display.json'

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

const ALL_RANGES: { key: '1d' | '1w' | '1m' | 'all'; label: string; minTickSecs: number }[] = [
  // Each range needs at least ~6 NAV points to draw something useful. A daily-tick
  // vault has 1 point per day, so '1d' shows a single dot — useless. Filter ranges
  // by tick: 1d needs tick ≤ 4h, 1w needs tick ≤ 1d.
  { key: '1d', label: '1D', minTickSecs: 14_400 },
  { key: '1w', label: '1W', minTickSecs: 86_400 },
  { key: '1m', label: '1M', minTickSecs: 604_800 },
  { key: 'all', label: 'All', minTickSecs: Infinity },
]

function rangesForTick(tickSecs: number): { key: '1d' | '1w' | '1m' | 'all'; label: string }[] {
  const useable = ALL_RANGES.filter(r => tickSecs <= r.minTickSecs)
  const fallback = { key: 'all' as const, label: 'All' }
  return useable.length > 0
    ? useable.map(r => ({ key: r.key, label: r.label }))
    : [fallback]
}

function formatTick(secs: number): string {
  if (secs <= 0) return '—'
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.round(secs / 60)}m`
  if (secs < 86400) return `${Math.round(secs / 3600)}h`
  if (secs < 604800) return `${Math.round(secs / 86400)}d`
  if (secs < 2592000) return `${Math.round(secs / 604800)}w`
  return `${Math.round(secs / 2592000)}mo`
}

function lookupTickSecs(sourceId: string): number {
  const reg = (sourcesDisplay as { sources?: Array<{ sourceId: string; internalIds?: string[]; syncIntervalSecs?: number }> }).sources ?? []
  const found = reg.find(s => s.sourceId === sourceId || s.internalIds?.includes(sourceId))
  return found?.syncIntervalSecs ?? 600
}

function formatTvl(tvl: number) {
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(1)}K`
  return `$${tvl.toFixed(0)}`
}

function formatPerf(perf: number) {
  const sign = perf >= 0 ? '+' : ''
  return `${sign}${(perf * 100).toFixed(2)}%`
}

// Mark-to-market NAV reads are noise between resolutions: outcome-token
// prices wobble, orderbooks print thin trades, and one bad tick survives in
// `vault_snapshots` forever. Risk metrics on that series describe the
// spread, not the strategy. We compute them server-side from realized
// trade returns instead — see `/api/vision/vault/[address]/stats`.

// Median-of-3 spike filter for the chart line. Display only — the
// underlying snapshots stay intact in the API and the database.
function medianFilter(values: number[]): number[] {
  if (values.length < 3) return values.slice()
  const out = [values[0]!]
  for (let i = 1; i < values.length - 1; i++) {
    const a = values[i - 1]!
    const b = values[i]!
    const c = values[i + 1]!
    // Sorting a tiny array beats a hand-rolled median ladder for clarity.
    out.push([a, b, c].sort((x, y) => x - y)[1]!)
  }
  out.push(values[values.length - 1]!)
  return out
}

function computePerfForPeriod(snapshots: VaultSnapshot[], hoursAgo: number): number | null {
  if (snapshots.length < 2) return null
  const cutoff = Date.now() - hoursAgo * 3600 * 1000
  const last = snapshots[snapshots.length - 1]
  // If the whole vault is younger than the requested window, the honest
  // answer is "—". Falling back to inception made 24H/7D/30D all read the
  // same +0.06% on a 9-hour-old vault.
  if (snapshots[0].ts > cutoff) return null
  let closest = snapshots[0]
  let closestDist = Math.abs(closest.ts - cutoff)
  for (const s of snapshots) {
    const d = Math.abs(s.ts - cutoff)
    if (d < closestDist) { closest = s; closestDist = d }
  }
  if (closest.nav === 0 || closest === last) return null
  return (last.nav - closest.nav) / closest.nav
}

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  const pct = v * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

function fmtRatio(v: number | null): string {
  if (v === null) return '—'
  return v.toFixed(2)
}

function fmtUsd(v: number | null): string {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}$${Math.abs(v).toFixed(2)}`
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
  // Restrict the range buttons to ones that produce a usable density of points
  // for this source's tick. A 1d-tick vault has ~1 point per day — '1D' shows
  // a single dot, so we drop it.
  const tickSecs = useMemo(() => lookupTickSecs(sourceId), [sourceId])
  const rangeOptions = useMemo(() => rangesForTick(tickSecs), [tickSecs])
  const defaultRange: VaultHistoryRange = rangeOptions[0]?.key ?? '1d'
  const [range, setRange] = useState<VaultHistoryRange>(defaultRange)
  // If the tick changes (different vault) and the current range is no longer
  // valid, snap back to the first allowed range. Avoids stale '1D' selection
  // on a daily vault.
  useMemo(() => {
    if (!rangeOptions.find(r => r.key === range)) setRange(defaultRange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickSecs])
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

  // Median-of-3 strips the lone-tick spikes (one bad mark-to-market read
  // surrounded by clean ticks) from the chart line without rewriting any
  // historical row. Endpoints pass through unchanged.
  const navData = useMemo(
    () => medianFilter(chartSnapshots.map(s => s.nav)),
    [chartSnapshots],
  )

  // ---- inception-wide history for period stats ----------------------
  // Performance windows (24H/7D/30D) still walk the raw snapshot ledger —
  // we want the actual NAV-then vs NAV-now, not a filtered approximation.
  const { snapshots: allSnapshots } = useVaultHistory(lower, 'all')
  const fullSnapshots = useMemo(() => {
    if (!liveTick) return allSnapshots
    if (allSnapshots.length === 0) return [liveTick]
    const last = allSnapshots[allSnapshots.length - 1]
    if (liveTick.ts <= last.ts) return allSnapshots
    return [...allSnapshots, liveTick]
  }, [allSnapshots, liveTick])
  const perf24h = useMemo(() => computePerfForPeriod(fullSnapshots, 24), [fullSnapshots])
  const perf7d = useMemo(() => computePerfForPeriod(fullSnapshots, 168), [fullSnapshots])
  const perf30d = useMemo(() => computePerfForPeriod(fullSnapshots, 720), [fullSnapshots])

  // Trading stats — win rate, avg win/loss, trade count, and the trade-level
  // risk metrics (Sharpe/Sortino/Vol/MaxDD). The server emits null below
  // `minTradesForRisk`; the panel renders "—" in that case.
  const { stats } = useVaultStats(lower)
  const winRatePct = stats?.winRate != null ? stats.winRate * 100 : null
  const avgWin = stats?.avgWin ?? null
  const avgLoss = stats?.avgLoss ?? null
  const trades = stats?.trades ?? 0
  const sharpe = stats?.sharpe ?? null
  const sortino = stats?.sortino ?? null
  const vol = stats?.volatility ?? null
  const maxDd = stats?.maxDrawdown ?? null

  // ---- identity ------------------------------------------------------
  const vaultName = fund?.name ?? fallbackName
  const tagline = fund?.tagline ?? 'A managed strategy on the General settlement layer.'
  const strategyLabel = fund?.strategy ? (STRATEGY_LABEL[fund.strategy] ?? fund.strategy.replace(/_/g, ' ')) : null
  const feePercent = vault ? Number(vault.performanceFeeRate) / 1e16 : (fund?.fee ?? 0) / 100
  const isPositive = effective.perf >= 0
  const deployedPct = vault ? Math.round(vault.deployedRatio * 100) : 0
  const totalShares = vault && vault.totalSupply > 0n
    ? Number(formatUnits(vault.totalSupply, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : '0'
  const highWaterMark = vault
    ? parseFloat(formatUnits(vault.highWaterMark, 18))
    : 1.0
  const category = fund?.category ?? '—'

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
        roundLabel={formatTick(tickSecs)}
      />

      {/* INVESTMENT THESIS */}
      <ThesisCard tagline={tagline} />

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
                {rangeOptions.map(({ key, label }) => (
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

      {/* PERFORMANCE GRID */}
      <PerformanceCard
        perf24h={perf24h}
        perf7d={perf7d}
        perf30d={perf30d}
        perfInception={effective.perf}
        winRatePct={winRatePct}
        avgWin={avgWin}
        avgLoss={avgLoss}
        trades={trades}
      />

      {/* RISK + ALLOCATION + FEES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <RiskCard sharpe={sharpe} sortino={sortino} vol={vol} maxDd={maxDd} />
        <AllocationCard deployedPct={deployedPct} totalShares={totalShares} />
        <FeesCard
          feePercent={feePercent}
          highWaterMark={highWaterMark}
        />
      </div>

      {/* META STRIP */}
      <MetaStrip
        sourceId={sourceId}
        category={category}
        contractAddress={lower}
      />

      {/* ROUND HISTORY — chain-truth from PlayerJoined/Settled events. */}
      <section
        aria-label="Round history"
        style={{
          background: 'var(--apple-panel,#ffffff)',
          borderRadius: 'var(--apple-r-card,28px)',
          border: '1px solid var(--apple-line,rgba(0,0,0,0.08))',
          overflow: 'hidden',
        }}
      >
        <VaultRoundHistory vaultAddress={lower} />
      </section>
    </div>
  )
}

// ── Hero card ─────────────────────────────────────────────

function VaultHeroCard({
  eyebrow, strategyLabel, title, tagline,
  nav, perf, tvl, feePercent, isPositive,
  hasPosition, roundLabel,
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
  roundLabel: string
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
        <Stat label="Round" value={roundLabel} />
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

// ── Section primitives ───────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--apple-panel,#ffffff)',
  borderRadius: 'var(--apple-r-card,28px)',
  border: '1px solid var(--apple-line,rgba(0,0,0,0.08))',
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-loose)',
  textTransform: 'uppercase',
  color: 'var(--apple-text-tertiary)',
  margin: 0,
}

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--apple-font-display)',
  fontSize: 'var(--apple-fs-21,21px)',
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-tighter)',
  color: 'var(--apple-text)',
  margin: '4px 0 0',
}

function CardHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header>
      <p style={eyebrowStyle}>{eyebrow}</p>
      <h2 style={sectionTitleStyle}>{title}</h2>
    </header>
  )
}

// ── Investment Thesis ───────────────────────────────────

function ThesisCard({ tagline }: { tagline: string }) {
  return (
    <section aria-label="Investment thesis" style={cardStyle}>
      <CardHeader eyebrow="Thesis" title="What this vault is trying to do" />
      <p
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-17,17px)',
          lineHeight: 1.47,
          letterSpacing: 'var(--apple-track-tight)',
          color: 'var(--apple-text-secondary)',
          margin: 0,
          maxWidth: '70ch',
        }}
      >
        {tagline}
      </p>
    </section>
  )
}

// ── Performance grid ────────────────────────────────────

function PerformanceCard({
  perf24h, perf7d, perf30d, perfInception,
  winRatePct, avgWin, avgLoss, trades,
}: {
  perf24h: number | null
  perf7d: number | null
  perf30d: number | null
  perfInception: number
  winRatePct: number | null
  avgWin: number | null
  avgLoss: number | null
  trades: number
}) {
  const cells: { label: string; value: string; tone?: 'up' | 'down' }[] = [
    { label: '24h', value: fmtPct(perf24h), tone: perf24h !== null ? (perf24h >= 0 ? 'up' : 'down') : undefined },
    { label: '7d',  value: fmtPct(perf7d),  tone: perf7d  !== null ? (perf7d  >= 0 ? 'up' : 'down') : undefined },
    { label: '30d', value: fmtPct(perf30d), tone: perf30d !== null ? (perf30d >= 0 ? 'up' : 'down') : undefined },
    { label: 'Inception', value: fmtPct(perfInception), tone: perfInception >= 0 ? 'up' : 'down' },
    { label: 'Win rate', value: winRatePct != null ? `${winRatePct.toFixed(0)}%` : '—' },
    { label: 'Avg win',  value: fmtUsd(avgWin),  tone: avgWin  != null && avgWin  >= 0 ? 'up' : undefined },
    { label: 'Avg loss', value: fmtUsd(avgLoss), tone: avgLoss != null && avgLoss <  0 ? 'down' : undefined },
    { label: 'Trades',   value: trades > 0 ? String(trades) : '—' },
  ]
  return (
    <section aria-label="Performance" style={cardStyle}>
      <CardHeader eyebrow="Performance" title="Returns and trading" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        {cells.map(({ label, value, tone }) => (
          <Stat key={label} label={label} value={value} tone={tone} />
        ))}
      </div>
    </section>
  )
}

// ── Risk metrics ────────────────────────────────────────

function RiskCard({
  sharpe, sortino, vol, maxDd,
}: {
  sharpe: number | null
  sortino: number | null
  vol: number | null
  maxDd: number | null
}) {
  const cells: { label: string; value: string; tone?: 'up' | 'down' }[] = [
    { label: 'Sharpe',   value: fmtRatio(sharpe) },
    { label: 'Sortino',  value: fmtRatio(sortino) },
    { label: 'Volatility', value: vol !== null ? `${(vol * 100).toFixed(1)}%` : '—' },
    { label: 'Max drawdown', value: maxDd !== null ? `${(maxDd * 100).toFixed(1)}%` : '—', tone: maxDd !== null ? 'down' : undefined },
  ]
  return (
    <section aria-label="Risk" style={cardStyle}>
      <CardHeader eyebrow="Risk" title="What it costs to hold" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
        }}
      >
        {cells.map(({ label, value, tone }) => (
          <Stat key={label} label={label} value={value} tone={tone} />
        ))}
      </div>
    </section>
  )
}

// ── Capital allocation ──────────────────────────────────

function AllocationCard({ deployedPct, totalShares }: { deployedPct: number; totalShares: string }) {
  const idle = Math.max(0, 100 - deployedPct)
  return (
    <section aria-label="Capital allocation" style={cardStyle}>
      <CardHeader eyebrow="Allocation" title="Where the capital sits" />
      <div
        style={{
          display: 'flex',
          height: 6,
          borderRadius: 'var(--apple-r-pill,980px)',
          overflow: 'hidden',
          background: 'var(--apple-surface)',
        }}
      >
        <div style={{ width: `${deployedPct}%`, background: 'rgb(52,199,89)' }} />
        <div style={{ width: `${idle}%`, background: 'var(--apple-line)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <AllocRow color="rgb(52,199,89)" label="Deployed" value={`${deployedPct}%`} />
        <AllocRow color="var(--apple-text-tertiary)" label="Idle" value={`${idle}%`} />
        <AllocRow color="transparent" label="Shares outstanding" value={totalShares} />
      </div>
    </section>
  )
}

function AllocRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {color !== 'transparent' ? (
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: color,
              flexShrink: 0,
            }}
          />
        ) : (
          <span aria-hidden style={{ width: 8 }} />
        )}
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            color: 'var(--apple-text-secondary)',
            letterSpacing: 'var(--apple-track-tight)',
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--apple-text)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: 'var(--apple-track-tight)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Fee structure ───────────────────────────────────────

function FeesCard({ feePercent, highWaterMark }: { feePercent: number; highWaterMark: number }) {
  return (
    <section aria-label="Fees" style={cardStyle}>
      <CardHeader eyebrow="Fees" title="What the manager keeps" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FeeRow label="Performance fee" value={`${feePercent.toFixed(0)}%`} />
        <FeeRow label="Management fee"  value="0%" />
        <FeeRow label="High water mark" value={`$${highWaterMark.toFixed(4)}`} tone="up" />
      </div>
      <p
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 12,
          color: 'var(--apple-text-tertiary)',
          letterSpacing: 'var(--apple-track-mid)',
          margin: 0,
          marginTop: 4,
        }}
      >
        Fees apply only on gains above the high water mark. No lock-up.
      </p>
    </section>
  )
}

function FeeRow({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 13,
          color: 'var(--apple-text-secondary)',
          letterSpacing: 'var(--apple-track-tight)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 14,
          fontWeight: 600,
          color:
            tone === 'up' ? 'rgb(52,199,89)'
            : tone === 'down' ? 'rgb(255,59,48)'
            : 'var(--apple-text)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: 'var(--apple-track-tight)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Meta strip ──────────────────────────────────────────

function MetaStrip({
  sourceId, category, contractAddress,
}: {
  sourceId: string
  category: string
  contractAddress: string
}) {
  const short = `${contractAddress.slice(0, 6)}…${contractAddress.slice(-4)}`
  return (
    <section
      aria-label="Vault metadata"
      style={{
        background: 'var(--apple-surface)',
        borderRadius: 'var(--apple-r-card,28px)',
        border: '1px solid var(--apple-line,rgba(0,0,0,0.08))',
        padding: '14px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px 28px',
      }}
    >
      <MetaItem label="Source"   value={sourceId} />
      <MetaItem label="Category" value={category} />
      <MetaItem label="Contract" value={short} mono />
    </section>
  )
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
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
          fontFamily: mono ? 'var(--apple-font-mono, ui-monospace, SFMono-Regular, monospace)' : 'var(--apple-font-text)',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--apple-text)',
          letterSpacing: 'var(--apple-track-tight)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

