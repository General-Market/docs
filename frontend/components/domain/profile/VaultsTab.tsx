'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { Link } from '@/i18n/routing'
import fundData from '@/data/fund-branding.json'
import sourcesDisplay from '@/data/sources-display.json'
import {
  useSSEVisionVaults,
  type VisionVaultSSE,
} from '@/hooks/useSSE'
import { useVaultsTotals } from '@/hooks/useVaultsTotals'
import { useOnChainVaultPositions } from '@/hooks/vaults/useOnChainVaultPositions'
import { useVaults, type VaultInfo } from '@/hooks/vaults/useVaults'
import { VaultActions } from '@/components/domain/vaults/VaultActions'
import { cn } from '@/lib/utils/cn'

interface VaultsTabProps {
  address: string
}

interface VaultRow {
  vaultAddress: string
  name: string
  symbol: string
  source: string
  strategy: string
  sharesBigInt: bigint
  pendingBigInt: bigint
  value: number
  pnl: number
  navPerShare: number
  color: string
}

function safeBigInt(v: string | undefined): bigint {
  if (!v) return 0n
  try { return BigInt(v) } catch { return 0n }
}

const STRATEGY_LABELS: Record<string, string> = {
  momentum: 'Momentum',
  contrarian: 'Contrarian',
  bullish: 'Bullish',
  bearish: 'Bearish',
  momentum_threshold: 'Selective',
  home_field: 'Home Field',
  mean_reversion: 'Mean Reversion',
  regime: 'Regime',
}

// Source → logo path lookup, derived once.
const SOURCE_LOGO: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const s of (sourcesDisplay as any).sources ?? []) {
    if (s.sourceId && s.logo) map[s.sourceId] = s.logo
    if (Array.isArray(s.internalIds)) {
      for (const id of s.internalIds) if (s.logo) map[id] = s.logo
    }
  }
  return map
})()

function VaultBrandTile({ row }: { row: VaultRow }) {
  const logo = SOURCE_LOGO[row.source]
  if (logo) {
    return (
      <div
        className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden flex items-center justify-center"
        style={{ background: row.color }}
      >
        <Image
          src={logo}
          alt={row.source}
          width={56}
          height={56}
          className="w-full h-full object-cover"
          unoptimized
        />
      </div>
    )
  }
  // Fallback — fund-color tile with the symbol's first two letters.
  return (
    <div
      className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-white font-bold text-[16px] tracking-tight"
      style={{ background: row.color }}
    >
      {row.symbol.slice(0, 2)}
    </div>
  )
}

function computeRow(
  fund: any,
  vault: VisionVaultSSE | undefined,
  sharesBigInt: bigint,
  pendingBigInt: bigint,
): VaultRow | null {
  if (sharesBigInt === 0n && pendingBigInt === 0n) return null

  const totalAssets = safeBigInt(vault?.total_assets)
  const totalSupply = safeBigInt(vault?.total_supply)
  const navPerShare = vault?.nav_per_share ?? 1.0

  const sharesFloat = parseFloat(formatUnits(sharesBigInt, 18))
  const pendingFloat = parseFloat(formatUnits(pendingBigInt, 18))
  const sharesValue =
    totalSupply > 0n && sharesBigInt > 0n
      ? (Number(sharesBigInt) / Number(totalSupply)) * parseFloat(formatUnits(totalAssets, 18))
      : 0

  return {
    vaultAddress: fund.vault,
    name: fund.name,
    symbol: fund.symbol,
    source: fund.source,
    strategy: fund.strategy,
    sharesBigInt,
    pendingBigInt,
    value: sharesValue + pendingFloat,
    pnl: sharesBigInt > 0n ? sharesValue - sharesFloat : 0,
    navPerShare,
    color: fund.color || '#2C3E50',
  }
}

