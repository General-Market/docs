'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import fundData from '@/data/fund-branding.json'
import { useSSEVisionVaults, type VisionVaultSSE } from '@/hooks/useSSE'
import { useOnChainVaultPositions } from '@/hooks/vaults/useOnChainVaultPositions'
import { useVaults, type VaultInfo } from '@/hooks/vaults/useVaults'

export interface VaultsTotals {
  count: number
  totalValue: number
  totalPending: number
  totalPnl: number
  /** True while at least one held vault is missing both wagmi and SSE pricing. */
  pricingIncomplete: boolean
}

function rowValues(
  vaultInfo: VaultInfo | undefined,
  vault: VisionVaultSSE | undefined,
  shares: bigint,
  pending: bigint,
): { value: number; pending: number; pnl: number; vaultLoading: boolean } | null {
  if (shares === 0n && pending === 0n) return null

  // Prefer the wagmi on-chain read — SSE can go silent (data-node registry
  // mis-path, restart). Fall back to SSE, then to a "pricing unknown" state.
  let totalAssets = 0n
  let totalSupply = 0n
  let pricingKnown = false

  if (vaultInfo && vaultInfo.totalSupply > 0n) {
    totalAssets = vaultInfo.totalAssets
    totalSupply = vaultInfo.totalSupply
    pricingKnown = true
  } else if (vault && vault.total_supply && vault.total_supply !== '0') {
    try { totalAssets = BigInt(vault.total_assets) } catch {}
    try { totalSupply = BigInt(vault.total_supply) } catch {}
    pricingKnown = totalSupply > 0n
  }

  const sharesFloat = parseFloat(formatUnits(shares, 18))
  const pendingFloat = parseFloat(formatUnits(pending, 18))
  const sharesValue =
    pricingKnown && shares > 0n
      ? (Number(shares) / Number(totalSupply)) * parseFloat(formatUnits(totalAssets, 18))
      : 0

  // Approximation: vaults start at NAV=1.0, so shares-as-float ≈ principal.
  // Skipped when pricing is unknown — otherwise we'd report PnL ≈ −principal.
  const pnl = pricingKnown && shares > 0n ? sharesValue - sharesFloat : 0

  return {
    value: pricingKnown ? sharesValue + pendingFloat : pendingFloat,
    pending: pendingFloat,
    pnl,
    vaultLoading: !pricingKnown,
  }
}

/**
 * Aggregates the connected wallet's vault positions into running totals.
 * Prices positions with the wagmi multicall first, falling back to SSE so a
 * silent data-node registry can't make the footer pretend the wallet is empty.
 */
export function useVaultsTotals(enabled: boolean = true): VaultsTotals {
  const { address } = useAccount()
  const visionVaults = useSSEVisionVaults()
  const { shares, pending } = useOnChainVaultPositions(enabled ? address : undefined)
  const { vaults: allVaultInfos } = useVaults()

  const vaultByAddr = useMemo(() => {
    const map = new Map<string, VisionVaultSSE>()
    for (const v of visionVaults) map.set(v.address.toLowerCase(), v)
    return map
  }, [visionVaults])

  const vaultInfoByAddr = useMemo(() => {
    const map = new Map<string, VaultInfo>()
    for (const v of allVaultInfos) map.set(v.address.toLowerCase(), v)
    return map
  }, [allVaultInfos])

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
      const r = rowValues(vaultInfoByAddr.get(lower), vaultByAddr.get(lower), sharesBig, pendingBig)
      if (!r) continue
      count += 1
      totalValue += r.value
      totalPending += r.pending
      totalPnl += r.pnl
      if (r.vaultLoading) pricingIncomplete = true
    }
    return { count, totalValue, totalPending, totalPnl, pricingIncomplete }
  }, [enabled, vaultByAddr, vaultInfoByAddr, shares, pending])
}
