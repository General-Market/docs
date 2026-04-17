'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useSSEVisionVaults, useSSEVisionVault } from '@/hooks/useSSE'
import { useVaultHistory } from './useVaultHistory'
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

/** Per-vault effective vitals with history fallback.
 *
 *  Priority: live wagmi → live SSE → last historical snapshot → zeros.
 *  The modal header and detail body both consult this so the two can't drift
 *  apart when the wagmi multicall returns 0 on a vault that already has
 *  users — i.e. the case where the header read "TVL $0 / NAV $1.0000" next
 *  to a body showing "$10K / $1.0010". One source, everywhere.
 */
export function useEffectiveVaultVitals(vault: VaultInfo): VaultDisplayVitals {
  const sse = useSSEVisionVault(vault.address)
  const { snapshots } = useVaultHistory(vault.address)

  return useMemo(() => {
    const liveHasSupply = vault.totalSupply > 0n
    const liveHasAssets = vault.totalAssets > 0n

    if (liveHasSupply && liveHasAssets) {
      return {
        tvl: parseFloat(formatUnits(vault.totalAssets, 18)),
        nav: vault.navPerShare,
        perf: vault.performanceSinceInception,
      }
    }

    if (sse) {
      let assets = 0n
      try { assets = BigInt(sse.total_assets) } catch {}
      if (assets > 0n) {
        return {
          tvl: parseFloat(formatUnits(assets, 18)),
          nav: sse.nav_per_share,
          perf: sse.nav_per_share - 1.0,
        }
      }
    }

    const last = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
    if (last) {
      return {
        tvl: last.tvl,
        nav: last.nav,
        perf: last.nav - 1.0,
      }
    }

    return {
      tvl: parseFloat(formatUnits(vault.totalAssets, 18)),
      nav: vault.navPerShare,
      perf: vault.performanceSinceInception,
    }
  }, [
    vault.address,
    vault.totalAssets,
    vault.totalSupply,
    vault.navPerShare,
    vault.performanceSinceInception,
    sse?.total_assets,
    sse?.nav_per_share,
    snapshots,
  ])
}
