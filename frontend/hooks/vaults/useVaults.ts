'use client'

import { useMemo } from 'react'
import { useReadContracts } from 'wagmi'
import { formatUnits } from 'viem'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { useDeployment } from '@/hooks/useDeployment'
import { indexL3 } from '@/lib/wagmi'
import fundData from '@/data/fund-branding.json'

export interface VaultInfo {
  address: `0x${string}`
  name: string
  symbol: string
  manager: `0x${string}`
  performanceFeeRate: bigint
  highWaterMark: bigint
  totalAssets: bigint
  totalSupply: bigint
  totalActiveCapital: bigint
  /** NAV per share (float, 1.0 = $1) */
  navPerShare: number
  /** Performance since inception as decimal (0.05 = +5%) */
  performanceSinceInception: number
  /** TVL formatted as string */
  tvlFormatted: string
  /** Deployed capital ratio (0-1) */
  deployedRatio: number
}

const FIELDS_PER_VAULT = 8
const CHUNK_SIZE = 50

/** All vault addresses the frontend knows how to render, derived from
 *  fund-branding.json. This is the canonical list — VisionVaultFactory was
 *  redundant in practice (a vault without a fund-branding entry has no name,
 *  no description, no sparkline) and unreliable in production (the factory
 *  address in deployment.json drifted to a contract with no code, leaving
 *  every TVL/Perf at zero). */
const ALL_FUND_VAULT_ADDRESSES: `0x${string}`[] = (fundData as { funds: { vault?: string }[] }).funds
  .filter((f) => !!f.vault)
  .map((f) => (f.vault as string).toLowerCase() as `0x${string}`)

function buildVaultCalls(addresses: `0x${string}`[]) {
  return addresses.flatMap((addr) => [
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'name' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'symbol' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'manager' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'performanceFeeRate' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'highWaterMark' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'totalAssets' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'totalSupply' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'totalActiveCapital' as const, chainId: indexL3.id },
  ])
}

function parseVaults(addresses: `0x${string}`[], results: { status: string; result: unknown }[]): VaultInfo[] {
  const vaults: VaultInfo[] = []
  for (let i = 0; i < addresses.length; i++) {
    const base = i * FIELDS_PER_VAULT
    const chunk = results.slice(base, base + FIELDS_PER_VAULT)
    if (chunk.some((r) => r.status === 'failure')) continue

    const name = chunk[0].result as string
    const symbol = chunk[1].result as string
    const manager = chunk[2].result as `0x${string}`
    const performanceFeeRate = chunk[3].result as bigint
    const highWaterMark = chunk[4].result as bigint
    const totalAssets = chunk[5].result as bigint
    const totalSupply = chunk[6].result as bigint
    const totalActiveCapital = chunk[7].result as bigint

    const navPerShare = totalSupply > 0n ? Number(totalAssets) / Number(totalSupply) : 1.0
    const performanceSinceInception = navPerShare - 1.0
    const tvlFloat = parseFloat(formatUnits(totalAssets, 18))
    const tvlFormatted = tvlFloat.toLocaleString(undefined, { maximumFractionDigits: 2 })
    const deployedRatio = totalAssets > 0n ? Number(totalActiveCapital) / Number(totalAssets) : 0

    vaults.push({
      address: addresses[i],
      name, symbol, manager,
      performanceFeeRate, highWaterMark,
      totalAssets, totalSupply, totalActiveCapital,
      navPerShare, performanceSinceInception, tvlFormatted, deployedRatio,
    })
  }
  return vaults
}

/** Chunk 0: addresses[0..49], chunk 1: addresses[50..99], etc. */
function useVaultChunk(addresses: `0x${string}`[], chunkIndex: number, enabled: boolean) {
  const start = chunkIndex * CHUNK_SIZE
  const slice = addresses.slice(start, start + CHUNK_SIZE)

  return useReadContracts({
    contracts: buildVaultCalls(slice) as any,
    allowFailure: true,
    query: { enabled: enabled && slice.length > 0 },
  })
}

export function useVaults() {
  const { whitelistedVaults } = useDeployment()

  const addresses = useMemo(() => {
    if (whitelistedVaults.length === 0) return ALL_FUND_VAULT_ADDRESSES
    const allowed = new Set(whitelistedVaults)
    return ALL_FUND_VAULT_ADDRESSES.filter((a) => allowed.has(a))
  }, [whitelistedVaults])

  const { vaults, isLoading, refetch } = useVaultsByAddresses(addresses)

  const totalTvl = vaults.reduce((sum, v) => sum + v.totalAssets, 0n)
  const totalTvlFormatted = parseFloat(formatUnits(totalTvl, 18)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })

  return {
    vaults,
    totalTvl,
    totalTvlFormatted,
    isLoading,
    refetch,
  }
}

/**
 * Read VaultInfo for an explicit list of vault addresses, bypassing the
 * factory. Useful when the calling surface already knows which vaults it
 * needs (e.g. the source page reading from fund-branding.json) and shouldn't
 * pay for a `getAllVaults()` call — or, more pointedly, when the factory
 * address in deployment.json is stale and `getAllVaults()` returns nothing.
 *
 * Same chunking budget as useVaults: 10 × 50 = 500 vaults max.
 */
export function useVaultsByAddresses(addresses: `0x${string}`[]) {
  const enabled = addresses.length > 0
  const chunk0 = useVaultChunk(addresses, 0, enabled)
  const chunk1 = useVaultChunk(addresses, 1, enabled)
  const chunk2 = useVaultChunk(addresses, 2, enabled)
  const chunk3 = useVaultChunk(addresses, 3, enabled)
  const chunk4 = useVaultChunk(addresses, 4, enabled)
  const chunk5 = useVaultChunk(addresses, 5, enabled)
  const chunk6 = useVaultChunk(addresses, 6, enabled)
  const chunk7 = useVaultChunk(addresses, 7, enabled)
  const chunk8 = useVaultChunk(addresses, 8, enabled)
  const chunk9 = useVaultChunk(addresses, 9, enabled)

  const chunks = [chunk0, chunk1, chunk2, chunk3, chunk4, chunk5, chunk6, chunk7, chunk8, chunk9]
  const isLoading = chunks.some(c => c.isLoading)

  const vaults: VaultInfo[] = []
  for (let ci = 0; ci < chunks.length; ci++) {
    const start = ci * CHUNK_SIZE
    const slice = addresses.slice(start, start + CHUNK_SIZE)
    if (slice.length === 0) break
    const results = chunks[ci].data
    if (results) {
      vaults.push(...parseVaults(slice, results as { status: string; result: unknown }[]))
    }
  }

  return {
    vaults,
    isLoading,
    refetch: () => chunks.forEach(c => c.refetch()),
  }
}
