'use client'

import { useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { Link } from '@/i18n/routing'
import fundData from '@/data/fund-branding.json'
import {
  useSSEVisionVaults,
  useSSEUserVaultPositions,
  type VisionVaultSSE,
  type VisionVaultPositionSSE,
} from '@/hooks/useSSE'
import { useVaultsTotals } from '@/hooks/useVaultsTotals'
import { useAutoClaimPendingDeposits } from '@/hooks/vaults/useAutoClaimPendingDeposits'
import { useVaults, type VaultInfo } from '@/hooks/vaults/useVaults'
import { VaultActions } from '@/components/domain/vaults/VaultActions'
import { cn } from '@/lib/utils/cn'

interface VaultsTabProps {
  address: string
}

type SortKey = 'name' | 'shares' | 'nav' | 'value' | 'pnl'
type SortDir = 'asc' | 'desc'

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
  sourceName: string
}

function safeBigInt(v: string | undefined): bigint {
  if (!v) return 0n
  try { return BigInt(v) } catch { return 0n }
}

function computeRow(
  fund: any,
  vault: VisionVaultSSE | undefined,
  position: VisionVaultPositionSSE | undefined,
): VaultRow | null {
  const sharesBigInt = safeBigInt(position?.shares)
  const pendingBigInt = safeBigInt(position?.pending_deposit)
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
    sourceName: fund.source,
    strategy: fund.strategy,
    sharesBigInt,
    pendingBigInt,
    value: sharesValue + pendingFloat,
    pnl: sharesBigInt > 0n ? sharesValue - sharesFloat : 0,
    navPerShare,
  }
}

