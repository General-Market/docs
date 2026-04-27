'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { formatUnits, parseUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils/cn'
import { useVaultDeposit } from '@/hooks/vaults/useVaultDeposit'
import { useVaultRedeem } from '@/hooks/vaults/useVaultRedeem'
import { useFundBranding } from '@/hooks/vaults/useFundBranding'
import { useVaultHistory, type VaultSnapshot } from '@/hooks/vaults/useVaultHistory'
import { useVaultDisplayResolver, useEffectiveVaultVitals } from '@/hooks/vaults/useVaultDisplay'
import { useVaultStats } from '@/hooks/vaults/useVaultStats'
import { useSSEUserVaultPosition, useSSEVisionVault } from '@/hooks/useSSE'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { SpringBackdrop, SpringModal, glass } from '@/components/ui/spring'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'
import { NavChart, generateNavHistory } from './NavChart'
import type { VaultInfo } from '@/hooks/vaults/useVaults'

const USDC_BALANCE_ABI = [{
  inputs: [{ name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
}] as const

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

// Annualisation constant — the fund-manager emits ~320 snapshots/day, so the
// correct scaling factor for daily-equivalent stats is sqrt(periods per year).
// With ~4.5-min cadence that's ≈105,000/yr. Using sqrt(252) (trading days)
// treats each snapshot as if it were a daily return, which overstates the
// numbers by ~20×. Scale by snapshots-per-year instead, with a safe floor.
const SNAPSHOT_INTERVAL_MIN = 4.5
const PERIODS_PER_YEAR = (365 * 24 * 60) / SNAPSHOT_INTERVAL_MIN
const ANNUALISE = Math.sqrt(PERIODS_PER_YEAR)

function navsToReturns(navs: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < navs.length; i++) {
    const prev = navs[i - 1]
    if (prev === 0) continue
    out.push((navs[i] - prev) / prev)
  }
  return out
}

function computeVolatility(navs: number[]): number | null {
  if (navs.length < 3) return null
  const returns = navsToReturns(navs)
  if (returns.length < 2) return null
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length
  return Math.sqrt(variance) * ANNUALISE
}

function computeSharpe(navs: number[]): number | null {
  // Two points is enough for "a direction". The old threshold of 5 points
  // left the tile blank for vaults younger than ~20 minutes.
  if (navs.length < 3) return null
  const returns = navsToReturns(navs)
  if (returns.length < 2) return null
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length
  const std = Math.sqrt(variance)
  if (std === 0) return null
  return (mean / std) * ANNUALISE
}

function computeSortino(navs: number[]): number | null {
  if (navs.length < 3) return null
  const returns = navsToReturns(navs)
  if (returns.length < 2) return null
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const downside = returns.filter(r => r < 0)
  // No drawdowns yet — a vault that has only gone up has undefined Sortino.
  // Report a large but finite value rather than null, so the tile renders.
  if (downside.length === 0) return mean > 0 ? 9.99 : null
  const downsideVar = downside.reduce((a, r) => a + r * r, 0) / downside.length
  const downsideStd = Math.sqrt(downsideVar)
  if (downsideStd === 0) return null
  return (mean / downsideStd) * ANNUALISE
}

function computePerfForPeriod(snapshots: VaultSnapshot[], hoursAgo: number): number | null {
  if (snapshots.length < 2) return null
  const cutoff = Date.now() - hoursAgo * 3600 * 1000
  const last = snapshots[snapshots.length - 1]
  // If the whole vault is younger than the requested window, fall back to
  // inception — "7D return" on a 3-day-old vault is just the inception return.
  // Returning null here is what made 7D/30D tiles show "—" for new vaults.
  if (snapshots[0].ts > cutoff) {
    const base = snapshots[0].nav
    if (base === 0) return null
    return (last.nav - base) / base
  }
  // Otherwise find the snapshot nearest the cutoff.
  let closest = snapshots[0]
  let closestDist = Math.abs(closest.ts - cutoff)
  for (const s of snapshots) {
    const dist = Math.abs(s.ts - cutoff)
    if (dist < closestDist) {
      closest = s
      closestDist = dist
    }
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

// Short strategy labels for the cramped sidebar. Falls back to the raw
// key with underscores replaced by spaces so new strategies still render.
const STRATEGY_SHORT_LABEL: Record<string, string> = {
  momentum: 'MOMENTUM',
  contrarian: 'CONTRARIAN',
  bullish: 'BULLISH',
  bearish: 'BEARISH',
  mean_reversion: 'MEAN REV',
  regime: 'REGIME',
  cluster: 'CLUSTER',
  momentum_threshold: 'SELECTIVE',
  time_of_day: 'TIME',
  volatility_fade: 'VOL FADE',
  adoption_curve: 'ADOPTION',
  home_field: 'HOME',
}

function VaultSidebarRow({
  entry, index, selected, color, display, onSelect,
}: {
  entry: VaultEntry
  index: number
  selected: boolean
  color: string
  display: { tvl: number; nav: number; perf: number }
  onSelect: (i: number) => void
}) {
  const { snapshots } = useVaultHistory(entry.vault.address)
  const sparkData = useMemo(() => {
    if (snapshots.length >= 2) return snapshots.map(s => s.nav).slice(-24)
    // Deterministic fallback so cold-loaded rows aren't blank, but only
    // when the NAV has actually moved off $1.
    if (Math.abs(display.nav - 1.0) > 0.0005) {
      return generateNavHistory(display.nav, entry.vault.address, 12)
    }
    return [1, 1]
  }, [snapshots, display.nav, entry.vault.address])

  const strategyKey = (entry.fund.strategy ?? '') as string
  const strategyLabel =
    STRATEGY_SHORT_LABEL[strategyKey] ?? strategyKey.replace(/_/g, ' ').toUpperCase()
  const perfPositive = display.perf >= 0

  return (
    <div
      onClick={() => onSelect(index)}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b border-[#F0F0F0] cursor-pointer transition-colors hover:bg-[#FAFAFA]',
        selected && 'bg-[#FAFAFA] border-l-[3px] border-l-[#00A36C] pl-[13px]',
      )}
    >
      <div className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-text-primary truncate">{entry.fund.name}</div>
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
          <span className="text-[9px] font-semibold tracking-[0.04em] uppercase text-text-muted truncate">
            {strategyLabel}
          </span>
          <span
            className={cn(
              'font-mono text-[11px] font-bold shrink-0',
              perfPositive ? 'text-[#00A36C]' : 'text-[#e11d48]',
            )}
          >
            {perfPositive ? '+' : ''}{(display.perf * 100).toFixed(2)}%
          </span>
        </div>
      </div>
      <Sparkline data={sparkData} color={color} />
    </div>
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
  const resolveDisplay = useVaultDisplayResolver()

  const {
    deposit, step: depositStep, isPending: depositPending,
    isConfirming: depositConfirming, error: depositError, reset: resetDeposit,
    justDepositedAmount,
  } = useVaultDeposit()
  const {
    redeem, step: redeemStep, isPending: redeemPending,
    isConfirming: redeemConfirming, error: redeemError, reset: resetRedeem,
  } = useVaultRedeem()

  // Position has two sources of truth, in priority order:
  //   1. Direct on-chain reads — authoritative for the user's own wallet,
  //      refetched on every new L3 block. Zero dependence on the data-node's
  //      3s SSE poller or on fund-branding.json being in sync.
  //   2. SSE — kept as a cheap fallback for the initial paint and for users
  //      who land on the page without an existing position read cached.
  // Optimistic overlay is layered on top while the claim tx is still
  // propagating through the RPC.
  const { address: userAddress } = useAccount()
  const { getAddress } = useDeployment()
  const usdcAddress = getAddress('L3_WUSDC')

  const { data: usdcBalanceRaw, refetch: refetchUsdcBalance } = useReadContract({
    address: usdcAddress,
    abi: USDC_BALANCE_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    chainId: indexL3.id,
    query: {
      enabled: !!userAddress && usdcAddress !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 10_000,
    },
  })
  const usdcBalance = (usdcBalanceRaw as bigint | undefined) ?? 0n
  const usdcBalanceFloat = parseFloat(formatUnits(usdcBalance, 18))

  const { data: onChainShares, refetch: refetchShares } = useReadContract({
    address: vault.address,
    abi: VISION_VAULT_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!userAddress, refetchInterval: 8000 },
  })

  const { data: onChainPending, refetch: refetchPending } = useReadContract({
    address: vault.address,
    abi: VISION_VAULT_ABI,
    functionName: 'pendingDepositRequest',
    args: userAddress ? [0n, userAddress] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!userAddress, refetchInterval: 8000 },
  })

  // SSE backup. Used only if the on-chain read hasn't landed yet.
  const ssePosition = useSSEUserVaultPosition(vault.address)
  const sseShares = ssePosition ? (() => { try { return BigInt(ssePosition.shares) } catch { return 0n } })() : 0n
  const ssePendingAssets = ssePosition ? (() => { try { return BigInt(ssePosition.pending_deposit) } catch { return 0n } })() : 0n

  // Resolve position using the authoritative source first.
  const resolvedShares = (onChainShares as bigint | undefined) ?? sseShares
  const resolvedPending = (onChainPending as bigint | undefined) ?? ssePendingAssets

  // Burst-refetch after a successful deposit so the user sees their shares as
  // fast as the RPC can return them. Three timed pokes cover the block
  // propagation window without spamming the node.
  useEffect(() => {
    if (depositStep !== 'done') return
    refetchShares()
    refetchPending()
    refetchUsdcBalance()
    const t1 = setTimeout(() => { refetchShares(); refetchPending(); refetchUsdcBalance() }, 1200)
    const t2 = setTimeout(() => { refetchShares(); refetchPending(); refetchUsdcBalance() }, 3500)
    const t3 = setTimeout(() => { refetchShares(); refetchPending(); refetchUsdcBalance() }, 7000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [depositStep, refetchShares, refetchPending, refetchUsdcBalance])

  // Optimistic: only fill in the "Just Deposited" row if neither source shows
  // a position yet. Clears the instant the on-chain read returns the real
  // shares.
  const isOptimistic =
    justDepositedAmount > 0n && resolvedShares === 0n && resolvedPending === 0n
  const shares = resolvedShares
  const pendingAssets = isOptimistic ? justDepositedAmount : resolvedPending

  const sharesFloat = parseFloat(formatUnits(shares, 18))
  const pendingFloat = parseFloat(formatUnits(pendingAssets, 18))
  const userValue =
    vault.totalSupply > 0n && shares > 0n
      ? (Number(shares) / Number(vault.totalSupply)) * parseFloat(formatUnits(vault.totalAssets, 18))
      : 0
  const userPnl = shares > 0n ? userValue - sharesFloat : 0
  const hasPosition = shares > 0n || pendingAssets > 0n

  // Pulse the position panel when a brand-new deposit lands. Triggers on the
  // 0 -> >0 transition of justDepositedAmount, so existing positions don't
  // flash on page load.
  const [positionHighlight, setPositionHighlight] = useState(false)
  const prevJustDepositedRef = useRef(0n)
  useEffect(() => {
    if (justDepositedAmount > 0n && prevJustDepositedRef.current === 0n) {
      setPositionHighlight(true)
      const t = setTimeout(() => setPositionHighlight(false), 2200)
      prevJustDepositedRef.current = justDepositedAmount
      return () => clearTimeout(t)
    }
    if (justDepositedAmount === 0n) prevJustDepositedRef.current = 0n
  }, [justDepositedAmount])

  // Clear the input and drop back to the deposit tab once the flow completes,
  // so the button isn't permanently stuck on "Deposited ✓" with stale input.
  useEffect(() => {
    if (depositStep === 'done') {
      setDepositInput('')
    }
  }, [depositStep])

  const feePercent = Number(vault.performanceFeeRate) / 1e16

  // Time-range filter for the NAV chart. The oracle windows + buckets rows
  // server-side; the frontend just picks which window to request. Default to
  // '1d' for intraday detail — a fresh vault still has dense recent data.
  type NavRange = '1D' | '1W' | '1M' | 'ALL'
  const RANGE_TO_API: Record<NavRange, '1d' | '1w' | '1m' | 'all'> = {
    '1D': '1d', '1W': '1w', '1M': '1m', ALL: 'all',
  }
  const [navRange, setNavRange] = useState<NavRange>('1D')

  const { snapshots: chartSnapshots } = useVaultHistory(
    vault.address,
    RANGE_TO_API[navRange],
  )
  // Full-inception snapshots power the inception-perf tile + stats that need
  // long-horizon data (Sharpe/Sortino). Stay on 'all' regardless of chart tab.
  const { snapshots: allSnapshots, hasHistory: hasAllHistory } = useVaultHistory(vault.address, 'all')
  const snapshots = allSnapshots
  const hasHistory = hasAllHistory

  // Single source for TVL/NAV/perf — identical to what the modal header reads,
  // so the two can't disagree about the same vault.
  const effective = useEffectiveVaultVitals(vault)
  const effectiveTvl = effective.tvl
  const effectiveNav = effective.nav
  const effectivePerf = effective.perf

  const liveHasAssets = vault.totalAssets > 0n
  const liveHasSupply = vault.totalSupply > 0n
  const effectiveDeployedPct = liveHasAssets ? Math.round(vault.deployedRatio * 100) : 0
  const effectiveSharesDisplay = liveHasSupply
    ? Number(formatUnits(vault.totalSupply, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : '0'

  const perfPercent = (effectivePerf * 100).toFixed(2)
  const isPositive = effectivePerf >= 0
  const deployedPct = effectiveDeployedPct

  // Live SSE pulse — the data-node broadcasts vault NAV/TVL on every cycle.
  // Append it as a synthetic "now" point so the chart's right edge tracks
  // reality instead of waiting for the next 60s REST poll.
  const sseVault = useSSEVisionVault(vault.address)
  const liveSnapshot: VaultSnapshot | null = useMemo(() => {
    if (!sseVault) return null
    let totalAssetsWei: bigint
    try { totalAssetsWei = BigInt(sseVault.total_assets) } catch { return null }
    return {
      nav: sseVault.nav_per_share,
      tvl: parseFloat(formatUnits(totalAssetsWei, 18)),
      ts: Date.now(),
    }
    // ts captures "when SSE last delivered a value"; recompute when those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sseVault?.nav_per_share, sseVault?.total_assets])

  // Append the live tick to both the range slice and the full-inception array.
  const withLive = (arr: VaultSnapshot[]): VaultSnapshot[] => {
    if (!liveSnapshot) return arr
    if (arr.length === 0) return [liveSnapshot]
    const last = arr[arr.length - 1]
    if (liveSnapshot.ts <= last.ts) return arr
    return [...arr, liveSnapshot]
  }
  const displaySnapshots = useMemo(() => withLive(chartSnapshots), [chartSnapshots, liveSnapshot])
  const fullSnapshots = useMemo(() => withLive(snapshots), [snapshots, liveSnapshot])

  const navHistory = useMemo(() => {
    if (displaySnapshots.length >= 2) return displaySnapshots.map(s => s.nav)
    return null
  }, [displaySnapshots])

  // Stats run against the full inception history so Sharpe/Sortino/Vol/Max DD
  // stay valid when the user flips the chart to 1D. Max DD of "the last day"
  // is meaningless; Max DD of "ever" is the number people actually want.
  const statsHistory = useMemo(() => {
    if (fullSnapshots.length >= 2) return fullSnapshots.map(s => s.nav)
    return null
  }, [fullSnapshots])

  const maxDd = useMemo(() => statsHistory ? computeMaxDrawdown(statsHistory) : null, [statsHistory])
  const vol = useMemo(() => statsHistory ? computeVolatility(statsHistory) : null, [statsHistory])
  const sharpe = useMemo(() => statsHistory ? computeSharpe(statsHistory) : null, [statsHistory])
  const sortino = useMemo(() => statsHistory ? computeSortino(statsHistory) : null, [statsHistory])
  const perf24h = useMemo(() => hasHistory ? computePerfForPeriod(fullSnapshots, 24) : null, [hasHistory, fullSnapshots])
  const perf7d = useMemo(() => hasHistory ? computePerfForPeriod(fullSnapshots, 168) : null, [hasHistory, fullSnapshots])
  const perf30d = useMemo(() => hasHistory ? computePerfForPeriod(fullSnapshots, 720) : null, [hasHistory, fullSnapshots])

  // Trading stats from PlayerJoined/PlayerSettled logs (last ~24h of blocks).
  const { stats } = useVaultStats(vault.address)
  const tradeCount = stats?.trades ?? 0
  const winRatePct = stats?.winRate != null ? stats.winRate * 100 : null
  const avgWinUsd = stats?.avgWin ?? null
  const avgLossUsd = stats?.avgLoss ?? null
  const fmtUsd = (v: number | null) =>
    v == null ? '—' : `${v >= 0 ? '+' : ''}$${Math.abs(v).toFixed(2)}`

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

  // 'claiming' must count as busy — the user is waiting on the third wallet
  // popup. Forgetting it leaves the button enabled mid-flow and the user can
  // re-trigger the whole thing.
  const depositBusy =
    depositStep === 'preparing' ||
    depositStep === 'approving' ||
    depositStep === 'depositing' ||
    depositStep === 'claiming'
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
              const perf = resolveDisplay(entry.vault).perf
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
              <NavChart data={navHistory} vaultAddr={vault.address} timestamps={displaySnapshots.map(s => s.ts)} />
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
              {depositStep === 'preparing' ? t('vaults.preparing')
                : depositStep === 'approving' ? t('vaults.approving')
                : depositStep === 'depositing' ? t('vaults.depositing')
                : depositStep === 'claiming' ? t('vaults.claiming')
                : depositConfirming ? t('vaults.confirming')
                : depositStep === 'done' ? t('vaults.deposited')
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
              { label: 'Win Rate', value: winRatePct != null ? `${winRatePct.toFixed(0)}%` : '—' },
              { label: 'Avg Win', value: fmtUsd(avgWinUsd), up: avgWinUsd != null && avgWinUsd >= 0 },
              { label: 'Avg Loss', value: fmtUsd(avgLossUsd) },
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
          <div
            className={cn(
              'px-4 py-3 border-b border-[#F0F0F0] transition-colors duration-700',
              positionHighlight && 'bg-[rgba(0,163,108,0.12)] border-l-[3px] border-l-[#00A36C]',
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted">Your Position</span>
              {isOptimistic && (
                <span className="text-[9px] font-semibold text-[#00A36C] tracking-[0.04em]">
                  Awaiting confirmation…
                </span>
              )}
            </div>
            {shares > 0n && (
              <>
                <div className="flex justify-between py-1"><span className="text-xs text-text-secondary">Shares</span><span className="font-mono text-[13px] font-bold">{sharesFloat.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></div>
                <div className="flex justify-between py-1"><span className="text-xs text-text-secondary">Value</span><span className="font-mono text-[13px] font-bold">${userValue.toFixed(2)}</span></div>
                <div className="flex justify-between py-1"><span className="text-xs text-text-secondary">P&L</span><span className={cn('font-mono text-[13px] font-bold', userPnl >= 0 ? 'text-color-up' : 'text-color-down')}>{userPnl >= 0 ? '+' : ''}${userPnl.toFixed(2)}</span></div>
              </>
            )}
            {pendingAssets > 0n && (
              <div className="flex justify-between py-1">
                <span className="text-xs text-text-secondary">
                  {isOptimistic ? 'Just Deposited' : 'Pending Deposit'}
                </span>
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
            <div>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0" step="0.01" placeholder="0.00"
                  value={depositInput} onChange={(e) => setDepositInput(e.target.value)}
                  data-onboarding-target="vault-input"
                  className="w-full px-3.5 py-2.5 pr-[70px] border-2 border-[#E0E0E0] rounded-none font-mono text-[15px] font-semibold text-text-primary bg-[#FAFAFA] outline-none focus:border-[#00A36C] focus:ring-[3px] focus:ring-[rgba(0,163,108,0.08)] transition-colors"
                />
                {userAddress && usdcBalance > 0n && (
                  <button
                    type="button"
                    onClick={() => setDepositInput(formatUnits(usdcBalance, 18))}
                    className="absolute right-[44px] top-1/2 -translate-y-1/2 text-[9px] font-extrabold text-[#00A36C] tracking-[0.04em]"
                  >
                    MAX
                  </button>
                )}
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-text-muted">USDC</span>
              </div>
              {userAddress && (
                <div className="flex justify-between items-center mt-1 px-0.5">
                  <span className="text-[10px] text-text-muted">Balance</span>
                  <span className="font-mono text-[10px] font-semibold text-text-secondary">
                    {usdcBalanceFloat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                min="0" step="0.0001" placeholder="0.00"
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
            dataAttrs={tab === 'deposit' ? { 'data-onboarding-target': 'vault-action' } : undefined}
            className="w-full py-3.5 bg-[#00A36C] text-white text-sm font-black rounded-none shadow-[0_2px_8px_rgba(0,163,108,0.25)] relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,163,108,0.25)] disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="relative z-10">
              {tab === 'deposit'
                ? depositStep === 'preparing' ? t('vaults.preparing')
                  : depositStep === 'approving' ? t('vaults.approving')
                  : depositStep === 'depositing' ? t('vaults.depositing')
                  : depositStep === 'claiming' ? t('vaults.claiming')
                  : depositConfirming ? t('vaults.confirming')
                  : depositStep === 'done' ? t('vaults.deposited')
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

  const resolveDisplay = useVaultDisplayResolver()
  const headerDisplay = useEffectiveVaultVitals(current.vault)
  const tvl = headerDisplay.tvl
  const nav = headerDisplay.nav
  const perf = headerDisplay.perf
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
              { label: 'NAV', value: `$${nav.toFixed(4)}` },
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

        {/* Section header row — single continuous bar across all three columns */}
        <div className="hidden lg:flex shrink-0 bg-[#1A1A1A]">
          <div className="w-[260px] shrink-0 px-4 py-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/75">Vaults</span>
            <span className="font-mono text-[9px] text-white/35">{vaults.length} vaults</span>
          </div>
          <div className="flex-1 px-4 py-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/75">Overview</span>
            <span className="font-mono text-[9px] text-white/35 uppercase tracking-[0.08em]">{strategyKey.replace(/_/g, ' ')}</span>
          </div>
          <div className="w-[300px] shrink-0 px-4 py-1.5 flex items-center">
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/75">Risk</span>
          </div>
        </div>

        {/* Body: sidebar + detail */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar (desktop only) */}
          <div className="hidden lg:flex flex-col w-[260px] shrink-0 border-r border-[#E0E0E0]">
            <div className="flex-1 overflow-y-auto">
              {vaults.map((entry, i) => (
                <VaultSidebarRow
                  key={entry.vault.address}
                  entry={entry}
                  index={i}
                  selected={selectedIdx === i}
                  color={STRATEGY_COLOR[entry.fund.strategy] ?? '#999'}
                  display={resolveDisplay(entry.vault)}
                  onSelect={setSelectedIdx}
                />
              ))}
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
