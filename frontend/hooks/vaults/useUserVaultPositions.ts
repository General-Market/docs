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

type BalanceCall = {
  address: `0x${string}`
  abi: typeof VISION_VAULT_ABI
  functionName: 'balanceOf'
  args: [`0x${string}`]
  chainId: number
}

function useBalanceChunk(calls: BalanceCall[], chunkIndex: number) {
  const slice = calls.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE)
  return useReadContracts({
    contracts: slice as any,
    allowFailure: true,
    query: { enabled: slice.length > 0, refetchInterval: 15_000 },
  })
}

export function useUserVaultPositions(userAddress: string | undefined): UserVaultSummary {
  const { vaults, isLoading: vaultsLoading } = useVaults()

  const balanceCalls = useMemo<BalanceCall[]>(() => {
    if (!userAddress || vaults.length === 0) return []
    return vaults.map((v) => ({
      address: v.address,
      abi: VISION_VAULT_ABI,
      functionName: 'balanceOf' as const,
      args: [userAddress as `0x${string}`],
      chainId: indexL3.id,
    }))
  }, [userAddress, vaults])

  // 10 × 50 = 500 matches useVaults()'s chunk budget — must stay ≥ the vault
  // count, or late-list vaults silently miss the balanceOf check.
  const chunk0 = useBalanceChunk(balanceCalls, 0)
  const chunk1 = useBalanceChunk(balanceCalls, 1)
  const chunk2 = useBalanceChunk(balanceCalls, 2)
  const chunk3 = useBalanceChunk(balanceCalls, 3)
  const chunk4 = useBalanceChunk(balanceCalls, 4)
  const chunk5 = useBalanceChunk(balanceCalls, 5)
  const chunk6 = useBalanceChunk(balanceCalls, 6)
  const chunk7 = useBalanceChunk(balanceCalls, 7)
  const chunk8 = useBalanceChunk(balanceCalls, 8)
  const chunk9 = useBalanceChunk(balanceCalls, 9)

  const chunks = [chunk0, chunk1, chunk2, chunk3, chunk4, chunk5, chunk6, chunk7, chunk8, chunk9]

  const allResults = useMemo(() => {
    const results: ({ status: string; result: unknown } | undefined)[] = []
    for (const chunk of chunks) {
      if (chunk.data) results.push(...(chunk.data as any))
    }
    return results
  }, [chunk0.data, chunk1.data, chunk2.data, chunk3.data, chunk4.data, chunk5.data, chunk6.data, chunk7.data, chunk8.data, chunk9.data])

  const isLoadingBalances = chunks.some(c => c.isLoading)

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