export function VaultsTab({ address }: VaultsTabProps) {
  const { address: connectedAddress } = useAccount()
  const visionVaults = useSSEVisionVaults()
  const vaultPositions = useSSEUserVaultPositions()

  const isSelf = !!connectedAddress && connectedAddress.toLowerCase() === address.toLowerCase()

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
      const position = vaultPositions[lower]
      const row = computeRow(fund, vault, position)
      if (row) result.push(row)
    }
    // Largest position first.
    result.sort((a, b) => b.value - a.value)
    return result
  }, [isSelf, vaultByAddr, vaultPositions])

  // Shared hook with the profile page hero, keeps the two in perfect sync.
  const totals = useVaultsTotals(isSelf)
  const pnlColor = totals.totalPnl >= 0 ? 'text-color-up' : 'text-color-down'

  // Self-healing: any pending deposit the initial flow failed to claim gets
  // cleaned up here. Enabled only for the user's own profile.
  const autoClaim = useAutoClaimPendingDeposits(isSelf)

  // Full on-chain vault metadata for the modal. Indexed by lowercased address.
  const { vaults: allVaultInfos } = useVaults()
  const vaultInfoByAddr = useMemo(() => {
    const map = new Map<string, VaultInfo>()
    for (const v of allVaultInfos) map.set(v.address.toLowerCase(), v)
    return map
  }, [allVaultInfos])

  // Modal state: which row the user opened, if any.
  const [selectedVault, setSelectedVault] = useState<{
    info: VaultInfo
    fund: { name: string; strategy: string; tagline: string }
  } | null>(null)

  // Sort state — defaults to value desc (largest position first).
  const [sortKey, setSortKey] = useState<SortKey>('value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  if (!isSelf) {
    return (
      <div className="py-16 text-center text-caption text-text-muted">
        Vault positions are only visible on your own profile.
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="border border-border-light p-8 text-center">
        <div className="text-[14px] font-black text-text-primary mb-2">No vault positions</div>
        <p className="text-[12px] text-text-muted mb-5">
          Deposit into any Vision vault, automated strategies trade on your behalf.
        </p>
        <Link
          href="/vaults"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-black text-white text-[12px] font-bold hover:bg-black/80 transition-colors"
        >
          BROWSE VAULTS →
        </Link>
      </div>
    )
  }

  const sortedRows = useMemo(() => {
    const list = [...rows]
    list.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'shares': cmp = Number(a.sharesBigInt - b.sharesBigInt); break
        case 'nav': cmp = a.navPerShare - b.navPerShare; break
        case 'value': cmp = a.value - b.value; break
        case 'pnl': cmp = a.pnl - b.pnl; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [rows, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const SortArrow = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null
    return (
      <span className="ml-0.5 text-[8px] text-text-primary">
        {sortDir === 'asc' ? '▲' : '▼'}
      </span>
    )
  }

  const COLS = 'grid grid-cols-[24px_minmax(0,4fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)] items-center gap-2 px-3'

  return (
    <div className="space-y-1.5">
      {/* Compact totals strip — single horizontal bar */}
      <div className="flex items-center gap-6 px-3 py-1.5 border border-border-light bg-[#fafafa] text-[11px]">
        <div className="flex items-baseline gap-1.5">
          <span className="font-bold uppercase tracking-[0.08em] text-text-muted text-[9px]">Vaults</span>
          <span className="font-mono font-bold tabular-nums text-text-primary">{totals.count}</span>
        </div>
        <div className="h-3 w-px bg-border-light" />
        <div className="flex items-baseline gap-1.5">
          <span className="font-bold uppercase tracking-[0.08em] text-text-muted text-[9px]">Value</span>
          <span className="font-mono font-bold tabular-nums text-text-primary">${totals.totalValue.toFixed(2)}</span>
        </div>
        <div className="h-3 w-px bg-border-light" />
        <div className="flex items-baseline gap-1.5">
          <span className="font-bold uppercase tracking-[0.08em] text-text-muted text-[9px]">P&amp;L</span>
          <span className={cn('font-mono font-bold tabular-nums', pnlColor)}>
            {totals.totalPnl >= 0 ? '+' : ''}${totals.totalPnl.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Data table */}
      <div className="border border-border-light bg-white">
        {/* Sortable column header */}
        <div className={cn(COLS, 'py-1.5 bg-[#f0f0f0] border-b border-border-light text-[9px] font-bold uppercase tracking-[0.08em] text-text-muted select-none')}>
          <div className="text-center">#</div>
          <button type="button" onClick={() => handleSort('name')} className="text-left hover:text-text-primary transition-colors">
            Vault<SortArrow col="name" />
          </button>
          <button type="button" onClick={() => handleSort('shares')} className="text-right hover:text-text-primary transition-colors">
            Shares<SortArrow col="shares" />
          </button>
          <button type="button" onClick={() => handleSort('nav')} className="text-right hover:text-text-primary transition-colors">
            NAV<SortArrow col="nav" />
          </button>
          <button type="button" onClick={() => handleSort('value')} className="text-right hover:text-text-primary transition-colors">
            Value<SortArrow col="value" />
          </button>
          <button type="button" onClick={() => handleSort('pnl')} className="text-right hover:text-text-primary transition-colors">
            P&amp;L<SortArrow col="pnl" />
          </button>
        </div>

        {/* Body rows */}
        {sortedRows.map((row, idx) => {
          const sharesFloat = parseFloat(formatUnits(row.sharesBigInt, 18))
          const pendingFloat = parseFloat(formatUnits(row.pendingBigInt, 18))
          const rowPnlColor = row.pnl >= 0 ? 'text-color-up' : 'text-color-down'

          const info = vaultInfoByAddr.get(row.vaultAddress.toLowerCase())
          const canOpenModal = !!info
          return (
            <button
              key={row.vaultAddress}
              type="button"
              disabled={!canOpenModal}
              onClick={() => {
                if (!info) return
                setSelectedVault({
                  info,
                  fund: {
                    name: row.name,
                    strategy: row.strategy,
                    tagline: '',
                  },
                })
              }}
              className={cn(
                COLS,
                'py-1.5 text-left w-full border-b border-border-light/60 last:border-b-0 transition-colors',
                idx % 2 === 1 && 'bg-[#fafafa]',
                canOpenModal
                  ? 'hover:bg-[#eaf3ff] cursor-pointer'
                  : 'opacity-70 cursor-wait',
              )}
            >
              <div className="text-center text-[10px] font-mono text-text-muted tabular-nums">
                {idx + 1}
              </div>

              <div className="min-w-0">
                <div className="text-[12px] font-bold text-text-primary truncate leading-tight">{row.name}</div>
                <div className="text-[9px] font-mono text-text-muted uppercase tracking-wide truncate leading-tight">
                  {row.symbol} · {row.source} · {row.strategy.replace(/_/g, ' ')}
                </div>
              </div>

              <div className="text-right font-mono text-[11px] font-bold tabular-nums text-text-primary">
                {sharesFloat.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </div>

              <div className="text-right font-mono text-[11px] tabular-nums text-text-secondary">
                ${row.navPerShare.toFixed(4)}
              </div>

              <div className="text-right">
                <div className="font-mono text-[12px] font-bold tabular-nums text-text-primary leading-tight">
                  ${row.value.toFixed(2)}
                </div>
                {pendingFloat > 0 && (() => {
                  const isClaiming =
                    autoClaim.claiming?.toLowerCase() === row.vaultAddress.toLowerCase()
                  const hasFailed = autoClaim.failedVaults.has(row.vaultAddress.toLowerCase())
                  return (
                    <div
                      className={cn(
                        'text-[9px] font-mono leading-tight',
                        isClaiming
                          ? 'text-amber-600'
                          : hasFailed
                            ? 'text-color-down'
                            : 'text-emerald-600',
                      )}
                    >
                      ${pendingFloat.toFixed(2)} {isClaiming ? 'claiming…' : hasFailed ? 'failed' : 'pending'}
                    </div>
                  )
                })()}
              </div>

              <div className={cn('text-right font-mono text-[12px] font-bold tabular-nums', rowPnlColor)}>
                {row.pnl >= 0 ? '+' : ''}${row.pnl.toFixed(2)}
              </div>
            </button>
          )
        })}
      </div>

      {/* Vault detail modal, same component the source page uses */}
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
