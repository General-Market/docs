'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from '@/lib/wallet-shim'
import fundData from '@/data/fund-branding.json'
import { useSSEVisionVaults, type VisionVaultSSE } from '@/hooks/useSSE'
import { useOnChainVaultPositions } from '@/hooks/vaults/useOnChainVaultPositions'

export interface VaultsTotals {
  count: number
  totalValue: number
  totalPending: number
  totalPnl: number
}

function rowValues(
  vault: VisionVaultSSE | undefined,
  shares: bigint,
  pending: bigint,
): { value: number; pending: number; pnl: number } | null {
  if (shares === 0n && pending === 0n) return null

  const totalAssets = (() => { try { return BigInt(vault?.total_assets ?? '0') } catch { return 0n } })()
  const totalSupply = (() => { try { return BigInt(vault?.total_supply ?? '0') } catch { return 0n } })()
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
 * Reads positions directly on-chain via useOnChainVaultPositions; vault
 * metadata (NAV, TVL, total supply) still comes from SSE since that side of
 * the data-node stream is reliable.
 */
export function useVaultsTotals(enabled: boolean = true): VaultsTotals {
  const { address } = useAccount()
  const visionVaults = useSSEVisionVaults()
  const { shares, pending } = useOnChainVaultPositions(enabled ? address : undefined)

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
      const sharesBig = shares.get(lower) ?? 0n
      const pendingBig = pending.get(lower) ?? 0n
      const r = rowValues(vaultByAddr.get(lower), sharesBig, pendingBig)
      if (!r) continue
      count += 1
      totalValue += r.value
      totalPending += r.pending
      totalPnl += r.pnl
    }
    return { count, totalValue, totalPending, totalPnl }
  }, [enabled, vaultByAddr, shares, pending])
}
