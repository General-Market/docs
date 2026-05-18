'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { Link } from '@/i18n/routing'
import fundData from '@/data/fund-branding.json'
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
  /** True when SSE hasn't shipped this vault's NAV yet — render dashes, not zero. */
  vaultLoading: boolean
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

// Source icon path. Small square brand marks live under /source-imgs/icons.
function sourceIconUrl(source: string): string {
  return `/source-imgs/icons/${source}.png`
}

function VaultBrandTile({ row }: { row: VaultRow }) {
  // Square Polymarket-style tile, then masked to a circle. Background
  // tinted by the fund color so the chip never looks empty even when the
  // icon image is missing.
  const initials = row.symbol.slice(0, 2)
  return (
    <div
      className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-[14px] tracking-tight relative"
      style={{
        background: row.color,
        letterSpacing: 'var(--apple-track-tighter)',
      }}
    >
      <span aria-hidden="true">{initials}</span>
      <Image
        src={sourceIconUrl(row.source)}
        alt=""
        width={56}
        height={56}
        className="absolute inset-0 w-full h-full object-cover"
        unoptimized
        onError={(e) => {
          // Fall back to the initials underneath when the file 404s.
          ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
        }}
      />
    </div>
  )
}

function computeRow(
  fund: { vault: string; name: string; symbol: string; source: string; strategy: string; color?: string },
  vaultInfo: VaultInfo | undefined,
  vault: VisionVaultSSE | undefined,
  sharesBigInt: bigint,
  pendingBigInt: bigint,
): VaultRow | null {
  if (sharesBigInt === 0n && pendingBigInt === 0n) return null

  // Prefer the wagmi on-chain read — SSE can go silent (data-node registry
  // mis-path, restart). Fall back to SSE, then to the loading-dashes state.
  let totalAssets = 0n
  let totalSupply = 0n
  let navPerShare = 1.0
  let pricingKnown = false

  if (vaultInfo && vaultInfo.totalSupply > 0n) {
    totalAssets = vaultInfo.totalAssets
    totalSupply = vaultInfo.totalSupply
    navPerShare = vaultInfo.navPerShare
    pricingKnown = true
  } else if (vault && vault.total_supply && vault.total_supply !== '0') {
    totalAssets = safeBigInt(vault.total_assets)
    totalSupply = safeBigInt(vault.total_supply)
    navPerShare = vault.nav_per_share ?? 1.0
    pricingKnown = totalSupply > 0n
  }

  const sharesFloat = parseFloat(formatUnits(sharesBigInt, 18))
  const pendingFloat = parseFloat(formatUnits(pendingBigInt, 18))
  const sharesValue =
    pricingKnown && sharesBigInt > 0n
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
    value: pricingKnown ? sharesValue + pendingFloat : Number.NaN,
    pnl: pricingKnown && sharesBigInt > 0n ? sharesValue - sharesFloat : Number.NaN,
    navPerShare,
    color: fund.color || '#1d1d1f',
    vaultLoading: !pricingKnown,
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

  const { vaults: allVaultInfos } = useVaults()
  const vaultInfoByAddr = useMemo(() => {
    const map = new Map<string, VaultInfo>()
    for (const v of allVaultInfos) map.set(v.address.toLowerCase(), v)
    return map
  }, [allVaultInfos])

  const rows = useMemo<VaultRow[]>(() => {
    if (!isSelf) return []
    const funds = (fundData as { funds: Array<{ vault?: string; name: string; symbol: string; source: string; strategy: string; color?: string }> })
      .funds.filter((f) => !!f.vault)
    const result: VaultRow[] = []
    for (const fund of funds) {
      const lower = (fund.vault as string).toLowerCase()
      const sharesBig = onChainShares.get(lower) ?? 0n
      const pendingBig = onChainPending.get(lower) ?? 0n
      const row = computeRow(
        fund as { vault: string; name: string; symbol: string; source: string; strategy: string; color?: string },
        vaultInfoByAddr.get(lower),
        vaultByAddr.get(lower),
        sharesBig,
        pendingBig,
      )
      if (row) result.push(row)
    }
    result.sort((a, b) => b.value - a.value)
    return result
  }, [isSelf, vaultByAddr, vaultInfoByAddr, onChainShares, onChainPending])

  const totals = useVaultsTotals(isSelf)

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
      <div
        className="py-16 flex flex-col items-center gap-3"
        style={{ fontFamily: 'var(--apple-font-text)' }}
      >
        <div
          style={{
            color: 'var(--apple-text-tertiary)',
            fontSize: 'var(--apple-fs-14)',
            letterSpacing: 'var(--apple-track-mid)',
          }}
        >
          Vault positions are only visible on your own profile.
        </div>
        <Link
          href={`/profile/${address}?tab=vision`}
          className="font-semibold underline underline-offset-4 decoration-dotted transition-colors"
          style={{
            color: 'var(--apple-accent)',
            fontSize: 'var(--apple-fs-14)',
            letterSpacing: 'var(--apple-track-tight)',
          }}
        >
          See this wallet&rsquo;s Vision positions →
        </Link>
      </div>
    )
  }

  if (!isChecked && rows.length === 0) {
    return (
      <div
        className="text-center"
        style={{
          background: 'var(--apple-panel)',
          border: '1px solid var(--apple-border)',
          borderRadius: 'var(--apple-r-md)',
          padding: '40px',
          color: 'var(--apple-text-tertiary)',
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-14)',
          letterSpacing: 'var(--apple-track-mid)',
        }}
      >
        Loading positions…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div
        className="text-center"
        style={{
          background: 'var(--apple-panel)',
          border: '1px solid var(--apple-border)',
          borderRadius: 'var(--apple-r-md)',
          padding: '48px 32px',
          fontFamily: 'var(--apple-font-text)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'var(--apple-fs-21)',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text)',
            marginBottom: 8,
            fontWeight: 600,
          }}
        >
          No vault positions
        </div>
        <p
          style={{
            color: 'var(--apple-text-secondary)',
            fontSize: 'var(--apple-fs-14)',
            letterSpacing: 'var(--apple-track-mid)',
            lineHeight: 1.4706,
            maxWidth: 400,
            margin: '0 auto 20px',
          }}
        >
          Deposit into any Vision vault. Automated strategies trade on your behalf — you hold shares, not screens.
        </p>
        <Link
          href="/vaults"
          className="inline-flex items-center gap-1.5 transition-opacity"
          style={{
            background: 'var(--apple-accent)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 'var(--apple-r-pill)',
            fontSize: 'var(--apple-fs-14)',
            fontWeight: 500,
            letterSpacing: 'var(--apple-track-mid)',
          }}
        >
          Browse vaults →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5" style={{ fontFamily: 'var(--apple-font-text)' }}>
      {/* Sub-filter pills (Active / Pending) */}
      <div className="flex items-center gap-2">
        <FilterPill active={filter === 'active'} onClick={() => setFilter('active')}>
          Active
        </FilterPill>
        <FilterPill active={filter === 'pending'} onClick={() => setFilter('pending')}>
          Pending
        </FilterPill>
        <div
          className="ml-auto"
          style={{
            color: 'var(--apple-text-tertiary)',
            fontSize: 'var(--apple-fs-12)',
            letterSpacing: 'var(--apple-track-loose)',
          }}
        >
          {filtered.length} {filtered.length === 1 ? 'position' : 'positions'}
        </div>
      </div>

      {/* Stacked position cards — Polymarket-shaped, Apple-spaced */}
      <div className="space-y-2.5">
        {filtered.map((row) => {
          const sharesFloat = parseFloat(formatUnits(row.sharesBigInt, 18))
          const pendingFloat = parseFloat(formatUnits(row.pendingBigInt, 18))
          const hasPnl = !row.vaultLoading && Number.isFinite(row.pnl)
          const pnlPct = hasPnl && sharesFloat > 0 ? (row.pnl / sharesFloat) * 100 : 0
          const isUp = hasPnl ? row.pnl >= 0 : true
          const info = vaultInfoByAddr.get(row.vaultAddress.toLowerCase())
          const canOpen = !!info
          const strategyLabel =
            STRATEGY_LABELS[row.strategy] || row.strategy.replace(/_/g, ' ')
          const pnlColor = isUp ? 'rgb(52,199,89)' : 'rgb(255,59,48)'

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
                'w-full text-left flex items-center gap-4 sm:gap-5',
                canOpen ? 'cursor-pointer' : 'opacity-70 cursor-wait',
              )}
              style={{
                background: 'var(--apple-panel)',
                border: '1px solid var(--apple-border)',
                borderRadius: 'var(--apple-r-md)',
                padding: '20px 24px',
                transition:
                  'transform 240ms var(--apple-ease-default), box-shadow 240ms var(--apple-ease-default), border-color 240ms var(--apple-ease-default)',
              }}
              onMouseEnter={(e) => {
                if (!canOpen) return
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
                  'var(--apple-shadow-card)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                  'rgba(0,0,0,0.12)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                  'var(--apple-border)'
              }}
            >
              <VaultBrandTile row={row} />

              <div className="min-w-0 flex-1">
                <div
                  className="truncate"
                  style={{
                    fontFamily: 'var(--apple-font-display)',
                    fontSize: 'var(--apple-fs-17)',
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-tighter)',
                    color: 'var(--apple-text)',
                    lineHeight: 1.2105,
                  }}
                >
                  {row.name}
                </div>
                <div
                  className="mt-1.5"
                  style={{
                    color: 'var(--apple-text-secondary)',
                    fontSize: 'var(--apple-fs-12)',
                    letterSpacing: 'var(--apple-track-loose)',
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                    {row.symbol}
                  </span>{' '}
                  · <span className="capitalize">{row.source}</span> · {strategyLabel}
                </div>
                <div
                  className="mt-1 tabular-nums"
                  style={{
                    color: 'var(--apple-text-tertiary)',
                    fontSize: '11px',
                    letterSpacing: 'var(--apple-track-loose)',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                  }}
                >
                  {sharesFloat.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares · NAV ${row.navPerShare.toFixed(4)}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div
                  className="tabular-nums"
                  style={{
                    fontFamily: 'var(--apple-font-display)',
                    fontSize: 'var(--apple-fs-17)',
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-tighter)',
                    color: 'var(--apple-text)',
                    lineHeight: 1.2105,
                  }}
                >
                  {row.vaultLoading
                    ? '—'
                    : `$${row.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
                <div
                  className="mt-1.5 tabular-nums"
                  style={{
                    color: hasPnl ? pnlColor : 'var(--apple-text-tertiary)',
                    fontSize: 'var(--apple-fs-12)',
                    fontWeight: 500,
                    letterSpacing: 'var(--apple-track-mid)',
                  }}
                >
                  {hasPnl ? (
                    <>
                      {isUp ? '+' : '-'}${Math.abs(row.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      <span style={{ opacity: 0.85 }}>
                        ({isUp ? '+' : ''}{pnlPct.toFixed(2)}%)
                      </span>
                    </>
                  ) : (
                    'NAV loading…'
                  )}
                </div>
                {pendingFloat > 0 && (
                  <div
                    className="mt-1 uppercase tabular-nums"
                    style={{
                      color: 'rgb(52,199,89)',
                      fontSize: '10px',
                      letterSpacing: '+0.011em',
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                    }}
                  >
                    ${pendingFloat.toFixed(2)} pending
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Aggregate footer — quiet, low-stakes */}
      <div
        className="pt-2 px-1 flex items-center justify-between"
        style={{
          color: 'var(--apple-text-tertiary)',
          fontSize: '11px',
          letterSpacing: 'var(--apple-track-loose)',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
        }}
      >
        <span>
          {totals.count} {totals.count === 1 ? 'vault' : 'vaults'} ·{' '}
          {totals.pricingIncomplete
            ? 'value loading…'
            : `$${totals.totalValue.toFixed(2)} total`}
        </span>
        {totals.pricingIncomplete ? (
          <span>—</span>
        ) : (
          <span style={{ color: totals.totalPnl >= 0 ? 'rgb(52,199,89)' : 'rgb(255,59,48)' }}>
            {totals.totalPnl >= 0 ? '+' : ''}${totals.totalPnl.toFixed(2)} all-time
          </span>
        )}
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
      className="transition-colors"
      style={{
        padding: '6px 16px',
        borderRadius: 'var(--apple-r-pill)',
        background: active ? 'var(--apple-text)' : 'transparent',
        color: active ? '#fff' : 'var(--apple-text-secondary)',
        border: active ? '1px solid var(--apple-text)' : '1px solid var(--apple-border)',
        fontSize: 'var(--apple-fs-12)',
        fontWeight: 500,
        letterSpacing: 'var(--apple-track-mid)',
        fontFamily: 'var(--apple-font-text)',
      }}
    >
      {children}
    </button>
  )
}
