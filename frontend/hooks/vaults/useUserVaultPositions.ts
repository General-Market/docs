'use client'

import { useMemo } from 'react'
import { useReadContracts } from 'wagmi'
import { formatUnits } from 'viem'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { useVaults, VaultInfo } from '@/hooks/vaults/useVaults'
import { useFundBranding } from '@/hooks/vaults/useFundBranding'
import { indexL3 } from '@/lib/wagmi'

export interface UserVaultPosition {
  vault: VaultInfo
  shares: bigint
  currentValue: number
  /** Vault-level performance since inception (decimal, e.g. 0.05 = +5%) */
  vaultPerformance: number
  /** Display name from fund branding or vault name */
  displayName: string
}

export interface UserVaultSummary {
  positions: UserVaultPosition[]
  totalValue: number
  /** Weighted average vault performance across user positions */
  avgPerformance: number
  isLoading: boolean
}

const CHUNK_SIZE = 50

export function useUserVaultPositions(userAddress: string | undefined): UserVaultSummary {
  const { vaults, isLoading: vaultsLoading } = useVaults()

  const balanceCalls = useMemo(() => {
    if (!userAddress || vaults.length === 0) return []
    return vaults.map((v) => ({
      address: v.address,
      abi: VISION_VAULT_ABI,
      functionName: 'balanceOf' as const,
      args: [userAddress as `0x${string}`],
      chainId: indexL3.id,
    }))
  }, [userAddress, vaults])

  // Chunk into <=50 calls per batch (wagmi multicall limit)
  const chunk0Calls = balanceCalls.slice(0, CHUNK_SIZE)
  const chunk1Calls = balanceCalls.slice(CHUNK_SIZE, CHUNK_SIZE * 2)
  const chunk2Calls = balanceCalls.slice(CHUNK_SIZE * 2, CHUNK_SIZE * 3)
  const chunk3Calls = balanceCalls.slice(CHUNK_SIZE * 3, CHUNK_SIZE * 4)

  const chunk0 = useReadContracts({
    contracts: chunk0Calls as any,
    allowFailure: true,
    query: { enabled: chunk0Calls.length > 0, refetchInterval: 15_000 },
  })
  const chunk1 = useReadContracts({
    contracts: chunk1Calls as any,
    allowFailure: true,
    query: { enabled: chunk1Calls.length > 0, refetchInterval: 15_000 },
  })
  const chunk2 = useReadContracts({
    contracts: chunk2Calls as any,
    allowFailure: true,
    query: { enabled: chunk2Calls.length > 0, refetchInterval: 15_000 },
  })
  const chunk3 = useReadContracts({
    contracts: chunk3Calls as any,
    allowFailure: true,
    query: { enabled: chunk3Calls.length > 0, refetchInterval: 15_000 },
  })

  const allResults = useMemo(() => {
    const results: ({ status: string; result: unknown } | undefined)[] = []
    for (const chunk of [chunk0, chunk1, chunk2, chunk3]) {
      if (chunk.data) results.push(...(chunk.data as any))
    }
    return results
  }, [chunk0.data, chunk1.data, chunk2.data, chunk3.data])

  const isLoadingBalances = [chunk0, chunk1, chunk2, chunk3].some(c => c.isLoading)

  const summary = useMemo((): UserVaultSummary => {
    if (vaults.length === 0 || allResults.length === 0) {
      return { positions: [], totalValue: 0, avgPerformance: 0, isLoading: vaultsLoading || isLoadingBalances }
    }

    const positions: UserVaultPosition[] = []

    for (let i = 0; i < vaults.length && i < allResults.length; i++) {
      const result = allResults[i]
      if (!result || result.status === 'failure') continue

      const shares = result.result as bigint
      if (!shares || shares === 0n) continue

      const vault = vaults[i]
      const currentValue = parseFloat(formatUnits(shares, 18)) * vault.navPerShare

      positions.push({
        vault,
        shares,
        currentValue,
        vaultPerformance: vault.performanceSinceInception,
        displayName: vault.name,
      })
    }

    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0)
    const avgPerformance = totalValue > 0
      ? positions.reduce((sum, p) => sum + p.vaultPerformance * p.currentValue, 0) / totalValue
      : 0

    return {
      positions,
      totalValue,
      avgPerformance,
      isLoading: vaultsLoading || isLoadingBalances,
    }
  }, [vaults, allResults, vaultsLoading, isLoadingBalances])

  return summary
}
