'use client'

import { useMemo } from 'react'
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

  // Shared hook with the profile page hero — keeps the two in perfect sync.
  const totals = useVaultsTotals(isSelf)
  const pnlColor = totals.totalPnl >= 0 ? 'text-color-up' : 'text-color-down'

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
          Deposit into any Vision vault — automated strategies trade on your behalf.
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

  return (
    <div className="space-y-4">
      {/* Totals strip */}
      <div className="grid grid-cols-3 border border-border-light bg-white">
        <div className="px-4 py-3 border-r border-border-light">
          <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted mb-0.5">Vaults</div>
          <div className="font-mono text-[16px] font-bold tabular-nums">{totals.count}</div>
        </div>
        <div className="px-4 py-3 border-r border-border-light">
          <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted mb-0.5">Total Value</div>
          <div className="font-mono text-[16px] font-bold tabular-nums">${totals.totalValue.toFixed(2)}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-text-muted mb-0.5">Total P&amp;L</div>
          <div className={cn('font-mono text-[16px] font-bold tabular-nums', pnlColor)}>
            {totals.totalPnl >= 0 ? '+' : ''}${totals.totalPnl.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="border border-border-light bg-white divide-y divide-border-light">
        {rows.map((row) => {
          const sharesFloat = parseFloat(formatUnits(row.sharesBigInt, 18))
          const pendingFloat = parseFloat(formatUnits(row.pendingBigInt, 18))
          const rowPnlColor = row.pnl >= 0 ? 'text-color-up' : 'text-color-down'

          return (
            <Link
              key={row.vaultAddress}
              href={`/source/${row.source}`}
              className="grid grid-cols-12 items-center gap-3 px-4 py-3 hover:bg-surface/40 transition-colors"
            >
              <div className="col-span-4 min-w-0">
                <div className="text-[13px] font-bold text-text-primary truncate">{row.name}</div>
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-wide">
                  {row.symbol} · {row.source} · {row.strategy.replace(/_/g, ' ')}
                </div>
              </div>

              <div className="col-span-2 text-right">
                <div className="text-[9px] font-bold tracking-[0.08em] uppercase text-text-muted">Shares</div>
                <div className="font-mono text-[12px] font-bold tabular-nums">
                  {sharesFloat.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </div>
              </div>

              <div className="col-span-2 text-right">
                <div className="text-[9px] font-bold tracking-[0.08em] uppercase text-text-muted">NAV</div>
                <div className="font-mono text-[12px] font-bold tabular-nums">
                  ${row.navPerShare.toFixed(4)}
                </div>
              </div>

              <div className="col-span-2 text-right">
                <div className="text-[9px] font-bold tracking-[0.08em] uppercase text-text-muted">Value</div>
                <div className="font-mono text-[13px] font-bold tabular-nums">${row.value.toFixed(2)}</div>
                {pendingFloat > 0 && (
                  <div className="text-[9px] font-mono text-emerald-600">
                    ${pendingFloat.toFixed(2)} pending
                  </div>
                )}
              </div>

              <div className="col-span-2 text-right">
                <div className="text-[9px] font-bold tracking-[0.08em] uppercase text-text-muted">P&amp;L</div>
                <div className={cn('font-mono text-[13px] font-bold tabular-nums', rowPnlColor)}>
                  {row.pnl >= 0 ? '+' : ''}${row.pnl.toFixed(2)}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
