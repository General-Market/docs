'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import fundData from '@/data/fund-branding.json'
import { useSSEVisionVaults, type VisionVaultSSE } from '@/hooks/useSSE'
import { useOnChainVaultPositions } from '@/hooks/vaults/useOnChainVaultPositions'

export interface VaultsTotals {
  count: number
  totalValue: number
  totalPending: number
  totalPnl: number
  /** True while at least one held vault is missing its SSE NAV snapshot. */
  pricingIncomplete: boolean
}

function rowValues(
  vault: VisionVaultSSE | undefined,
  shares: bigint,
  pending: bigint,
): { value: number; pending: number; pnl: number; vaultLoading: boolean } | null {
  if (shares === 0n && pending === 0n) return null

  // SSE hasn't shipped this vault's NAV yet (or the data-node lost the registry).
  // We can still surface pending USDC, but the share-side value is unknown —
  // returning 0 here would have the aggregate footer claim "−$X all-time".
  const vaultLoading = !vault || !vault.total_supply || vault.total_supply === '0'

  const totalAssets = (() => { try { return BigInt(vault?.total_assets ?? '0') } catch { return 0n } })()
  const totalSupply = (() => { try { return BigInt(vault?.total_supply ?? '0') } catch { return 0n } })()
  const sharesFloat = parseFloat(formatUnits(shares, 18))
  const pendingFloat = parseFloat(formatUnits(pending, 18))
  const sharesValue =
    !vaultLoading && totalSupply > 0n && shares > 0n
      ? (Number(shares) / Number(totalSupply)) * parseFloat(formatUnits(totalAssets, 18))
      : 0

  // Approximation: vaults start at NAV=1.0, so shares-as-float ≈ principal.
  // Skipped while vaultLoading — otherwise we'd report PnL ≈ −principal.
  const pnl = !vaultLoading && shares > 0n ? sharesValue - sharesFloat : 0

  return {
    value: vaultLoading ? pendingFloat : sharesValue + pendingFloat,
    pending: pendingFloat,
    pnl,
    vaultLoading,
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
    if (!enabled) {
      return { count: 0, totalValue: 0, totalPending: 0, totalPnl: 0, pricingIncomplete: false }
    }
    const funds = (fundData as { funds: Array<{ vault?: string }> }).funds.filter((f) => !!f.vault)
    let count = 0
    let totalValue = 0
    let totalPending = 0
    let totalPnl = 0
    let pricingIncomplete = false
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
      if (r.vaultLoading) pricingIncomplete = true
    }
    return { count, totalValue, totalPending, totalPnl, pricingIncomplete }
  }, [enabled, vaultByAddr, shares, pending])
}
