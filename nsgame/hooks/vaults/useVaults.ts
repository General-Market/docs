'use client'

import { useReadContract, useReadContracts } from '@/lib/wallet-shim'
import { formatUnits } from 'viem'
import { VISION_VAULT_ABI, VISION_VAULT_FACTORY_ABI } from '@/lib/contracts/vault-abi'
import { useDeployment } from '@/hooks/useDeployment'
import { indexL3 } from '@/lib/wagmi'

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

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as const
const FIELDS_PER_VAULT = 8
const CHUNK_SIZE = 50

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
  const { getAddress, whitelistedVaults } = useDeployment()
  const factoryAddress = getAddress('VisionVaultFactory')
  const factoryEnabled = factoryAddress !== ZERO_ADDR

  const {
    data: vaultAddresses,
    isLoading: isLoadingAddresses,
    refetch: refetchAddresses,
  } = useReadContract({
    address: factoryAddress,
    abi: VISION_VAULT_FACTORY_ABI,
    functionName: 'getAllVaults',
    chainId: indexL3.id,
    query: { enabled: factoryEnabled },
  })

  const allAddresses = (vaultAddresses as `0x${string}`[] | undefined) ?? []
  const addresses = whitelistedVaults.length > 0
    ? allAddresses.filter(a => whitelistedVaults.includes(a.toLowerCase() as `0x${string}`))
    : allAddresses

  const chunksEnabled = addresses.length > 0

  // Up to 4 chunks × 50 = 200 vaults. Add more hooks if needed.
  const chunk0 = useVaultChunk(addresses, 0, chunksEnabled)
  const chunk1 = useVaultChunk(addresses, 1, chunksEnabled)
  const chunk2 = useVaultChunk(addresses, 2, chunksEnabled)
  const chunk3 = useVaultChunk(addresses, 3, chunksEnabled)

  const chunks = [chunk0, chunk1, chunk2, chunk3]
  const isLoadingData = chunks.some(c => c.isLoading)

  // Merge chunk results progressively — each chunk parses its own slice
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

  const totalTvl = vaults.reduce((sum, v) => sum + v.totalAssets, 0n)
  const totalTvlFormatted = parseFloat(formatUnits(totalTvl, 18)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })

  return {
    vaults,
    totalTvl,
    totalTvlFormatted,
    isLoading: isLoadingAddresses || isLoadingData,
    refetch: () => {
      refetchAddresses()
      chunks.forEach(c => c.refetch())
    },
  }
}
