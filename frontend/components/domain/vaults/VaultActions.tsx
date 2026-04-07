'use client'

import { useState, useMemo, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { formatUnits, parseUnits } from 'viem'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils/cn'
import { useVaultDeposit } from '@/hooks/vaults/useVaultDeposit'
import { useVaultRedeem } from '@/hooks/vaults/useVaultRedeem'
import { useFundBranding } from '@/hooks/vaults/useFundBranding'
import { useVaultHistory, type VaultSnapshot } from '@/hooks/vaults/useVaultHistory'
import { useSSEUserVaultPosition } from '@/hooks/useSSE'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { SpringBackdrop, SpringModal, glass } from '@/components/ui/spring'
import { NavChart, generateNavHistory } from './NavChart'
import type { VaultInfo } from '@/hooks/vaults/useVaults'

// ── Strategy colors ───────────────────────────────────────

const STRATEGY_COLOR: Record<string, string> = {
  momentum: '#059669',
  contrarian: '#e11d48',
  bullish: '#0284c7',
  bearish: '#dc2626',
  mean_reversion: '#7c3aed',
  regime: '#d97706',
  cluster: '#0891b2',
  momentum_threshold: '#059669',
  time_of_day: '#ea580c',
  volatility_fade: '#71717a',
  adoption_curve: '#7c3aed',
}

// ── Helpers ───────────────────────────────────────────────

function formatTvlCompact(tvl: number) {
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(1)}K`
  return `$${tvl.toFixed(0)}`
}

function computeMaxDrawdown(navs: number[]): number | null {
  if (navs.length < 2) return null
  let peak = navs[0]
  let maxDd = 0
  for (const nav of navs) {
    if (nav > peak) peak = nav
    const dd = (peak - nav) / peak
    if (dd > maxDd) maxDd = dd
  }
  return maxDd > 0 ? -maxDd : null
}

function computeVolatility(navs: number[]): number | null {
  if (navs.length < 3) return null
  const returns: number[] = []
  for (let i = 1; i < navs.length; i++) {
    returns.push((navs[i] - navs[i - 1]) / navs[i - 1])
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length
  return Math.sqrt(variance) * Math.sqrt(252)
}

function computeSharpe(navs: number[]): number | null {
  if (navs.length < 5) return null
  const returns: number[] = []
  for (let i = 1; i < navs.length; i++) {
    returns.push((navs[i] - navs[i - 1]) / navs[i - 1])
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length
  const std = Math.sqrt(variance)
  if (std === 0) return null
  return (mean / std) * Math.sqrt(252)
}

function computeSortino(navs: number[]): number | null {
  if (navs.length < 5) return null
  const returns: number[] = []
  for (let i = 1; i < navs.length; i++) {
    returns.push((navs[i] - navs[i - 1]) / navs[i - 1])
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const downside = returns.filter(r => r < 0)
  if (downside.length === 0) return null
  const downsideVar = downside.reduce((a, r) => a + r * r, 0) / downside.length
  const downsideStd = Math.sqrt(downsideVar)
  if (downsideStd === 0) return null
  return (mean / downsideStd) * Math.sqrt(252)
}

function computePerfForPeriod(snapshots: VaultSnapshot[], hoursAgo: number): number | null {
  if (snapshots.length < 2) return null
  const cutoff = Date.now() - hoursAgo * 3600 * 1000
  const currentNav = snapshots[snapshots.length - 1].nav
  // Find closest snapshot to the cutoff
  let closest = snapshots[0]
  let closestDist = Math.abs(closest.ts - cutoff)
  for (const s of snapshots) {
    const dist = Math.abs(s.ts - cutoff)
    if (dist < closestDist) {
      closest = s
      closestDist = dist
    }
  }
  if (closest.nav === 0 || closest === snapshots[snapshots.length - 1]) return null
  return (currentNav - closest.nav) / closest.nav
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

// ── Sparkline SVG ─────────────────────────────────────────

function Sparkline({ data, color, className }: { data: number[]; color: string; className?: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 44
  const h = 18
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ')
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} style={{ width: 44, height: 18, flexShrink: 0 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

// ── Types ─────────────────────────────────────────────────

interface VaultEntry {
  fund: any
  vault: VaultInfo
}

interface VaultActionsProps {
  vaults: VaultEntry[]
  initialIndex: number
  onClose: () => void
}

// ── Detail Panel (right column on desktop) ────────────────

function VaultDetailPanel({ vault, fund, allVaults, onSelectVault }: {
  vault: VaultInfo
  fund: any
  allVaults: VaultEntry[]
  onSelectVault: (i: number) => void
}) {
  const t = useTranslations('vision')
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [depositInput, setDepositInput] = useState('')
  const [withdrawInput, setWithdrawInput] = useState('')
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false)

  const branding = useFundBranding(vault.address)

  const {
    deposit, step: depositStep, isPending: depositPending,
    isConfirming: depositConfirming, error: depositError, reset: resetDeposit,
  } = useVaultDeposit()
  const {
    redeem, step: redeemStep, isPending: redeemPending,
    isConfirming: redeemConfirming, error: redeemError, reset: resetRedeem,
  } = useVaultRedeem()

  // Position lives in the SSE context, updated every few seconds by data-node.
  const ssePosition = useSSEUserVaultPosition(vault.address)
  const shares = ssePosition ? (() => { try { return BigInt(ssePosition.shares) } catch { return 0n } })() : 0n
  const pendingAssets = ssePosition ? (() => { try { return BigInt(ssePosition.pending_deposit) } catch { return 0n } })() : 0n
  const sharesFloat = parseFloat(formatUnits(shares, 18))
  const pendingFloat = parseFloat(formatUnits(pendingAssets, 18))
  const userValue =
    vault.totalSupply > 0n && shares > 0n
      ? (Number(shares) / Number(vault.totalSupply)) * parseFloat(formatUnits(vault.totalAssets, 18))
      : 0
  const userPnl = shares > 0n ? userValue - sharesFloat : 0
  const hasPosition = shares > 0n || pendingAssets > 0n

  const feePercent = Number(vault.performanceFeeRate) / 1e16
  const liveTvl = parseFloat(formatUnits(vault.totalAssets, 18))

  const { snapshots, hasHistory } = useVaultHistory(vault.address)

  // When the live wagmi read is empty (totalSupply == 0n) but the historical
  // snapshot exists, prefer the snapshot. Otherwise the modal contradicts itself:
  // TVL $0 sits next to NAV $1.0000 sits next to a -12% headline. The chart and
  // the headline must speak about the same vault.
  const latestSnapshot: VaultSnapshot | null =
    snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const fallbackNav = latestSnapshot?.nav ?? null
  const fallbackTvl = latestSnapshot?.tvl ?? null

  const liveHasSupply = vault.totalSupply > 0n
  const liveHasAssets = vault.totalAssets > 0n

  const effectiveNav = liveHasSupply ? vault.navPerShare : (fallbackNav ?? 1.0)
  const effectiveTvl = liveHasAssets ? liveTvl : (fallbackTvl ?? 0)
  const effectivePerf = liveHasSupply
    ? vault.performanceSinceInception
    : (fallbackNav !== null ? fallbackNav - 1.0 : 0)
  const effectiveDeployedPct = liveHasAssets ? Math.round(vault.deployedRatio * 100) : 0
  const effectiveSharesDisplay = liveHasSupply
    ? Number(formatUnits(vault.totalSupply, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : '0'

  const perfPercent = (effectivePerf * 100).toFixed(2)
  const isPositive = effectivePerf >= 0
  const deployedPct = effectiveDeployedPct

  // Time-range filter for the NAV chart. The buttons used to be cosmetic.
  // Default to ALL but auto-snap to a smaller window if there's enough data.
  type NavRange = '1D' | '1W' | '1M' | 'ALL'
  const RANGE_HOURS: Record<NavRange, number | null> = {
    '1D': 24,
    '1W': 24 * 7,
    '1M': 24 * 30,
    ALL: null,
  }
  const defaultRange: NavRange = useMemo(() => {
    if (!hasHistory || snapshots.length < 2) return 'ALL'
    const spanHours = (snapshots[snapshots.length - 1].ts - snapshots[0].ts) / 3_600_000
    if (spanHours <= 24) return '1D'
    if (spanHours <= 24 * 7) return '1W'
    if (spanHours <= 24 * 30) return '1M'
    return 'ALL'
  }, [hasHistory, snapshots])
  const [navRange, setNavRange] = useState<NavRange>(defaultRange)
  // Snap range to default whenever the underlying data span changes — covers
  // the case where snapshots arrive after the first render.
  useEffect(() => {
    setNavRange(defaultRange)
  }, [defaultRange])

  const filteredSnapshots = useMemo(() => {
    const cutoffHours = RANGE_HOURS[navRange]
    if (cutoffHours === null) return snapshots
    if (snapshots.length === 0) return snapshots
    const cutoffMs = Date.now() - cutoffHours * 3_600_000
    const windowed = snapshots.filter(s => s.ts >= cutoffMs)
    // Always keep at least the last two points so the chart can draw a line.
    return windowed.length >= 2 ? windowed : snapshots.slice(-2)
  }, [snapshots, navRange])

  const navHistory = useMemo(() => {
    if (filteredSnapshots.length >= 2) return filteredSnapshots.map(s => s.nav)
    return null
  }, [filteredSnapshots])

  const maxDd = useMemo(() => navHistory ? computeMaxDrawdown(navHistory) : null, [navHistory])
  const vol = useMemo(() => navHistory ? computeVolatility(navHistory) : null, [navHistory])
  const sharpe = useMemo(() => navHistory ? computeSharpe(navHistory) : null, [navHistory])
  const sortino = useMemo(() => navHistory ? computeSortino(navHistory) : null, [navHistory])
  const perf24h = useMemo(() => hasHistory ? computePerfForPeriod(snapshots, 24) : null, [hasHistory, snapshots])
  const perf7d = useMemo(() => hasHistory ? computePerfForPeriod(snapshots, 168) : null, [hasHistory, snapshots])
  const perf30d = useMemo(() => hasHistory ? computePerfForPeriod(snapshots, 720) : null, [hasHistory, snapshots])

  const tradeCount = 0 // Vision vaults track batch participation, not individual trades

  const strategyKey = branding?.strategy ?? fund.strategy ?? ''
  const strategyColor = STRATEGY_COLOR[strategyKey] ?? '#999'
  const vaultName = branding?.name ?? vault.name
  const tagline = branding?.tagline ?? fund.tagline ?? ''
  const source = branding?.source ?? fund.source ?? ''
  const category = branding?.category ?? fund.category ?? ''

  const handleDeposit = () => {
    const amount = parseUnits(depositInput || '0', 18)
    if (amount <= 0n) return
    deposit(vault.address, amount)
  }

  const handleWithdraw = () => {
    const shareAmount = parseUnits(withdrawInput || '0', 18)
    if (shareAmount <= 0n) return
    redeem(vault.address, shareAmount)
  }

  const depositBusy = depositStep === 'approving' || depositStep === 'depositing'
  const redeemBusy = redeemStep === 'requesting'
  void depositPending
  void redeemPending

  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden">
      {/* Left column: stats + chart + thesis + performance */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Mobile pills, shrink-0 prevents flex-col parent from squashing height */}
        {allVaults.length > 1 && (
          <div
            className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-3.5 py-2.5 border-b border-[#F0F0F0] lg:hidden [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
          >
            {allVaults.map((entry, i) => {
              const sc = STRATEGY_COLOR[entry.fund.strategy] ?? '#999'
              const perf = entry.vault.performanceSinceInception
              const isPos = perf >= 0
              const isActive = entry.vault.address === vault.address
              return (
                <button
                  key={entry.vault.address}
                  onClick={() => onSelectVault(i)}
                  className={cn(
                    'flex items-center gap-1.5 h-7 px-2.5 rounded-full border whitespace-nowrap shrink-0 transition-colors text-[11px] font-bold',
                    isActive
                      ? 'bg-[rgba(0,163,108,0.08)] border-[#00A36C]'
                      : 'bg-white border-[#E0E0E0]',
                  )}
                >
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sc }} />
                  <span className="text-text-primary">{entry.fund.name}</span>
                  <span className={cn('font-mono text-[10px] font-bold', isPos ? 'text-[#00A36C]' : 'text-[#e11d48]')}>
                    {isPos ? '+' : ''}{(perf * 100).toFixed(2)}%
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Section header — aligns with VAULTS (left) and RISK (right) */}
        <div className="hidden lg:flex shrink-0 bg-[#1A1A1A] px-4 py-1.5 items-center justify-between">
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/75">Overview</span>
          <span className="font-mono text-[9px] text-white/35 uppercase tracking-[0.08em]">{(branding?.strategy ?? fund.strategy ?? '').replace(/_/g, ' ')}</span>
        </div>

        {/* Stats strip, 3 cells on mobile, 6 on desktop */}
        <div className="grid grid-cols-3 lg:grid-cols-6 shrink-0 border-b border-[#E0E0E0]">
          <div className="px-3 py-2.5 lg:px-3.5 border-r border-[#F0F0F0]">
            <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted mb-0.5">TVL</div>
            <div className="font-mono text-[13px] lg:text-[15px] font-bold tabular-nums text-text-primary">{formatTvlCompact(effectiveTvl)}</div>
            <div className="font-mono text-[9px] text-text-muted mt-0.5 truncate">{effectiveSharesDisplay} shares</div>
          </div>
          <div className="px-3 py-2.5 lg:px-3.5 border-r border-[#F0F0F0]">
            <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted mb-0.5">NAV</div>
            <div className="font-mono text-[13px] lg:text-[15px] font-bold tabular-nums text-text-primary">${effectiveNav.toFixed(4)}</div>
          </div>
          <div className="px-3 py-2.5 lg:px-3.5 lg:border-r border-[#F0F0F0]">
            <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted mb-0.5">Performance</div>
            <div className={cn('font-mono text-[13px] lg:text-[15px] font-bold tabular-nums', isPositive ? 'text-color-up' : 'text-color-down')}>
              {isPositive ? '+' : ''}{perfPercent}%
            </div>
          </div>
          <div className="hidden lg:block px-3.5 py-2.5 border-r border-[#F0F0F0]">
            <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted mb-0.5">Deployed</div>
            <div className="font-mono text-[15px] font-bold tabular-nums text-text-primary">{deployedPct}%</div>
            <div className="h-[3px] bg-[#F0F0F0] rounded-none overflow-hidden mt-1">
              <div className="h-full rounded-none bg-[#00A36C]" style={{ width: `${deployedPct}%` }} />
            </div>
          </div>
          <div className="hidden lg:block px-3.5 py-2.5 border-r border-[#F0F0F0]">
            <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted mb-0.5">Sharpe</div>
            <div className="font-mono text-[15px] font-bold tabular-nums text-text-primary">{fmtRatio(sharpe)}</div>
          </div>
          <div className="hidden lg:block px-3.5 py-2.5">
            <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted mb-0.5">Max DD</div>
            <div className={cn('font-mono text-[15px] font-bold tabular-nums', maxDd !== null ? 'text-color-down' : 'text-text-primary')}>
              {maxDd !== null ? `${(maxDd * 100).toFixed(1)}%` : '—'}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="px-4 py-3 shrink-0 border-b border-[#F0F0F0]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-text-muted">NAV History</span>
            <div className="flex gap-0.5 bg-[#FAFAFA] p-0.5 rounded-none">
              {(['1D', '1W', '1M', 'ALL'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNavRange(p)}
                  className={cn(
                    'font-mono text-[10px] font-semibold px-2 py-0.5 rounded-none border-0 transition-colors',
                    p === navRange ? 'bg-[#1A1A1A] text-white' : 'bg-transparent text-text-muted hover:text-text-primary',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[clamp(180px,30vh,420px)] overflow-hidden">
            {navHistory ? (
              <NavChart data={navHistory} vaultAddr={vault.address} timestamps={filteredSnapshots.map(s => s.ts)} />
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted text-[12px] font-mono">
                Awaiting first trade
              </div>
            )}
          </div>
        </div>

        {/* Mobile risk strip, 4 additional metrics under the chart */}
        <div className="grid grid-cols-4 shrink-0 border-b border-[#F0F0F0] lg:hidden">
          {[
            { label: 'Sharpe', value: fmtRatio(sharpe) },
            { label: 'Max DD', value: maxDd !== null ? `${(maxDd * 100).toFixed(1)}%` : '—', down: maxDd !== null },
            { label: 'Vol', value: vol !== null ? `${(vol * 100).toFixed(1)}%` : '—' },
            { label: 'Deployed', value: `${deployedPct}%` },
          ].map(({ label, value, down }) => (
            <div key={label} className="px-2.5 py-2 border-r border-[#F0F0F0] last:border-r-0 text-center">
              <div className="text-[8px] font-bold tracking-[0.06em] uppercase text-text-muted mb-0.5">{label}</div>
              <div className={cn('font-mono text-[11px] font-bold text-text-primary', down && 'text-color-down')}>{value}</div>
            </div>
          ))}
        </div>

        {/* Mobile CTA, Deposit is primary, Build-your-own is secondary */}
        <div className="flex flex-col gap-2.5 px-4 py-3.5 shrink-0 border-b border-[#E0E0E0] lg:hidden">
          <WalletActionButton
            onClick={() => { setTab('deposit'); if (tab === 'deposit') handleDeposit() }}
            disabled={tab === 'deposit' && (depositBusy || depositConfirming || !depositInput)}
            className="w-full py-3.5 bg-[#00A36C] text-white text-[15px] font-black rounded-none shadow-[0_4px_16px_rgba(0,163,108,0.25)] relative overflow-hidden disabled:opacity-50"
          >
            <span className="relative z-10">
              {depositStep === 'approving' ? t('vaults.approving')
                : depositStep === 'depositing' ? t('vaults.depositing')
                : depositConfirming ? t('vaults.confirming')
                : `Deposit into ${vaultName}`}
            </span>
          </WalletActionButton>
          <p className="text-[10px] text-text-muted text-center">No lock-up. Withdraw anytime. {feePercent.toFixed(0)}% perf fee.</p>

          <button className="mt-1 w-full py-2.5 rounded-none border border-dashed border-[rgba(0,163,108,0.45)] bg-transparent text-[#00A36C] text-[11px] font-extrabold tracking-wide flex items-center justify-center gap-1.5 transition-colors hover:bg-[rgba(0,163,108,0.08)]">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Or build your own vault
          </button>
        </div>

        {/* Investment thesis */}
        <div className="bg-[#1A1A1A] px-4 py-1.5 shrink-0">
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/75">Investment Thesis</span>
        </div>
        <div className="px-4 py-3 shrink-0 border-b border-[#F0F0F0]">
          <p className="text-[12px] lg:text-[13px] leading-relaxed text-text-primary">
            {tagline}
          </p>
        </div>

        {/* Mobile collapsible details */}
        <div className="shrink-0 lg:hidden">
          <button
            onClick={() => setMobileDetailsOpen(!mobileDetailsOpen)}
            className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 bg-[#FAFAFA] border-b border-[#F0F0F0] text-[11px] font-bold text-text-secondary hover:bg-[#F0F0F0] transition-colors"
          >
            More Details
            <svg
              className={cn('w-3 h-3 stroke-current transition-transform', mobileDetailsOpen && 'rotate-180')}
              viewBox="0 0 24 24" fill="none" strokeWidth={2}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {mobileDetailsOpen && (
            <>
              <div className="bg-[#1A1A1A] px-4 py-1.5">
                <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/75">Performance</span>
              </div>
              <div className="grid grid-cols-4">
                {[
                  { label: '24h', value: fmtPct(perf24h), up: perf24h !== null && perf24h >= 0 },
                  { label: '7d', value: fmtPct(perf7d), up: perf7d !== null && perf7d >= 0 },
                  { label: '30d', value: fmtPct(perf30d), up: perf30d !== null && perf30d >= 0 },
                  { label: 'Inception', value: `${isPositive ? '+' : ''}${perfPercent}%`, up: isPositive },
                ].map(({ label, value, up }) => (
                  <div key={label} className="px-3 py-2 border-r border-[#F0F0F0] last:border-r-0">
                    <div className="text-[8px] font-semibold tracking-[0.04em] uppercase text-text-muted mb-0.5">{label}</div>
                    <div className={cn('font-mono text-[11px] font-bold', up ? 'text-color-up' : 'text-text-primary')}>{value}</div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-3 border-t border-[#F0F0F0]">
                <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted mb-2">Fee Structure</div>
                <div className="flex justify-between py-1"><span className="text-xs text-text-secondary">Performance Fee</span><span className="font-mono text-[13px] font-bold">{feePercent.toFixed(0)}%</span></div>
                <div className="flex justify-between py-1"><span className="text-xs text-text-secondary">Management Fee</span><span className="font-mono text-[13px] font-bold">0%</span></div>
                <div className="flex justify-between py-1"><span className="text-xs text-text-secondary">High Water Mark</span><span className="font-mono text-[13px] font-bold text-color-up">${parseFloat(formatUnits(vault.highWaterMark, 18)).toFixed(4)}</span></div>
              </div>

              <div className="px-4 py-3 border-t border-[#F0F0F0]">
                <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted mb-2">Capital Allocation</div>
                <div className="flex h-1.5 bg-[#F0F0F0] overflow-hidden mb-2">
                  <div className="h-full bg-[#00A36C]" style={{ width: `${deployedPct}%` }} />
                  <div className="h-full bg-[#D1D5DB]" style={{ width: `${100 - deployedPct}%` }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-[11px]"><div className="w-1.5 h-1.5 rounded-full bg-[#00A36C]" /><span className="flex-1 text-text-secondary font-medium">Deployed</span><span className="font-mono font-semibold">{deployedPct}%</span></div>
                  <div className="flex items-center gap-1.5 text-[11px]"><div className="w-1.5 h-1.5 rounded-full bg-[#D1D5DB]" /><span className="flex-1 text-text-secondary font-medium">Idle</span><span className="font-mono font-semibold">{100 - deployedPct}%</span></div>
                </div>
              </div>

              <div className="flex gap-2.5 flex-wrap px-4 py-2 bg-[#FAFAFA] border-t border-[#F0F0F0]">
                <span className="text-[9px] text-text-muted">Source: <strong className="font-mono font-bold text-text-secondary">{source}</strong></span>
                <span className="text-[9px] text-text-muted">Category: <strong className="font-mono font-bold text-text-secondary">{category}</strong></span>
                <span className="text-[9px] text-text-muted">Contract: <strong className="font-mono font-bold text-text-secondary">{vault.address.slice(0, 6)}...{vault.address.slice(-3)}</strong></span>
              </div>
            </>
          )}
        </div>

        {/* Desktop: Performance + meta (hidden on mobile) */}
        <div className="hidden shrink-0 lg:block">
          <div className="bg-[#1A1A1A] px-4 py-1.5">
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/75">Performance</span>
          </div>
          <div className="grid grid-cols-4">
            {[
              { label: '24h', value: fmtPct(perf24h), up: perf24h !== null && perf24h >= 0 },
              { label: '7d', value: fmtPct(perf7d), up: perf7d !== null && perf7d >= 0 },
              { label: '30d', value: fmtPct(perf30d), up: perf30d !== null && perf30d >= 0 },
              { label: 'Inception', value: `${isPositive ? '+' : ''}${perfPercent}%`, up: isPositive },
              { label: 'Win Rate', value: '—' },
              { label: 'Avg Win', value: '—' },
              { label: 'Avg Loss', value: '—' },
              { label: 'Trades', value: tradeCount > 0 ? String(tradeCount) : '—' },
            ].map(({ label, value, up }) => (
              <div key={label} className="px-3 py-2 border-r border-b border-[#F0F0F0] [&:nth-child(4n)]:border-r-0 last:[&:nth-last-child(-n+4)]:border-b-0">
                <div className="text-[9px] font-semibold tracking-[0.04em] uppercase text-text-muted mb-0.5">{label}</div>
                <div className={cn('font-mono text-[13px] font-bold', up ? 'text-color-up' : 'text-text-primary')}>{value}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 flex-wrap px-4 py-2 bg-[#FAFAFA] border-t border-[#F0F0F0]">
            <span className="text-[10px] text-text-muted">Source: <strong className="font-mono font-bold text-text-secondary">{source}</strong></span>
            <span className="text-[10px] text-text-muted">Category: <strong className="font-mono font-bold text-text-secondary">{category}</strong></span>
            <span className="text-[10px] text-text-muted">Contract: <strong className="font-mono font-bold text-text-secondary">{vault.address.slice(0, 6)}...{vault.address.slice(-3)}</strong></span>
          </div>
        </div>
      </div>

      {/* Right column (desktop only) */}
      <div className="hidden lg:flex flex-col w-[300px] shrink-0 border-l border-[#E0E0E0] overflow-y-auto">
        {/* Risk */}
        <div className="bg-[#1A1A1A] px-4 py-1.5">
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/75">Risk</span>
        </div>
        <div className="px-4 py-3 border-b border-[#F0F0F0]">
          <div className="grid grid-cols-2 gap-2">
            <div><div className="text-[9px] font-semibold tracking-[0.04em] uppercase text-text-muted mb-0.5">Sharpe Ratio</div><div className="font-mono text-sm font-bold">{fmtRatio(sharpe)}</div></div>
            <div><div className="text-[9px] font-semibold tracking-[0.04em] uppercase text-text-muted mb-0.5">Max Drawdown</div><div className={cn('font-mono text-sm font-bold', maxDd !== null ? 'text-color-down' : '')}>{maxDd !== null ? `${(maxDd * 100).toFixed(1)}%` : '—'}</div></div>
            <div><div className="text-[9px] font-semibold tracking-[0.04em] uppercase text-text-muted mb-0.5">Volatility</div><div className="font-mono text-sm font-bold">{vol !== null ? `${(vol * 100).toFixed(1)}%` : '—'}</div></div>
            <div><div className="text-[9px] font-semibold tracking-[0.04em] uppercase text-text-muted mb-0.5">Sortino</div><div className="font-mono text-sm font-bold">{fmtRatio(sortino)}</div></div>
          </div>
        </div>

        {/* Allocation */}
        <div className="px-4 py-3 border-b border-[#F0F0F0]">
          <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted mb-2">Capital Allocation</div>
          <div className="flex h-1.5 bg-[#F0F0F0] overflow-hidden mb-2">
            <div className="h-full bg-[#00A36C]" style={{ width: `${deployedPct}%` }} />
            <div className="h-full bg-[#D1D5DB]" style={{ width: `${100 - deployedPct}%` }} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[11px]"><div className="w-1.5 h-1.5 rounded-full bg-[#00A36C]" /><span className="flex-1 text-text-secondary font-medium">Deployed</span><span className="font-mono font-semibold">{deployedPct}%</span></div>
            <div className="flex items-center gap-1.5 text-[11px]"><div className="w-1.5 h-1.5 rounded-full bg-[#D1D5DB]" /><span className="flex-1 text-text-secondary font-medium">Idle</span><span className="font-mono font-semibold">{100 - deployedPct}%</span></div>
          </div>
        </div>

        {/* Fees */}
        <div className="px-4 py-3 border-b border-[#F0F0F0]">
          <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted mb-2">Fee Structure</div>
          <div className="flex justify-between py-1"><span className="text-xs text-text-secondary">Performance Fee</span><span className="font-mono text-[13px] font-bold">{feePercent.toFixed(0)}%</span></div>
          <div className="flex justify-between py-1"><span className="text-xs text-text-secondary">Management Fee</span><span className="font-mono text-[13px] font-bold">0%</span></div>
          <div className="flex justify-between py-1"><span className="text-xs text-text-secondary">High Water Mark</span><span className="font-mono text-[13px] font-bold text-color-up">${parseFloat(formatUnits(vault.highWaterMark, 18)).toFixed(4)}</span></div>
        </div>

        {/* Position */}
        {hasPosition && (
          <div className="px-4 py-3 border-b border-[#F0F0F0]">
            <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted mb-2">Your Position</div>
            {shares > 0n && (
              <>
                <div className="flex justify-between py-1"><span className="text-xs text-text-secondary">Shares</span><span className="font-mono text-[13px] font-bold">{sharesFloat.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></div>
                <div className="flex justify-between py-1"><span className="text-xs text-text-secondary">Value</span><span className="font-mono text-[13px] font-bold">${userValue.toFixed(2)}</span></div>
                <div className="flex justify-between py-1"><span className="text-xs text-text-secondary">P&L</span><span className={cn('font-mono text-[13px] font-bold', userPnl >= 0 ? 'text-color-up' : 'text-color-down')}>{userPnl >= 0 ? '+' : ''}${userPnl.toFixed(2)}</span></div>
              </>
            )}
            {pendingAssets > 0n && (
              <div className="flex justify-between py-1">
                <span className="text-xs text-text-secondary">Pending Deposit</span>
                <span className="font-mono text-[13px] font-bold text-[#00A36C]">${pendingFloat.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {/* CTA zone */}
        <div className="px-4 py-4 flex flex-col gap-2 flex-1 justify-end">
          <div className="flex border border-[#E0E0E0] rounded-none overflow-hidden">
            <button onClick={() => { setTab('deposit'); resetRedeem?.() }} className={cn('flex-1 py-2 text-[11px] font-bold text-center transition-colors', tab === 'deposit' ? 'bg-[#1A1A1A] text-white' : 'bg-white text-text-muted')}>
              Deposit
            </button>
            <button onClick={() => { setTab('withdraw'); resetDeposit?.() }} className={cn('flex-1 py-2 text-[11px] font-bold text-center border-l border-[#E0E0E0] transition-colors', tab === 'withdraw' ? 'bg-[#1A1A1A] text-white' : 'bg-white text-text-muted')}>
              Withdraw
            </button>
          </div>

          {tab === 'deposit' ? (
            <div className="relative">
              <input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={depositInput} onChange={(e) => setDepositInput(e.target.value)}
                className="w-full px-3.5 py-2.5 pr-[70px] border-2 border-[#E0E0E0] rounded-none font-mono text-[15px] font-semibold text-text-primary bg-[#FAFAFA] outline-none focus:border-[#00A36C] focus:ring-[3px] focus:ring-[rgba(0,163,108,0.08)] transition-colors"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-text-muted">USDC</span>
            </div>
          ) : (
            <div className="relative">
              <input
                type="number" min="0" step="0.0001" placeholder="0.00"
                value={withdrawInput} onChange={(e) => setWithdrawInput(e.target.value)}
                className="w-full px-3.5 py-2.5 pr-[70px] border-2 border-[#E0E0E0] rounded-none font-mono text-[15px] font-semibold text-text-primary bg-[#FAFAFA] outline-none focus:border-[#00A36C] focus:ring-[3px] focus:ring-[rgba(0,163,108,0.08)] transition-colors"
              />
              {shares > 0n && (
                <button onClick={() => setWithdrawInput(formatUnits(shares, 18))} className="absolute right-[44px] top-1/2 -translate-y-1/2 text-[9px] font-extrabold text-[#00A36C] tracking-[0.04em]">
                  MAX
                </button>
              )}
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-text-muted">Shares</span>
            </div>
          )}

          {depositError && tab === 'deposit' && <p className="text-xs text-color-down">{depositError}</p>}
          {redeemError && tab === 'withdraw' && <p className="text-xs text-color-down">{redeemError}</p>}

          <WalletActionButton
            onClick={() => tab === 'deposit' ? handleDeposit() : handleWithdraw()}
            disabled={tab === 'deposit' ? (depositBusy || depositConfirming || !depositInput) : (redeemBusy || redeemConfirming || !withdrawInput)}
            className="w-full py-3.5 bg-[#00A36C] text-white text-sm font-black rounded-none shadow-[0_2px_8px_rgba(0,163,108,0.25)] relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,163,108,0.25)] disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="relative z-10">
              {tab === 'deposit'
                ? depositStep === 'approving' ? t('vaults.approving')
                  : depositStep === 'depositing' ? t('vaults.depositing')
                  : depositConfirming ? t('vaults.confirming')
                  : depositStep === 'done' ? t('vaults.deposit_requested')
                  : `Join This Vault`
                : redeemStep === 'requesting' ? t('vaults.requesting')
                  : redeemConfirming ? t('vaults.confirming')
                  : redeemStep === 'done' ? t('vaults.redeem_requested')
                  : t('vaults.withdraw')}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full animate-[shimmer_3s_ease_infinite]" />
          </WalletActionButton>
          <p className="text-[10px] text-text-muted text-center">No lock-up. Withdraw anytime.</p>

          <div className="flex items-center gap-2.5 my-1">
            <div className="flex-1 h-px bg-[#F0F0F0]" />
            <span className="text-[9px] font-bold tracking-[0.08em] uppercase text-text-muted">or</span>
            <div className="flex-1 h-px bg-[#F0F0F0]" />
          </div>

          <button className="w-full py-3 border-2 border-dashed border-[rgba(0,163,108,0.35)] rounded-none bg-[rgba(0,163,108,0.08)] text-[#00A36C] text-[13px] font-extrabold flex items-center justify-center gap-1.5 transition-all hover:bg-[#00A36C] hover:text-white hover:border-[#00A36C] hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,163,108,0.25)]">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Build Your Own Vault
          </button>
          <p className="text-[10px] text-text-muted text-center">Pick a data source, deploy in minutes.</p>
        </div>
      </div>
    </div>
  )
}

// ── Main Export ────────────────────────────────────────────

export function VaultActions({ vaults, initialIndex, onClose }: VaultActionsProps) {
  const [selectedIdx, setSelectedIdx] = useState(initialIndex)
  const current = vaults[selectedIdx]

  const branding = useFundBranding(current.vault.address)
  const vaultName = branding?.name ?? current.fund.name
  const strategyKey = branding?.strategy ?? current.fund.strategy ?? ''
  const strategyColor = STRATEGY_COLOR[strategyKey] ?? '#999'
  const tvl = parseFloat(formatUnits(current.vault.totalAssets, 18))
  const perf = current.vault.performanceSinceInception
  const isPos = perf >= 0
  const feePercent = Number(current.vault.performanceFeeRate) / 1e16

  return (
    <SpringBackdrop className={glass.backdrop} onClick={onClose}>
      <SpringModal
        className="bg-white rounded-none shadow-2xl w-[95vw] max-w-[1120px] max-h-[90vh] lg:max-h-[720px] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="shrink-0 bg-[#1A1A1A] px-5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-extrabold text-white tracking-[-0.01em]">{vaultName}</span>
            <span
              className="text-[9px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-none"
              style={{ backgroundColor: strategyColor + '24', color: strategyColor }}
            >
              {strategyKey.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-4">
            {[
              { label: 'TVL', value: formatTvlCompact(tvl) },
              { label: 'NAV', value: `$${current.vault.navPerShare.toFixed(4)}` },
              { label: 'Perf', value: `${isPos ? '+' : ''}${(perf * 100).toFixed(2)}%`, className: isPos ? 'text-[#00c483]' : 'text-[#e11d48]' },
              { label: 'Fee', value: `${feePercent.toFixed(0)}%` },
            ].map(({ label, value, className }) => (
              <div key={label} className="text-right">
                <div className="text-[8px] font-semibold tracking-[0.08em] uppercase text-white/40">{label}</div>
                <div className={cn('font-mono text-xs font-bold text-white', className)}>{value}</div>
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center bg-white/[0.08] text-white/50 hover:bg-white/[0.15] hover:text-white transition-colors ml-4"
            aria-label="Close"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body: sidebar + detail */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar (desktop only) */}
          <div className="hidden lg:flex flex-col w-[260px] shrink-0 border-r border-[#E0E0E0]">
            <div className="bg-[#1A1A1A] px-4 py-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/75">Vaults</span>
              <span className="font-mono text-[9px] text-white/35">{vaults.length} vaults</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {vaults.map((entry, i) => {
                const ep = entry.vault.performanceSinceInception
                const ePos = ep >= 0
                const sc = STRATEGY_COLOR[entry.fund.strategy] ?? '#999'
                const navs = entry.vault.navPerShare
                const sparkData = Math.abs(navs - 1.0) > 0.005
                  ? generateNavHistory(navs, entry.vault.address, 12)
                  : [1, 1]
                return (
                  <div
                    key={entry.vault.address}
                    onClick={() => setSelectedIdx(i)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 border-b border-[#F0F0F0] cursor-pointer transition-colors hover:bg-[#FAFAFA]',
                      selectedIdx === i && 'bg-[#FAFAFA] border-l-[3px] border-l-[#00A36C] pl-[13px]',
                    )}
                  >
                    <div className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: sc }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-text-primary truncate">{entry.fund.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-semibold tracking-[0.04em] uppercase text-text-muted">
                          {(entry.fund.strategy ?? '').replace(/_/g, ' ')}
                        </span>
                        <span className={cn('font-mono text-[11px] font-bold', ePos ? 'text-[#00A36C]' : 'text-[#e11d48]')}>
                          {ePos ? '+' : ''}{(ep * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <Sparkline data={sparkData} color={sc} />
                  </div>
                )
              })}
            </div>
            <div className="border-t border-[#E0E0E0] px-4 py-3">
              <Link
                href="/build-bot"
                className="flex items-center justify-center gap-1.5 w-full py-2.5 border-2 border-dashed border-[#00A36C] rounded-none bg-[rgba(0,163,108,0.08)] text-[#00A36C] text-xs font-extrabold transition-colors hover:bg-[#00A36C] hover:text-white hover:border-[#00A36C]"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create Your Own Vault
              </Link>
            </div>
          </div>

          {/* Detail panel */}
          <VaultDetailPanel
            key={current.vault.address}
            vault={current.vault}
            fund={current.fund}
            allVaults={vaults}
            onSelectVault={setSelectedIdx}
          />
        </div>
      </SpringModal>
    </SpringBackdrop>
  )
}
