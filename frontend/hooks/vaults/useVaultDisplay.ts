'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useSSEVisionVaults } from '@/hooks/useSSE'
import type { VaultInfo } from './useVaults'

export interface VaultDisplayVitals {
  tvl: number
  nav: number
  perf: number
}

/** Resolve TVL/NAV/perf for a vault by preferring wagmi, then SSE, then zeros.
 *  The wagmi multicall sometimes returns 0n on a freshly chunked vault before
 *  the read settles. The SSE feed always carries the same fields. Reading
 *  through this hook keeps every place that displays vault stats — featured
 *  hero, tilt card, modal header, sidebar list — in agreement at all times. */
export function useVaultDisplayResolver(): (vault: VaultInfo) => VaultDisplayVitals {
  const sseVaults = useSSEVisionVaults()
  const sseByAddress = useMemo(
    () => new Map(sseVaults.map(v => [v.address.toLowerCase(), v])),
    [sseVaults],
  )
  return (vault: VaultInfo) => {
    if (vault.totalSupply > 0n && vault.totalAssets > 0n) {
      return {
        tvl: parseFloat(formatUnits(vault.totalAssets, 18)),
        nav: vault.navPerShare,
        perf: vault.performanceSinceInception,
      }
    }
    const sse = sseByAddress.get(vault.address.toLowerCase())
    if (sse) {
      let assets = 0n
      try { assets = BigInt(sse.total_assets) } catch {}
      return {
        tvl: parseFloat(formatUnits(assets, 18)),
        nav: sse.nav_per_share,
        perf: sse.nav_per_share - 1.0,
      }
    }
    return {
      tvl: parseFloat(formatUnits(vault.totalAssets, 18)),
      nav: vault.navPerShare,
      perf: vault.performanceSinceInception,
    }
  }
}
