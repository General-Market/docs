'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import fundData from '@/data/fund-branding.json'
import {
  useSSEVisionVaults,
  useSSEUserVaultPositions,
  type VisionVaultSSE,
  type VisionVaultPositionSSE,
} from '@/hooks/useSSE'

export interface VaultsTotals {
  count: number
  totalValue: number
  totalPending: number
  totalPnl: number
}

function safeBigInt(v: string | undefined): bigint {
  if (!v) return 0n
  try {
    return BigInt(v)
  } catch {
    return 0n
  }
}

function rowValues(
  vault: VisionVaultSSE | undefined,
  position: VisionVaultPositionSSE | undefined,
): { value: number; pending: number; pnl: number } | null {
  const shares = safeBigInt(position?.shares)
  const pending = safeBigInt(position?.pending_deposit)
  if (shares === 0n && pending === 0n) return null

  const totalAssets = safeBigInt(vault?.total_assets)
  const totalSupply = safeBigInt(vault?.total_supply)
  const sharesFloat = parseFloat(formatUnits(shares, 18))
  const pendingFloat = parseFloat(formatUnits(pending, 18))
  const sharesValue =
    totalSupply > 0n && shares > 0n
      ? (Number(shares) / Number(totalSupply)) * parseFloat(formatUnits(totalAssets, 18))
      : 0

  // PnL approximation: for vaults that started at NAV=1.0 and for early depositors,
  // shares-as-float ≈ initial deposit, so (sharesValue - sharesFloat) ≈ profit.
  // Pending deposits contribute zero PnL — the money isn't invested yet.
  const pnl = shares > 0n ? sharesValue - sharesFloat : 0

  return {
    value: sharesValue + pendingFloat,
    pending: pendingFloat,
    pnl,
  }
}

/**
 * Aggregates the connected wallet's vault positions into running totals.
 * Shared by `VaultsTab` (row display) and the profile page hero (headline PnL chart).
 */
export function useVaultsTotals(enabled: boolean = true): VaultsTotals {
  const visionVaults = useSSEVisionVaults()
  const vaultPositions = useSSEUserVaultPositions()

  const vaultByAddr = useMemo(() => {
    const map = new Map<string, VisionVaultSSE>()
    for (const v of visionVaults) map.set(v.address.toLowerCase(), v)
    return map
  }, [visionVaults])

  return useMemo<VaultsTotals>(() => {
    if (!enabled) return { count: 0, totalValue: 0, totalPending: 0, totalPnl: 0 }
    const funds = (fundData as { funds: Array<{ vault?: string }> }).funds.filter((f) => !!f.vault)
    let count = 0
    let totalValue = 0
    let totalPending = 0
    let totalPnl = 0
    for (const fund of funds) {
      const lower = (fund.vault as string).toLowerCase()
      const r = rowValues(vaultByAddr.get(lower), vaultPositions[lower])
      if (!r) continue
      count += 1
      totalValue += r.value
      totalPending += r.pending
      totalPnl += r.pnl
    }
    return { count, totalValue, totalPending, totalPnl }
  }, [enabled, vaultByAddr, vaultPositions])
}