export function VaultsTab({ address }: VaultsTabProps) {
  const { address: connectedAddress } = useAccount()
  const visionVaults = useSSEVisionVaults()

  const isSelf = !!connectedAddress && connectedAddress.toLowerCase() === address.toLowerCase()

  const { shares: onChainShares, pending: onChainPending, isChecked } =
    useOnChainVaultPositions(isSelf ? (connectedAddress as `0x${string}` | undefined) : undefined)

  const vaultByAddr = useMemo(() => {
    const map = new Map<string, VisionVaultSSE>()
    for (const v of visionVaults) map.set(v.address.toLowerCase(), v)
    return map
  }, [visionVaults])

  const rows = useMemo<VaultRow[]>(() => {
    if (!isSelf) return []
    const funds = (fundData as any).funds.filter((f: any) => !!f.vault)
    const result: VaultRow[] = []
    for (const fund of funds) {
      const lower = (fund.vault as string).toLowerCase()
      const vault = vaultByAddr.get(lower)
      const sharesBig = onChainShares.get(lower) ?? 0n
      const pendingBig = onChainPending.get(lower) ?? 0n
      const row = computeRow(fund, vault, sharesBig, pendingBig)
      if (row) result.push(row)
    }
    result.sort((a, b) => b.value - a.value)
    return result
  }, [isSelf, vaultByAddr, onChainShares, onChainPending])

  const totals = useVaultsTotals(isSelf)

  const { vaults: allVaultInfos } = useVaults()
  const vaultInfoByAddr = useMemo(() => {
    const map = new Map<string, VaultInfo>()
    for (const v of allVaultInfos) map.set(v.address.toLowerCase(), v)
    return map
  }, [allVaultInfos])

  const [selectedVault, setSelectedVault] = useState<{
    info: VaultInfo
    fund: { name: string; strategy: string; tagline: string }
  } | null>(null)

  const [filter, setFilter] = useState<'active' | 'pending'>('active')

  const filtered = useMemo(() => {
    if (filter === 'pending') return rows.filter((r) => r.pendingBigInt > 0n)
    return rows
  }, [rows, filter])

  if (!isSelf) {
    return (
      <div className="py-16 flex flex-col items-center gap-3">
        <div className="text-caption text-text-muted">
          Vault positions are only visible on your own profile.
        </div>
        <Link
          href={`/profile/${address}?tab=vision`}
          className="text-body font-semibold underline underline-offset-4 decoration-dotted hover:text-color-up transition-colors"
        >
          → See this wallet's Vision positions
        </Link>
      </div>
    )
  }

  if (!isChecked && rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border-light bg-white p-10 text-center">
        <div className="text-[12px] font-mono text-text-muted">Loading positions…</div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border-light bg-white p-10 text-center">
        <div className="text-[15px] font-bold text-text-primary mb-2">No vault positions</div>
        <p className="text-[13px] text-text-muted mb-6 max-w-md mx-auto leading-relaxed">
          Deposit into any Vision vault. Automated strategies trade on your behalf — you hold shares, not screens.
        </p>
        <Link
          href="/vaults"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-black text-white text-[12px] font-semibold rounded-full hover:bg-black/85 transition-colors"
        >
          Browse vaults →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sub-filter pills (Active / Pending) — Polymarket parity */}
      <div className="flex items-center gap-2">
        <FilterPill active={filter === 'active'} onClick={() => setFilter('active')}>
          Active
        </FilterPill>
        <FilterPill active={filter === 'pending'} onClick={() => setFilter('pending')}>
          Pending
        </FilterPill>
        <div className="ml-auto text-[12px] text-text-muted">
          {filtered.length} {filtered.length === 1 ? 'position' : 'positions'}
        </div>
      </div>

      {/* Stacked position cards */}
      <div className="space-y-2">
        {filtered.map((row) => {
          const sharesFloat = parseFloat(formatUnits(row.sharesBigInt, 18))
          const pendingFloat = parseFloat(formatUnits(row.pendingBigInt, 18))
          const pnlPct = sharesFloat > 0 ? (row.pnl / sharesFloat) * 100 : 0
          const isUp = row.pnl >= 0
          const info = vaultInfoByAddr.get(row.vaultAddress.toLowerCase())
          const canOpen = !!info
          const strategyLabel =
            STRATEGY_LABELS[row.strategy] || row.strategy.replace(/_/g, ' ')

          return (
            <button
              key={row.vaultAddress}
              type="button"
              disabled={!canOpen}
              onClick={() => {
                if (!info) return
                setSelectedVault({
                  info,
                  fund: { name: row.name, strategy: row.strategy, tagline: '' },
                })
              }}
              className={cn(
                'w-full text-left rounded-2xl border border-border-light bg-white px-4 sm:px-5 py-4 sm:py-5',
                'flex items-center gap-4 sm:gap-5 transition-all duration-200',
                canOpen
                  ? 'hover:border-text-muted/40 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] cursor-pointer active:scale-[0.998]'
                  : 'opacity-70 cursor-wait',
              )}
            >
              <VaultBrandTile row={row} />

              <div className="min-w-0 flex-1">
                <div className="text-[15px] sm:text-[16px] font-semibold text-text-primary leading-tight tracking-tight truncate">
                  {row.name}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-text-muted">
                  <span className="font-mono uppercase tracking-wide">{row.symbol}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{row.source}</span>
                  <span aria-hidden="true">·</span>
                  <span>{strategyLabel}</span>
                </div>
                <div className="mt-1 text-[11px] text-text-muted/80 font-mono tabular-nums">
                  {sharesFloat.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares · NAV ${row.navPerShare.toFixed(4)}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[15px] sm:text-[16px] font-semibold tabular-nums text-text-primary leading-tight">
                  ${row.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div
                  className={cn(
                    'mt-1.5 text-[12px] font-medium tabular-nums',
                    isUp ? 'text-color-up' : 'text-color-down',
                  )}
                >
                  {isUp ? '+' : '-'}${Math.abs(row.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {' '}
                  <span className="opacity-80">
                    ({isUp ? '+' : ''}{pnlPct.toFixed(2)}%)
                  </span>
                </div>
                {pendingFloat > 0 && (
                  <div className="mt-1 text-[10px] font-mono text-emerald-600 uppercase tracking-wide">
                    ${pendingFloat.toFixed(2)} pending
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Aggregate footer — quiet, low-stakes */}
      <div className="pt-2 px-1 flex items-center justify-between text-[11px] font-mono text-text-muted/80">
        <span>
          {totals.count} {totals.count === 1 ? 'vault' : 'vaults'} · ${totals.totalValue.toFixed(2)} total
        </span>
        <span className={totals.totalPnl >= 0 ? 'text-color-up' : 'text-color-down'}>
          {totals.totalPnl >= 0 ? '+' : ''}${totals.totalPnl.toFixed(2)} all-time
        </span>
      </div>

      {selectedVault && (
        <VaultActions
          vaults={[{ fund: selectedVault.fund, vault: selectedVault.info }]}
          initialIndex={0}
          onClose={() => setSelectedVault(null)}
        />
      )}
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-1.5 rounded-full text-[12px] font-semibold transition-colors',
        active
          ? 'bg-black text-white'
          : 'bg-surface text-text-secondary hover:text-black',
      )}
    >
      {children}
    </button>
  )
}
