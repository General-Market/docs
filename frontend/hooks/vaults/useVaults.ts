'use client'

import { useReadContract, useReadContracts } from 'wagmi'
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

export function useVaults() {
  const { getAddress, whitelistedVaults } = useDeployment()
  const factoryAddress = getAddress('VisionVaultFactory')
  const enabled = factoryAddress !== ZERO_ADDR

  // 1. Read all vault addresses from factory
  const {
    data: vaultAddresses,
    isLoading: isLoadingAddresses,
    refetch: refetchAddresses,
  } = useReadContract({
    address: factoryAddress,
    abi: VISION_VAULT_FACTORY_ABI,
    functionName: 'getAllVaults',
    chainId: indexL3.id,
    query: { enabled },
  })

  // Filter by whitelist if one exists (empty whitelist = show all)
  const allAddresses = (vaultAddresses as `0x${string}`[] | undefined) ?? []
  const addresses = whitelistedVaults.length > 0
    ? allAddresses.filter(a => whitelistedVaults.includes(a.toLowerCase() as `0x${string}`))
    : allAddresses

  // 2. Multicall: read all vault data in one batch
  const vaultCalls = addresses.flatMap((addr) => [
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'name' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'symbol' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'manager' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'performanceFeeRate' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'highWaterMark' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'totalAssets' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'totalSupply' as const, chainId: indexL3.id },
    { address: addr, abi: VISION_VAULT_ABI, functionName: 'totalActiveCapital' as const, chainId: indexL3.id },
  ])

  const FIELDS_PER_VAULT = 8

  const {
    data: multicallResults,
    isLoading: isLoadingData,
    refetch: refetchData,
  } = useReadContracts({
    contracts: vaultCalls as any,
    query: { enabled: addresses.length > 0 },
  })

  // 3. Parse results into VaultInfo objects
  const vaults: VaultInfo[] = []
  if (multicallResults && addresses.length > 0) {
    for (let i = 0; i < addresses.length; i++) {
      const base = i * FIELDS_PER_VAULT
      const results = multicallResults.slice(base, base + FIELDS_PER_VAULT)

      // Skip vaults where any critical read failed
      if (results.some((r) => r.status === 'failure')) continue

      const name = results[0].result as string
      const symbol = results[1].result as string
      const manager = results[2].result as `0x${string}`
      const performanceFeeRate = results[3].result as bigint
      const highWaterMark = results[4].result as bigint
      const totalAssets = results[5].result as bigint
      const totalSupply = results[6].result as bigint
      const totalActiveCapital = results[7].result as bigint

      // NAV per share: totalAssets / totalSupply (both 18 decimals)
      const navPerShare = totalSupply > 0n
        ? Number(totalAssets) / Number(totalSupply)
        : 1.0

      // Performance since inception: NAV started at 1.0
      const performanceSinceInception = navPerShare - 1.0

      const tvlFloat = parseFloat(formatUnits(totalAssets, 18))
      const tvlFormatted = tvlFloat.toLocaleString(undefined, { maximumFractionDigits: 2 })

      const deployedRatio = totalAssets > 0n
        ? Number(totalActiveCapital) / Number(totalAssets)
        : 0

      vaults.push({
        address: addresses[i],
        name,
        symbol,
        manager,
        performanceFeeRate,
        highWaterMark,
        totalAssets,
        totalSupply,
        totalActiveCapital,
        navPerShare,
        performanceSinceInception,
        tvlFormatted,
        deployedRatio,
      })
    }
  }

  // Total TVL across all vaults
  const totalTvl = vaults.reduce((sum, v) => sum + v.totalAssets, 0n)
  const totalTvlFormatted = parseFloat(formatUnits(totalTvl, 18)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })

  return {
    vaults,
    totalTvl,
    totalTvlFormatted,
    isLoading: isLoadingAddresses || isLoadingData,
    refetch: () => { refetchAddresses(); refetchData() },
  }
}
